const Coupon = require("../models/coupon");
const Order = require("../models/order");

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function calcDiscount(subtotal, coupon) {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  let discount = 0;
  if (coupon.type === "fixed") {
    discount = Math.max(0, Number(coupon.value || 0));
  } else {
    discount = safeSubtotal * (Math.max(0, Number(coupon.value || 0)) / 100);
  }
  if (coupon.maxDiscount > 0) {
    discount = Math.min(discount, Number(coupon.maxDiscount));
  }
  return Math.min(safeSubtotal, Math.round(discount * 100) / 100);
}

async function validateCoupon({ code, subtotal, userId }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, error: "Coupon is required" };

  const coupon = await Coupon.findOne({ code: normalized, enabled: true });
  if (!coupon) return { ok: false, error: "Invalid coupon" };

  const now = new Date();
  if (coupon.startAt && now < coupon.startAt) return { ok: false, error: "Coupon is not active yet" };
  if (coupon.endAt && now > coupon.endAt) return { ok: false, error: "Coupon expired" };
  if (coupon.minOrderTotal > 0 && Number(subtotal || 0) < Number(coupon.minOrderTotal)) {
    return { ok: false, error: `Minimum order is ${coupon.minOrderTotal}` };
  }
  if (coupon.usageLimit > 0 && Number(coupon.usageCount || 0) >= Number(coupon.usageLimit)) {
    return { ok: false, error: "Coupon usage limit reached" };
  }

  const key = userId ? String(userId) : "";
  if (key && coupon.perUserLimit > 0) {
    const used = Number(coupon.userUsage?.get(key) || 0);
    if (used >= coupon.perUserLimit) {
      return { ok: false, error: "Per-user coupon limit reached" };
    }
  }

  if (coupon.firstOrderOnly && userId) {
    const hasPaidOrder = await Order.exists({ userId, paymentStatus: "paid" });
    if (hasPaidOrder) return { ok: false, error: "Coupon is for first order only" };
  }

  const discount = calcDiscount(subtotal, coupon);
  return {
    ok: true,
    coupon,
    normalizedCode: normalized,
    discount,
    finalTotal: Math.max(0, Number(subtotal || 0) - discount)
  };
}

async function consumeCoupon({ coupon, userId }) {
  coupon.usageCount = Number(coupon.usageCount || 0) + 1;
  if (userId && coupon.perUserLimit > 0) {
    const key = String(userId);
    const used = Number(coupon.userUsage?.get(key) || 0) + 1;
    coupon.userUsage.set(key, used);
  }
  await coupon.save();
}

module.exports = { normalizeCode, validateCoupon, consumeCoupon };

