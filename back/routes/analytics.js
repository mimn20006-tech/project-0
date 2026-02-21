const router = require("express").Router();
const AnalyticsEvent = require("../models/analyticsEvent");
const Order = require("../models/order");
const { optionalAuth, requirePermission } = require("../middleware/auth");

router.post("/events", optionalAuth, async (req, res) => {
  const event = await AnalyticsEvent.create({
    name: String(req.body?.name || "page_view"),
    sessionId: String(req.body?.sessionId || ""),
    path: String(req.body?.path || ""),
    metadata: req.body?.metadata || {},
    userId: req.user?.id
  });
  res.json({ ok: true, id: event._id });
});

router.get("/dashboard", requirePermission("dashboard.read"), async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events = await AnalyticsEvent.find({ createdAt: { $gte: since } }).lean();
  const paidOrders = await Order.find({ createdAt: { $gte: since }, paymentStatus: "paid" }).select("items").lean();
  const byName = {};
  events.forEach((e) => {
    byName[e.name] = (byName[e.name] || 0) + 1;
  });

  const purchased = new Set();
  paidOrders.forEach((o) => (o.items || []).forEach((i) => purchased.add(String(i.productId || ""))));

  const cartIntentMap = {};
  events
    .filter((e) => e.name === "add_to_cart")
    .forEach((e) => {
      const id = String(e?.metadata?.productId || "");
      if (!id) return;
      cartIntentMap[id] = (cartIntentMap[id] || 0) + 1;
    });
  const cartNotPurchased = Object.entries(cartIntentMap)
    .filter(([productId]) => !purchased.has(productId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([productId, adds]) => ({ productId, adds }));

  res.json({
    since,
    totalEvents: events.length,
    byName,
    cartNotPurchased
  });
});

module.exports = router;
