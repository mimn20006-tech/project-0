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
  userRatings: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  avgRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
  // أول صورة أساسية، مع إمكانية تخزين أكثر من صورة
  image: String,
  images: [String],
  video: String,
  videos: [String]
});

module.exports = mongoose.model("Product", ProductSchema);
