const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ["admin", "manager", "editor", "user"], default: "user" },
  permissions: { type: [String], default: [] },
  phone: String,
  country: String,
  address: String,
  avatar: String,
  emailVerified: { type: Boolean, default: false },
  verifyCode: String,
  resetCode: String,
  resetCodeExpires: Date,
  adminTwoFactorEnabled: { type: Boolean, default: false },
  adminTwoFactorCode: String,
  adminTwoFactorExpires: Date,
  loyaltyPoints: { type: Number, default: 0 },
  loyaltySpent: { type: Number, default: 0 },
  marketingLastSentAt: Date,
  ownedCoupons: {
    type: [{
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
      code: String,
      title: String,
      pointsCost: Number,
      redeemedAt: { type: Date, default: Date.now }
    }],
    default: []
  }
});

module.exports = mongoose.model("User", UserSchema);
