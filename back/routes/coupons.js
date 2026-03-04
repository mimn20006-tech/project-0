const router = require("express").Router();
const Coupon = require("../models/coupon");
const User = require("../models/user");
const { requirePermission, optionalAuth, requireAuth } = require("../middleware/auth");
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
    visibleInStore: body.visibleInStore === true || body.visibleInStore === "true" || body.visibleInStore === 1 || body.visibleInStore === "1",
    pointsCost: Math.max(0, Number(body.pointsCost || 0)),
    tags: Array.isArray(body.tags) ? body.tags.map(v => String(v).trim()).filter(Boolean) : []
  };
}

function toStorePayload(coupon) {
  return {
    id: String(coupon._id),
    title: coupon.title || "Coupon",
    type: coupon.type,
    value: Number(coupon.value || 0),
    usageLimit: Number(coupon.usageLimit || 0),
    usageCount: Number(coupon.usageCount || 0),
    perUserLimit: Number(coupon.perUserLimit || 1),
    pointsCost: Number(coupon.pointsCost || 0)
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

router.get("/store", requireAuth, async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    enabled: true,
    visibleInStore: true,
    pointsCost: { $gt: 0 },
    $and: [
      { $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: now } }] }
    ]
  }).sort({ pointsCost: 1, createdAt: -1 });
  res.json(coupons.map(toStorePayload));
});

router.get("/my", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select("ownedCoupons loyaltyPoints");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    loyaltyPoints: Number(user.loyaltyPoints || 0),
    ownedCoupons: (user.ownedCoupons || []).map((c) => ({
      couponId: String(c.couponId || ""),
      code: c.code || "",
      title: c.title || "Coupon",
      pointsCost: Number(c.pointsCost || 0),
      redeemedAt: c.redeemedAt
    }))
  });
});

router.post("/store/:id/redeem", requireAuth, async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ error: "Coupon not found" });
  if (!coupon.enabled || !coupon.visibleInStore || Number(coupon.pointsCost || 0) <= 0) {
    return res.status(400).json({ error: "Coupon is not available in store" });
  }
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const alreadyOwned = (user.ownedCoupons || []).some((c) => String(c.couponId) === String(coupon._id));
  if (alreadyOwned) return res.status(400).json({ error: "Coupon already purchased" });
  if (Number(user.loyaltyPoints || 0) < Number(coupon.pointsCost || 0)) {
    return res.status(400).json({ error: "Not enough points" });
  }

  user.loyaltyPoints = Number(user.loyaltyPoints || 0) - Number(coupon.pointsCost || 0);
  user.loyaltySpent = Number(user.loyaltySpent || 0) + Number(coupon.pointsCost || 0);
  user.ownedCoupons = user.ownedCoupons || [];
  user.ownedCoupons.push({
    couponId: coupon._id,
    code: coupon.code,
    title: coupon.title || "Coupon",
    pointsCost: Number(coupon.pointsCost || 0),
    redeemedAt: new Date()
  });
  await user.save();

  res.json({
    ok: true,
    coupon: {
      code: coupon.code,
      title: coupon.title || "Coupon",
      pointsCost: Number(coupon.pointsCost || 0)
    },
    loyaltyPoints: Number(user.loyaltyPoints || 0)
  });
});

router.post("/", requirePermission("coupon.manage"), async (req, res) => {
  try {
    const payload = toCouponPayload(req.body);
    if (!payload.code) return res.status(400).json({ error: "Coupon code is required" });
    if (payload.visibleInStore && payload.pointsCost <= 0) {
      return res.status(400).json({ error: "Points cost must be greater than 0 when coupon is visible in store" });
    }
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
    if (err && err.code === 11000) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requirePermission("coupon.manage"), async (req, res) => {
  try {
    const payload = toCouponPayload(req.body);
    if (!payload.code) return res.status(400).json({ error: "Coupon code is required" });
    if (payload.visibleInStore && payload.pointsCost <= 0) {
      return res.status(400).json({ error: "Points cost must be greater than 0 when coupon is visible in store" });
    }
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
    if (err && err.code === 11000) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }
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
