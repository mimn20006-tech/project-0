const router = require("express").Router();
const crypto = require("crypto");
const Order = require("../models/order");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");
let Stripe = null;
try {
  Stripe = require("stripe");
} catch {}

function makeHmac(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function makePaymobHmac(payload, secret) {
  return crypto.createHmac("sha512", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  if (!left.length || !right.length) return false;
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function paymobHmacSource(obj = {}) {
  const order = obj.order || {};
  const source = obj.source_data || {};
  const fields = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    order.id,
    obj.owner,
    obj.pending,
    source.pan,
    source.sub_type,
    source.type,
    obj.success
  ];
  return fields.map((v) => (v === undefined || v === null ? "" : String(v))).join("");
}

function normalizeFlag(value) {
  if (typeof value === "boolean") return value;
  const v = String(value || "").toLowerCase();
  return v === "true" || v === "1";
}

async function markOrderPaid(orderId, tx) {
  if (!orderId) return "not_found";
  const update = {
    paymentStatus: "paid",
    paidAt: new Date()
  };
  if (tx) update.transactionCode = String(tx);

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: "paid" } },
    { $set: update },
    { new: true }
  );
  if (updated) return "paid_now";

  const existing = await Order.findById(orderId).select("_id");
  if (existing) return "already_paid";
  return "not_found";
}

function appUrl() {
  return process.env.BASE_URL || "http://localhost:5000";
}

function frontendUrl() {
  return process.env.FRONTEND_URL || appUrl();
}

function paymentConfig(method) {
  const normalized = method === "visa" ? "stripe" : method;
  const cfg = {
    stripe: { key: process.env.STRIPE_SECRET_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET },
    paypal: { key: process.env.PAYPAL_CLIENT_ID, webhookSecret: process.env.PAYPAL_WEBHOOK_ID },
    paymob: {
      key: process.env.PAYMOB_API_KEY,
      webhookSecret: process.env.PAYMOB_HMAC_SECRET,
      integrationId: process.env.PAYMOB_INTEGRATION_ID,
      iframeId: process.env.PAYMOB_IFRAME_ID
    },
    fawry: { key: process.env.FAWRY_MERCHANT_CODE, webhookSecret: process.env.FAWRY_SECRET }
  };
  return cfg[normalized] || null;
}

async function createPaymobCheckout({ order, config }) {
  const integrationId = Number(config.integrationId || 0);
  const iframeId = String(config.iframeId || "");
  if (!config.key || !integrationId || !iframeId) {
    throw new Error("Paymob environment is incomplete");
  }

  const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.key })
  });
  const authData = await authRes.json().catch(() => ({}));
  if (!authRes.ok || !authData.token) throw new Error("Paymob auth failed");

  const amountCents = Math.round(Number(order.total || 0) * 100);
  const merchantOrderId = String(order._id);

  const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authData.token,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: "EGP",
      merchant_order_id: merchantOrderId,
      items: (order.items || []).map((i) => ({
        name: i.name || "Item",
        amount_cents: Math.round(Number(i.price || 0) * 100),
        description: i.name || "Item",
        quantity: Number(i.quantity || 1)
      }))
    })
  });
  const orderData = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok || !orderData.id) throw new Error("Paymob order creation failed");

  const paymentKeyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authData.token,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: orderData.id,
      billing_data: {
        apartment: "NA",
        email: order.customerEmail || "customer@example.com",
        floor: "NA",
        first_name: (order.customerName || "Customer").split(" ")[0] || "Customer",
        street: "NA",
        building: "NA",
        phone_number: order.customerPhone || "+201000000000",
        shipping_method: "NA",
        postal_code: "NA",
        city: "Cairo",
        country: "EG",
        last_name: (order.customerName || "User").split(" ").slice(1).join(" ") || "User",
        state: "Cairo"
      },
      currency: "EGP",
      integration_id: integrationId
    })
  });
  const keyData = await paymentKeyRes.json().catch(() => ({}));
  if (!paymentKeyRes.ok || !keyData.token) throw new Error("Paymob payment key failed");

  return {
    redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${encodeURIComponent(keyData.token)}`
  };
}

router.post("/checkout-session", requireAuth, async (req, res) => {
  const { orderId, method } = req.body || {};
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (String(order.userId || "") !== String(req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const provider = String(method || order.paymentMethod || "").toLowerCase();
  const cfg = paymentConfig(provider);
  if (!cfg || !cfg.key) {
    return res.status(400).json({ error: `${provider} is not configured` });
  }

  const successUrl = `${frontendUrl()}/payment.html?gatewayStatus=return&orderId=${encodeURIComponent(order._id)}&tx=${encodeURIComponent(order.transactionCode || "")}`;
  const cancelUrl = `${frontendUrl()}/payment.html?gatewayStatus=cancel&orderId=${encodeURIComponent(order._id)}`;

  // Provider-specific integrations should be placed here using official SDK/REST.
  // This route keeps production-safe contracts and secure callback URLs.
  await writeAudit({
    req,
    action: "payment.checkout_session",
    targetType: "order",
    targetId: order._id,
    metadata: { provider }
  });

  if (provider === "paymob") {
    try {
      const paymob = await createPaymobCheckout({ order, config: cfg });
      return res.json({
        ok: true,
        provider,
        redirectUrl: paymob.redirectUrl
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (provider === "stripe") {
    try {
      if (!Stripe) return res.status(500).json({ error: "Stripe package is not installed on server" });
      if (!cfg.key) return res.status(400).json({ error: "Stripe key is not configured" });
      const stripe = new Stripe(cfg.key);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: (order.items || []).map((i) => ({
          quantity: Number(i.quantity || 1),
          price_data: {
            currency: "egp",
            unit_amount: Math.round(Number(i.price || 0) * 100),
            product_data: {
              name: i.name || "Item"
            }
          }
        })),
        metadata: {
          orderId: String(order._id),
          transactionCode: String(order.transactionCode || "")
        }
      });
      return res.json({
        ok: true,
        provider,
        redirectUrl: session.url
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.json({
    ok: true,
    provider,
    mode: "production-ready-contract",
    successUrl,
    cancelUrl,
    message: "Connect provider SDK/API keys to create a live checkout session."
  });
});

router.post("/webhook/:provider", async (req, res) => {
  const startedAt = Date.now();
  const metaBase = {
    provider: String(req.params.provider || "").toLowerCase(),
    ip: req.ip
  };
  try {
    const provider = String(req.params.provider || "").toLowerCase();
    if (provider === "stripe") {
      const cfgStripe = paymentConfig(provider);
      if (!Stripe) return res.status(500).json({ error: "Stripe package is not installed on server" });
      if (!cfgStripe?.key || !cfgStripe?.webhookSecret) {
        return res.status(400).json({ error: "Stripe webhook is not configured" });
      }
      const stripe = new Stripe(cfgStripe.key);
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(req.body, sig, cfgStripe.webhookSecret);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session?.metadata?.orderId;
        const tx = session?.payment_intent || session?.id;
        const paymentResult = orderId ? await markOrderPaid(orderId, tx) : "not_found";
        await writeAudit({
          req,
          action: "payment.webhook",
          targetType: "order",
          targetId: orderId,
          metadata: {
            ...metaBase,
            eventType: event.type,
            externalEventId: event.id,
            transactionCode: tx ? String(tx) : "",
            paymentResult,
            processingMs: Date.now() - startedAt
          }
        });
      } else {
        await writeAudit({
          req,
          action: "payment.webhook",
          targetType: "payment",
          targetId: String(event.id || ""),
          metadata: {
            ...metaBase,
            eventType: event.type,
            ignored: true,
            processingMs: Date.now() - startedAt
          }
        });
      }
      return res.json({ ok: true });
    }

    if (provider === "paymob") {
      const cfgPaymob = paymentConfig(provider);
      if (!cfgPaymob?.webhookSecret) {
        return res.status(400).json({ error: "Paymob webhook is not configured" });
      }
      const body = req.body || {};
      const obj = body.obj || {};
      const receivedHmac = String(body.hmac || req.headers["x-paymob-hmac"] || "").trim().toLowerCase();
      if (!receivedHmac) return res.status(401).json({ error: "Missing Paymob hmac" });

      const source = paymobHmacSource(obj);
      const expected = makePaymobHmac(source, cfgPaymob.webhookSecret).toLowerCase();
      if (!timingSafeEqualHex(expected, receivedHmac)) {
        return res.status(401).json({ error: "Invalid Paymob hmac" });
      }

      const success = normalizeFlag(obj.success);
      const pending = normalizeFlag(obj.pending);
      const orderId = obj?.order?.merchant_order_id || obj?.order?.id;
      const tx = obj?.id || obj?.txn_response_code || "";
      let paymentResult = "ignored";
      if (success && !pending && orderId) {
        paymentResult = await markOrderPaid(orderId, tx);
      }
      await writeAudit({
        req,
        action: "payment.webhook",
        targetType: "order",
        targetId: orderId,
        metadata: {
          ...metaBase,
          eventType: "paymob.transaction",
          externalEventId: obj?.id ? String(obj.id) : "",
          transactionCode: tx ? String(tx) : "",
          success,
          pending,
          paymentResult,
          processingMs: Date.now() - startedAt
        }
      });
      return res.json({ ok: true });
    }

    const cfg = paymentConfig(provider);
    if (!cfg?.webhookSecret) return res.status(400).json({ error: "Webhook secret not configured" });

    const signature = String(req.headers["x-signature"] || "");
    const raw = JSON.stringify(req.body || {});
    const expected = makeHmac(raw, cfg.webhookSecret);
    if (!signature || !timingSafeEqualHex(expected, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body || {};
    if (event.type === "payment.succeeded" && event.orderId) {
      const paymentResult = await markOrderPaid(event.orderId, event.transactionCode);
      await writeAudit({
        req,
        action: "payment.webhook",
        targetType: "order",
        targetId: event.orderId,
        metadata: {
          ...metaBase,
          eventType: event.type,
          externalEventId: event.id ? String(event.id) : "",
          transactionCode: event.transactionCode ? String(event.transactionCode) : "",
          paymentResult,
          processingMs: Date.now() - startedAt
        }
      });
    } else {
      await writeAudit({
        req,
        action: "payment.webhook",
        targetType: "payment",
        targetId: event.id ? String(event.id) : "",
        metadata: {
          ...metaBase,
          eventType: event.type || "unknown",
          ignored: true,
          processingMs: Date.now() - startedAt
        }
      });
    }

    res.json({ ok: true });
  } catch (err) {
    try {
      await writeAudit({
        req,
        action: "payment.webhook_error",
        targetType: "payment",
        targetId: "",
        metadata: {
          ...metaBase,
          error: err.message,
          processingMs: Date.now() - startedAt
        }
      });
    } catch {}
    res.status(400).json({ error: err.message });
  }
});

router.get("/status/:orderId", requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.orderId)
    .select("_id userId paymentMethod paymentStatus transactionCode paidAt total")
    .lean();
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (String(order.userId || "") !== String(req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({
    orderId: order._id,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    isPaid: order.paymentStatus === "paid",
    transactionCode: order.transactionCode || "",
    paidAt: order.paidAt || null,
    total: Number(order.total || 0)
  });
});

router.get("/providers", requirePermission("payment.manage"), async (req, res) => {
  const providers = ["stripe", "paypal", "paymob", "fawry"].map((name) => {
    const cfg = paymentConfig(name);
    return { name, configured: !!cfg?.key, webhookConfigured: !!cfg?.webhookSecret };
  });
  res.json({ providers });
});

router.__test = {
  makeHmac,
  makePaymobHmac,
  paymobHmacSource,
  normalizeFlag,
  timingSafeEqualHex,
  markOrderPaid
};

module.exports = router;
