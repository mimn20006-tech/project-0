const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: String,
  price: Number,
  quantity: Number,
  image: String,
  size: String,
  color: String
});

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  address: String,
  items: [OrderItemSchema],
  subtotal: Number,
  discountTotal: { type: Number, default: 0 },
  couponCode: String,
  total: Number,
  paymentMethod: String,
  transactionCode: String,
  paymentStatus: { type: String, default: "pending" },
  paidAt: Date,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", OrderSchema);
