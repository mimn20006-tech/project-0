const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/user");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");

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
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  }
});

function logAdminAuthFailure(email, reason, ip, ua) {
  try {
    const logsDir = path.join(__dirname, "..", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const line = `[${new Date().toISOString()}] email=${email || "-"} ip=${ip || "-"} ua=${ua || "-"} reason=${reason}\n`;
    fs.appendFileSync(path.join(logsDir, "admin-auth.log"), line);
  } catch {}
}

function logLoginSuccess(scope, email, ip, ua) {
  try {
    const logsDir = path.join(__dirname, "..", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const line = `[${new Date().toISOString()}] scope=${scope} email=${email || "-"} ip=${ip || "-"} ua=${ua || "-"}\n`;
    fs.appendFileSync(path.join(logsDir, "auth-success.log"), line);
  } catch {}
}

function logLoginFailure(email, reason, ip, ua) {
  try {
    const logsDir = path.join(__dirname, "..", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const line = `[${new Date().toISOString()}] email=${email || "-"} ip=${ip || "-"} ua=${ua || "-"} reason=${reason}\n`;
    fs.appendFileSync(path.join(logsDir, "auth-fail.log"), line);
  } catch {}
}

function makeToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      country: user.country,
      address: user.address,
      avatar: user.avatar,
      loyaltyPoints: Number(user.loyaltyPoints || 0),
      loyaltySpent: Number(user.loyaltySpent || 0)
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function mapUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    country: user.country,
    address: user.address,
    avatar: user.avatar,
    loyaltyPoints: Number(user.loyaltyPoints || 0),
    loyaltySpent: Number(user.loyaltySpent || 0)
  };
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already used" });
    const passwordHash = await bcrypt.hash(password, 10);
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    const user = await User.create({ name, email, passwordHash, verifyCode, emailVerified: false });

    await sendMail({
      to: email,
      subject: "Hand Aura - تأكيد الحساب",
      text: `رمز تأكيد الحساب: ${verifyCode}`
    });

    const token = makeToken(user);
    res.json({
      token,
      mailSent: true,
      user: mapUser(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to send verification email" });
  }
});
// create admin once
router.post("/admin/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      return res.status(403).json({ error: "Admin already exists" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already used" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: "admin", emailVerified: true });
    const token = makeToken(user);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      logAdminAuthFailure(email, "missing_fields", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Missing fields" });
    }
    const user = await User.findOne({ email, role: "admin" });
    if (!user) {
      logAdminAuthFailure(email, "not_found", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      logAdminAuthFailure(email, "wrong_password", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = makeToken(user);
    logLoginSuccess("admin", email, req.ip, req.headers["user-agent"]);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    logAdminAuthFailure(req.body?.email, "error", req.ip, req.headers["user-agent"]);
    res.status(400).json({ error: err.message });
  }
});

router.get("/admin/exists", async (req, res) => {
  const existingAdmin = await User.findOne({ role: "admin" });
  res.json({ exists: !!existingAdmin });
});

router.put("/admin/password", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Invalid password" });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Wrong current password" });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      logLoginFailure(email, "missing_fields", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Missing fields" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      logLoginFailure(email, "not_found", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      logLoginFailure(email, "wrong_password", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    if (!user.emailVerified) {
      logLoginFailure(email, "email_not_verified", req.ip, req.headers["user-agent"]);
      return res.status(403).json({ error: "Email not verified" });
    }
    const token = makeToken(user);
    logLoginSuccess("user", email, req.ip, req.headers["user-agent"]);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    logLoginFailure(req.body?.email, "error", req.ip, req.headers["user-agent"]);
    res.status(400).json({ error: err.message });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  logLoginSuccess("logout-user", req.user?.email, req.ip, req.headers["user-agent"]);
  res.json({ ok: true });
});

router.post("/admin/logout", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  logLoginSuccess("logout-admin", req.user?.email, req.ip, req.headers["user-agent"]);
  res.json({ ok: true });
});

router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: "Missing fields" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.json({ ok: true });
    if (user.verifyCode !== code) return res.status(400).json({ error: "Invalid code" });
    user.emailVerified = true;
    user.verifyCode = undefined;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to resend verification email" });
  }
});

router.post("/resend", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing fields" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verifyCode = verifyCode;
    await user.save();

    await sendMail({
      to: email,
      subject: "Hand Aura - تأكيد الحساب",
      text: `رمز تأكيد الحساب: ${verifyCode}`
    });

    res.json({ ok: true, mailSent: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to send reset email" });
  }
});

router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing fields" });
    const user = await User.findOne({ email });
    if (!user) return res.json({ ok: true });
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendMail({
      to: email,
      subject: "Hand Aura - إعادة تعيين كلمة المرور",
      text: `رمز إعادة التعيين: ${resetCode}`
    });

    res.json({ ok: true, mailSent: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing fields" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Invalid password" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.resetCode || user.resetCode !== code) return res.status(400).json({ error: "Invalid code" });
    if (user.resetCodeExpires && user.resetCodeExpires < new Date()) {
      return res.status(400).json({ error: "Code expired" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: mapUser(user) });
});

router.put("/profile", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    const { name, phone, country, address } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (country !== undefined) user.country = country;
    if (address !== undefined) user.address = address;
    if (req.file) {
      user.avatar = `/uploads/${req.file.filename}`;
    }
    await user.save();
    const token = makeToken(user);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
