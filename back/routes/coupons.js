const router = require("express").Router();
const Coupon = require("../models/coupon");
const { requirePermission, optionalAuth } = require("../middleware/auth");
const { normalizeCode, validateCoupon } = require("../utils/coupon-engine");
const { writeAudit } = require("../utils/audit");

function toCouponPayload(body = {}) {
  return {
    code: normalizeCode(body.code),
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    type: body.type === "fixed" ? "fixed" : "percent",
    value: Number(body.value || 0),
    minOrderTotal: Number(body.minOrderTotal || 0),
    maxDiscount: Number(body.maxDiscount || 0),
    startAt: body.startAt ? new Date(body.startAt) : undefined,
    endAt: body.endAt ? new Date(body.endAt) : undefined,
    usageLimit: Number(body.usageLimit || 0),
    perUserLimit: Number(body.perUserLimit || 1),
    firstOrderOnly: !!body.firstOrderOnly,
    enabled: body.enabled !== false,
    tags: Array.isArray(body.tags) ? body.tags.map(v => String(v).trim()).filter(Boolean) : []
  };
}

router.post("/validate", optionalAuth, async (req, res) => {
  try {
    const subtotal = Number(req.body?.subtotal || 0);
    const code = req.body?.code;
    const out = await validateCoupon({ code, subtotal, userId: req.user?.id });
    if (!out.ok) return res.status(400).json(out);
    res.json({
      ok: true,
      code: out.normalizedCode,
      discount: out.discount,
      finalTotal: out.finalTotal,
      coupon: {
        code: out.coupon.code,
        title: out.coupon.title,
        description: out.coupon.description,
        type: out.coupon.type,
        value: out.coupon.value
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get("/", requirePermission("coupon.manage"), async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json(coupons);
});

router.post("/", requirePermission("coupon.manage"), async (req, res) => {
  try {
    const payload = toCouponPayload(req.body);
    if (!payload.code) return res.status(400).json({ error: "Coupon code is required" });
    const coupon = await Coupon.create(payload);
    await writeAudit({
      req,
      action: "coupon.create",
      targetType: "coupon",
      targetId: coupon._id,
      metadata: { code: coupon.code }
    });
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requirePermission("coupon.manage"), async (req, res) => {
  try {
    const payload = toCouponPayload(req.body);
    if (!payload.code) return res.status(400).json({ error: "Coupon code is required" });
    const updated = await Coupon.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ error: "Coupon not found" });
    await writeAudit({
      req,
      action: "coupon.update",
      targetType: "coupon",
      targetId: updated._id,
      metadata: { code: updated.code }
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requirePermission("coupon.manage"), async (req, res) => {
  const removed = await Coupon.findByIdAndDelete(req.params.id);
  if (!removed) return res.status(404).json({ error: "Coupon not found" });
  await writeAudit({
    req,
    action: "coupon.delete",
    targetType: "coupon",
    targetId: removed._id,
    metadata: { code: removed.code }
  });
  res.json({ ok: true });
});

module.exports = router;
