const mongoose = require("mongoose");
const Product = require("./models/product");

const products = [
  { name: "هودي رجالي أسود", price: 350, stock: 20, category: "Men", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400" },
  { name: "هودي رجالي رمادي", price: 320, stock: 15, category: "Men", image: "https://images.unsplash.com/photo-1578768079052-aa76e52d4f2e?w=400" },
  { name: "هودي نسائي بيج", price: 380, stock: 12, category: "Women", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400" },
  { name: "هودي نسائي وردي", price: 360, stock: 18, category: "Women", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400" },
  { name: "هودي رجالي أزرق", price: 340, stock: 10, category: "Men", image: "https://images.unsplash.com/photo-1509942774468-cf0230e313c1?w=400" },
  { name: "هودي نسائي أسود", price: 370, stock: 14, category: "Women", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400" }
];

async function seed() {
  await mongoose.connect("mongodb://127.0.0.1:27017/hoodie");
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log("تم إضافة المنتجات التجريبية.");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
