const router = require("express").Router();
const Product = require("../models/product");
const Comment = require("../models/comment");
const User = require("../models/user");
const Order = require("../models/order");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requirePermission, requireAuth } = require("../middleware/auth");
const { getUploadDir, toUploadUrl } = require("../utils/uploads");

// إعداد multer لرفع الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = getUploadDir();
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    if (!isImage && !isVideo) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  }
});

function parseSizes(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {}
  }
  return str.split(",").map(v => v.trim()).filter(Boolean);
}

function parseColors(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {}
  }
  return str.split(",").map(v => v.trim()).filter(Boolean);
}

function parseMediaList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {}
  }
  return str.split(",").map(v => v.trim()).filter(Boolean);
}
function calcAvg(ratings = []) {
  if (!ratings.length) return 0;
  const sum = ratings.reduce((a, b) => a + Number(b || 0), 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

// get all products
router.get("/", async (req, res) => {
  const sortQuery = String(req.query.sort || "").trim().toLowerCase();
  let sort = { _id: -1 };
  if (sortQuery === "rating_desc") sort = { avgRating: -1, ratingsCount: -1 };
  if (sortQuery === "rating_asc") sort = { avgRating: 1, ratingsCount: 1 };
  if (sortQuery === "price_asc") sort = { price: 1 };
  if (sortQuery === "price_desc") sort = { price: -1 };
  const products = await Product.find().sort(sort);
  res.json(products);
});

// ratings for current user (auth)
router.get("/ratings/mine", requireAuth, async (req, res) => {
  const userId = String(req.user.id || "");
  const products = await Product.find({ "userRatings.userId": userId })
    .select("_id userRatings")
    .lean();
  const ratings = {};
  for (const p of products) {
    const mine = (p.userRatings || []).find((r) => String(r.userId) === userId);
    if (mine) ratings[String(p._id)] = Number(mine.rating || 0);
  }
  res.json({ ratings });
});

// get single product
router.get("/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.get("/:id/recommendations", async (req, res) => {
  const limit = Math.min(12, Math.max(2, Number(req.query.limit || 6)));
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const crossSell = await Product.find({
    _id: { $ne: product._id },
    category: product.category
  }).sort({ avgRating: -1, ratingsCount: -1 }).limit(limit);

  const upsell = await Product.find({
    _id: { $ne: product._id },
    type: product.type,
    price: { $gte: Number(product.price || 0) }
  }).sort({ price: 1, avgRating: -1 }).limit(limit);

  res.json({
    crossSell,
    upsell
  });
});

// add product (admin) - يدعم JSON أو form-data مع صور
router.post("/", requirePermission("product.write"), upload.fields([
  { name: "images", maxCount: 6 },
  { name: "images[]", maxCount: 6 },
  { name: "image", maxCount: 1 },
  { name: "videos", maxCount: 2 },
  { name: "videos[]", maxCount: 2 },
  { name: "video", maxCount: 1 }
]), async (req, res) => {
  try {
    const body = req.body;

    let images = [];
    let videos = [];

    // صور مرفوعة من الفورم
    const files = [...(req.files?.images || []), ...(req.files?.["images[]"] || []), ...(req.files?.image || [])];
    if (files.length) {
      images = files.map(f => toUploadUrl(f.filename));
    }
    const videoFiles = [...(req.files?.videos || []), ...(req.files?.["videos[]"] || []), ...(req.files?.video || [])];
    if (videoFiles.length) {
      videos = videoFiles.map((f) => toUploadUrl(f.filename));
    }

    // لو تم إرسال رابط صورة واحد قديمًا
    if (body.image && !images.length) {
      images = [body.image];
    }
    if (body.video && !videos.length) {
      videos = [body.video];
    } else if (body.videos && !videos.length) {
      videos = parseMediaList(body.videos);
    }

    const product = new Product({
      name: body.name,
      price: body.price,
      stock: body.stock,
      category: body.category,
      type: body.type,
      description: body.description || "",
      colors: parseColors(body.colors),
      sizes: parseSizes(body.sizes),
      ratings: [],
      avgRating: 0,
      ratingsCount: 0,
      image: images[0],
      images,
      video: videos[0],
      videos
    });

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// update product
router.put("/:id", requirePermission("product.write"), upload.fields([
  { name: "images", maxCount: 6 },
  { name: "images[]", maxCount: 6 },
  { name: "image", maxCount: 1 },
  { name: "videos", maxCount: 2 },
  { name: "videos[]", maxCount: 2 },
  { name: "video", maxCount: 1 }
]), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const body = req.body;

    if (body.name !== undefined) product.name = body.name;
    if (body.price !== undefined) product.price = body.price;
    if (body.stock !== undefined) product.stock = body.stock;
    if (body.category !== undefined) product.category = body.category;
    if (body.type !== undefined) product.type = body.type;
    if (body.description !== undefined) product.description = body.description;
    if (body.colors !== undefined) product.colors = parseColors(body.colors);
    if (body.sizes !== undefined) product.sizes = parseSizes(body.sizes);

    // إدارة الصور: لو في صور جديدة مرفوعة، نستبدل القائمة
    const files = [...(req.files?.images || []), ...(req.files?.["images[]"] || []), ...(req.files?.image || [])];
    if (files.length) {
      product.images = files.map(f => toUploadUrl(f.filename));
      product.image = product.images[0];
    } else if (body.image) {
      // في حالة إرسال رابط صورة فقط
      product.images = [body.image];
      product.image = body.image;
    }
    const videoFiles = [...(req.files?.videos || []), ...(req.files?.["videos[]"] || []), ...(req.files?.video || [])];
    if (videoFiles.length) {
      product.videos = videoFiles.map((f) => toUploadUrl(f.filename));
      product.video = product.videos[0];
    } else if (body.video) {
      product.videos = [body.video];
      product.video = body.video;
    } else if (body.videos) {
      const list = parseMediaList(body.videos);
      product.videos = list;
      product.video = list[0] || "";
    }

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// rate product
router.post("/:id/rate", requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const hasPaidOrder = await Order.exists({
      userId: req.user.id,
      paymentStatus: "paid",
      "items.productId": product._id
    });
    if (!hasPaidOrder) {
      return res.status(403).json({ error: "You can rate only products you purchased" });
    }
    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid rating" });
    }
    const userId = String(req.user.id || "");
    product.userRatings = product.userRatings || [];
    const existing = product.userRatings.find((entry) => String(entry.userId) === userId);
    if (existing) {
      return res.status(409).json({ error: "You already rated this product", rating: Number(existing.rating || 0) });
    }
    product.userRatings.push({ userId, rating });
    product.ratings = product.ratings || [];
    product.ratings.push(rating);
    product.ratingsCount = product.ratings.length;
    product.avgRating = calcAvg(product.ratings);
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// comments list (Public - Only Approved)
router.get("/:id/comments", async (req, res) => {
  const comments = await Comment.find({ productId: req.params.id, isApproved: true }).sort({ createdAt: -1 });
  res.json(comments);
});

// add comment (auth)
router.post("/:id/comments", requireAuth, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (text.length < 2) return res.status(400).json({ error: "Comment too short" });
  if (text.length > 500) return res.status(400).json({ error: "Comment too long" });

  const user = await User.findById(req.user.id).select("name");
  const comment = new Comment({
    productId: req.params.id,
    userId: req.user.id,
    userName: user?.name || req.user.name || "User",
    text,
    isApproved: false // Requires Admin Approval
  });
  await comment.save();
  res.json(comment);
});

// delete product
router.delete("/:id", requirePermission("product.write"), async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;


