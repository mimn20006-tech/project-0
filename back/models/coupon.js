const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema({
  code: { type: String, unique: true, index: true },
  title: String,
  description: String,
  type: { type: String, enum: ["percent", "fixed"], default: "percent" },
  value: { type: Number, default: 0 },
  minOrderTotal: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 },
  startAt: Date,
  endAt: Date,
  usageLimit: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  userUsage: { type: Map, of: Number, default: {} },
  firstOrderOnly: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  visibleInStore: { type: Boolean, default: false },
  pointsCost: { type: Number, default: 0 },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Coupon", CouponSchema);
