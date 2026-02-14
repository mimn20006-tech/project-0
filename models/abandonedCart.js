const mongoose = require("mongoose");

const AbandonedCartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: String,
  price: Number,
  quantity: Number,
  image: String,
  size: String,
  color: String
}, { _id: false });

const AbandonedCartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  email: { type: String, index: true },
  name: String,
  items: [AbandonedCartItemSchema],
  total: Number,
  cartKey: { type: String, index: true },
  lastActiveAt: { type: Date, default: Date.now },
  remindedAt: Date,
  recoveredAt: Date,
  status: { type: String, enum: ["active", "recovered", "expired"], default: "active" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AbandonedCart", AbandonedCartSchema);

