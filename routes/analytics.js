const router = require("express").Router();
const AnalyticsEvent = require("../models/analyticsEvent");
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
  const byName = {};
  events.forEach((e) => {
    byName[e.name] = (byName[e.name] || 0) + 1;
  });
  res.json({
    since,
    totalEvents: events.length,
    byName
  });
});

module.exports = router;
