const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number,
  category: String,
  type: String,
  sizes: [String],
  description: String,
  colors: [String],
  ratings: [Number],
  avgRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
  // أول صورة أساسية، مع إمكانية تخزين أكثر من صورة
  image: String,
  images: [String]
});

module.exports = mongoose.model("Product", ProductSchema);
