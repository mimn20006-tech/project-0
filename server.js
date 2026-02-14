require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const multer = require("multer");

const app = express();
const { passport } = require("./oauth");
const fs = require("fs");
app.set("trust proxy", 1);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin || origin === "null") return true;
  if (allowedOrigins.length === 0) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, cb) => {
    return cb(null, isAllowedOrigin(origin));
  }
}));
app.use("/api/payments/webhook/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(passport.initialize());

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "http://localhost:5000", "http://127.0.0.1:5000"]
    }
  }
}));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GENERAL_RATE_LIMIT_MAX || (process.env.NODE_ENV === "production" ? 400 : 5000)),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const pathName = String(req.path || "");
    // Payment providers may retry webhooks; do not throttle them here.
    if (pathName.startsWith("/api/payments/webhook/")) return true;
    // Avoid noisy local/dev lockouts while testing from browser.
    const ip = req.ip || "";
    if (process.env.NODE_ENV !== "production" && (ip === "::1" || ip.endsWith("127.0.0.1"))) return true;
    return false;
  },
  message: { error: "Too many requests, please try again later." }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
});
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6
});
app.use("/api", generalLimiter);

app.use((req, res, next) => {
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  if (safeMethods.has(req.method)) return next();
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) return next();
  return res.status(403).json({ error: "Origin is not allowed" });
});

// ملفات الصور المرفوعة
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hoodie";
const PORT = process.env.PORT || 5000;
mongoose.connect(MONGODB_URI);

app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/auth/admin/login", adminLoginLimiter);
app.use("/api/oauth", require("./routes/oauth"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/coupons", require("./routes/coupons"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/marketing", require("./routes/marketing"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/analytics", require("./routes/analytics"));

app.get("/sitemap.xml", async (req, res) => {
  try {
    const Product = require("./models/product");
    const products = await Product.find().select("_id updatedAt").lean();
    const base = (process.env.FRONTEND_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
    const urls = [
      `${base}/index.html`,
      `${base}/cart.html`,
      `${base}/track.html`,
      `${base}/orders.html`,
      `${base}/policies.html`
    ];
    const productUrls = products.map((p) => `${base}/index.html?product=${encodeURIComponent(String(p._id))}`);
    const all = [...urls, ...productUrls];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      all.map((u) => `<url><loc>${u}</loc></url>`).join("") +
      `</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  } catch (err) {
    res.status(500).send("sitemap_error");
  }
});

// serve front-end
app.use(express.static(path.join(__dirname, "..", "front")));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const field = err.field ? ` (${err.field})` : "";
    return res.status(400).json({ error: `File upload error${field}: ${err.message}` });
  }
  if (err && err.message === "Invalid file type") {
    return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
  }
  return next(err);
});

async function runSnapshotBackup() {
  try {
    if (String(process.env.AUTO_BACKUP_ENABLED || "").toLowerCase() !== "true") return;
    const Order = require("./models/order");
    const Product = require("./models/product");
    const User = require("./models/user");
    const Setting = require("./models/setting");

    const dir = path.join(__dirname, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(dir, `snapshot-${ts}.json`);
    const payload = {
      createdAt: new Date().toISOString(),
      products: await Product.find().lean(),
      orders: await Order.find().lean(),
      users: await User.find().select("-passwordHash -verifyCode -resetCode -adminTwoFactorCode").lean(),
      settings: await Setting.find().lean()
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.error("BACKUP_ERROR", err.message);
  }
}

setInterval(() => {
  runSnapshotBackup();
}, 12 * 60 * 60 * 1000);

app.listen(PORT, () => console.log("Server running"));
