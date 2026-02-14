const router = require("express").Router();
const AbandonedCart = require("../models/abandonedCart");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");
const { writeAudit } = require("../utils/audit");

function totalOf(items = []) {
  return items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
}

router.post("/abandoned-cart", requireAuth, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const email = String(req.body?.email || req.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });

  const cartKey = `${req.user.id}:${email}`;
  const payload = {
    userId: req.user.id,
    email,
    name: String(req.body?.name || req.user?.name || "").trim(),
    items,
    total: totalOf(items),
    cartKey,
    lastActiveAt: new Date(),
    status: items.length ? "active" : "expired"
  };
  const doc = await AbandonedCart.findOneAndUpdate(
    { cartKey },
    payload,
    { upsert: true, new: true }
  );
  res.json({ ok: true, id: doc._id, status: doc.status });
});

router.post("/abandoned-cart/recovered", requireAuth, async (req, res) => {
  const email = String(req.body?.email || req.user?.email || "").trim().toLowerCase();
  const cartKey = `${req.user.id}:${email}`;
  await AbandonedCart.findOneAndUpdate(
    { cartKey },
    { status: "recovered", recoveredAt: new Date() },
    { new: true }
  );
  res.json({ ok: true });
});

router.get("/abandoned-carts", requirePermission("marketing.manage"), async (req, res) => {
  const carts = await AbandonedCart.find({ status: "active" }).sort({ lastActiveAt: -1 }).limit(200);
  res.json(carts);
});

router.post("/abandoned-carts/send-reminders", requirePermission("marketing.manage"), async (req, res) => {
  const delayMinutes = Number(req.body?.delayMinutes || 60);
  const threshold = new Date(Date.now() - delayMinutes * 60 * 1000);
  const target = await AbandonedCart.find({
    status: "active",
    lastActiveAt: { $lte: threshold },
    $or: [
      { remindedAt: { $exists: false } },
      { remindedAt: null }
    ]
  }).limit(100);

  let sent = 0;
  for (const cart of target) {
    try {
      const recoverUrl = `${process.env.BASE_URL || "http://localhost:5000"}/cart.html?recover=1`;
      await sendMail({
        to: cart.email,
        subject: "Hand Aura - سلتك ما زالت بانتظارك",
        text:
          `مرحبًا ${cart.name || ""}\n` +
          `لديك منتجات في السلة بقيمة ${Number(cart.total || 0).toFixed(0)} جنيه.\n` +
          `استكمل الشراء: ${recoverUrl}`
      });
      cart.remindedAt = new Date();
      await cart.save();
      sent += 1;
    } catch {}
  }

  await writeAudit({
    req,
    action: "abandoned.send_reminders",
    targetType: "abandoned_cart",
    metadata: { sent, checked: target.length }
  });

  res.json({ ok: true, sent, checked: target.length });
});

module.exports = router;
