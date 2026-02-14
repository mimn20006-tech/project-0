const router = require("express").Router();
const Setting = require("../models/setting");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requirePermission } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads");
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
  limits: { fileSize: 2 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  }
});

router.get("/hero", async (req, res) => {
  const doc = await Setting.findOne({ key: "heroImages" });
  res.json({ images: doc?.value || [] });
});

router.put("/hero", requirePermission("settings.manage"), upload.any(), async (req, res) => {
  const images = (req.files || [])
    .filter((f) => ["images", "heroImages", "heroImage"].includes(f.fieldname))
    .map((f) => `/uploads/${f.filename}`);
  const doc = await Setting.findOneAndUpdate(
    { key: "heroImages" },
    { value: images },
    { upsert: true, new: true }
  );
  res.json({ images: doc.value });
});

router.delete("/hero", requirePermission("settings.manage"), async (req, res) => {
  const img = req.query.img;
  const doc = await Setting.findOne({ key: "heroImages" });
  const images = (doc?.value || []).filter(i => i !== img);
  await Setting.findOneAndUpdate(
    { key: "heroImages" },
    { value: images },
    { upsert: true, new: true }
  );
  res.json({ images });
});

router.get("/shop", async (req, res) => {
  const doc = await Setting.findOne({ key: "shopFilters" });
  res.json({ filters: doc?.value || null });
});

router.put("/shop", requirePermission("settings.manage"), async (req, res) => {
  const filters = req.body?.filters || req.body;
  const doc = await Setting.findOneAndUpdate(
    { key: "shopFilters" },
    { value: filters },
    { upsert: true, new: true }
  );
  res.json({ filters: doc.value });
});

router.get("/site", async (req, res) => {
  const doc = await Setting.findOne({ key: "siteMeta" });
  res.json({ site: doc?.value || null });
});

router.put("/site", requirePermission("settings.manage"), upload.any(), async (req, res) => {
  const body = req.body || {};
  const current = await Setting.findOne({ key: "siteMeta" });
  const prev = current?.value || {};

  const files = Array.isArray(req.files) ? req.files : [];
  const heroFile = files.find((f) => ["heroImage", "siteHeroImage"].includes(f.fieldname));
  const siteFile = files.find((f) => ["siteImage", "image"].includes(f.fieldname));
  const uploadedImage = siteFile || heroFile;

  const next = {
    title: body.title !== undefined ? body.title : prev.title,
    description: body.description !== undefined ? body.description : prev.description,
    heroImage: prev.heroImage,
    image: prev.image
  };

  if (uploadedImage) {
    const imagePath = `/uploads/${uploadedImage.filename}`;
    next.image = imagePath;
    next.heroImage = imagePath;
  }

  const doc = await Setting.findOneAndUpdate(
    { key: "siteMeta" },
    { value: next },
    { upsert: true, new: true }
  );
  res.json({ site: doc.value });
});

router.get("/i18n", async (req, res) => {
  const doc = await Setting.findOne({ key: "i18n" });
  const value = doc?.value || {};
  res.json({
    defaultLang: value.defaultLang || "ar",
    languages: Array.isArray(value.languages) ? value.languages : ["ar", "en"],
    dict: value.dict || {}
  });
});

router.put("/i18n", requirePermission("translation.manage"), async (req, res) => {
  const payload = req.body || {};
  const next = {
    defaultLang: String(payload.defaultLang || "ar"),
    languages: Array.isArray(payload.languages)
      ? payload.languages.map((l) => String(l || "").trim()).filter(Boolean)
      : ["ar", "en"],
    dict: payload.dict && typeof payload.dict === "object" ? payload.dict : {}
  };
  const doc = await Setting.findOneAndUpdate(
    { key: "i18n" },
    { value: next },
    { upsert: true, new: true }
  );
  res.json({ i18n: doc.value });
});

module.exports = router;

