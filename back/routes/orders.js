const router = require("express").Router();
const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user");
const { optionalAuth, requirePermission, requireAuth } = require("../middleware/auth");
const { validateCoupon, consumeCoupon, normalizeCode } = require("../utils/coupon-engine");
const { encryptText, decryptText } = require("../utils/crypto");
const { writeAudit } = require("../utils/audit");

function makeTransactionCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TX-${ts}-${rnd}`;
}

function normalizePaymentMethod(method) {
  const value = String(method || "cash_on_delivery").trim().toLowerCase();
  const allowed = new Set([
    "paymob",
    "paypal",
    "visa",
    "fawry",
    "vodafone_cash",
    "cash_on_delivery"
  ]);
  return allowed.has(value) ? value : "cash_on_delivery";
}

function needsOnlinePayment(method) {
  return method !== "cash_on_delivery";
}

async function grantLoyaltyPoints(userId, total) {
  if (!userId) return 0;
  const points = Math.max(0, Math.floor(Number(total || 0) / 10));
  if (!points) return 0;
  await User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: points } });
  return points;
}

router.post("/", optionalAuth, async (req, res) => {
  let createdOrder = null;
  let stockAdjusted = false;
  let normalizedItems = [];
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const ids = items.map(i => i.productId).filter(Boolean);
    if (!items.length) return res.status(400).json({ error: "Cart is empty" });

    let subtotal = 0;
    if (ids.length) {
      const products = await Product.find({ _id: { $in: ids } });
      const productMap = new Map(products.map(p => [String(p._id), p]));
      normalizedItems = [];
      for (const item of items) {
        const product = productMap.get(String(item.productId));
        const qty = Math.max(0, Number(item.quantity || 0));
        if (!product || product.stock < qty) {
          return res.status(400).json({ error: "Insufficient stock" });
        }
        subtotal += Number(product.price || 0) * qty;
        normalizedItems.push({
          productId: product._id,
          name: product.name,
          price: Number(product.price || 0),
          quantity: qty,
          image: (product.images && product.images[0]) || product.image || "",
          size: item.size ? String(item.size) : "",
          color: item.color ? String(item.color) : ""
        });
      }
      req.body.items = normalizedItems;
    }

    const couponCode = normalizeCode(req.body.couponCode);
    let discountTotal = 0;
    let couponDoc = null;
    if (couponCode) {
      const check = await validateCoupon({
        code: couponCode,
        subtotal,
        userId: req.user?.id
      });
      if (!check.ok) return res.status(400).json({ error: check.error });
      discountTotal = Number(check.discount || 0);
      couponDoc = check.coupon;
    }

    const finalTotal = Math.max(0, subtotal - discountTotal);
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
    const paymentStatus = needsOnlinePayment(paymentMethod) ? "awaiting_payment" : "paid";

    createdOrder = new Order({
      ...req.body,
      customerPhone: encryptText(req.body.customerPhone),
      address: encryptText(req.body.address),
      subtotal,
      discountTotal,
      couponCode: couponCode || undefined,
      total: finalTotal,
      paymentMethod,
      paymentStatus,
      paidAt: paymentStatus === "paid" ? new Date() : undefined,
      transactionCode: makeTransactionCode(),
      userId: req.user ? req.user.id : undefined
    });
    await createdOrder.save();

    if (ids.length) {
      const bulk = req.body.items.map(i => ({
        updateOne: {
          filter: { _id: i.productId },
          update: { $inc: { stock: -Math.max(0, Number(i.quantity || 0)) } }
        }
      }));
      await Product.bulkWrite(bulk);
      stockAdjusted = true;
    }

    if (couponDoc) {
      await consumeCoupon({ coupon: couponDoc, userId: req.user?.id });
    }

    if (paymentStatus === "paid") {
      await grantLoyaltyPoints(req.user?.id, finalTotal);
    }

    try {
      await writeAudit({
        req,
        action: "order.create",
        targetType: "order",
        targetId: createdOrder._id,
        metadata: {
          total: finalTotal,
          subtotal,
          discountTotal,
          paymentMethod
        }
      });
    } catch {}

    const out = createdOrder.toObject();
    out.customerPhone = decryptText(out.customerPhone);
    out.address = decryptText(out.address);
    res.status(201).json(out);
  } catch (err) {
    if (createdOrder?._id) {
      try {
        if (stockAdjusted && normalizedItems.length) {
          const rollbackBulk = normalizedItems.map((i) => ({
            updateOne: {
              filter: { _id: i.productId },
              update: { $inc: { stock: Math.max(0, Number(i.quantity || 0)) } }
            }
          }));
          await Product.bulkWrite(rollbackBulk);
        }
        await Order.findByIdAndDelete(createdOrder._id);
      } catch {}
    }
    res.status(400).json({ error: err.message });
  }
});

router.get("/", requirePermission("order.read"), async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).lean();
  orders.forEach((o) => {
    o.customerPhone = decryptText(o.customerPhone);
    o.address = decryptText(o.address);
  });
  res.json(orders);
});

router.get("/my", requireAuth, async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  orders.forEach((o) => {
    o.customerPhone = decryptText(o.customerPhone);
    o.address = decryptText(o.address);
  });
  res.json(orders);
});

router.get("/:id", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (req.query.email && req.query.email !== order.customerEmail) {
    return res.status(403).json({ error: "Email does not match this order" });
  }

  const out = order.toObject();
  out.customerPhone = decryptText(out.customerPhone);
  out.address = decryptText(out.address);
  res.json(out);
});

router.put("/:id/pay", requirePermission("payment.manage"), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.paymentMethod === "cash_on_delivery") {
      return res.status(400).json({ error: "Cash on delivery does not require online payment" });
    }
    if (order.paymentStatus === "paid") return res.json(order);

    order.paymentStatus = "paid";
    order.paidAt = new Date();
    if (req.body?.transactionCode) {
      order.transactionCode = String(req.body.transactionCode);
    }
    await order.save();
    await grantLoyaltyPoints(order.userId, order.total);
    await writeAudit({
      req,
      action: "order.pay",
      targetType: "order",
      targetId: order._id,
      metadata: {
        paymentMethod: order.paymentMethod,
        transactionCode: order.transactionCode
      }
    });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requirePermission("order.update"), async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
  await writeAudit({
    req,
    action: "order.status_update",
    targetType: "order",
    targetId: req.params.id,
    metadata: { status: req.body.status }
  });
  res.json({ ok: true });
});

module.exports = router;
