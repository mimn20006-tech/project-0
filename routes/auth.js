const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/user");
const { requireAuth, requirePermission, JWT_SECRET } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");
const { normalizeRole, mergePermissions } = require("../utils/permissions");

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
  const role = normalizeRole(user.role);
  const permissions = mergePermissions(role, user.permissions || []);
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name, role, permissions, phone: user.phone, country: user.country, address: user.address, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
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
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, country: user.country, address: user.address, avatar: user.avatar } });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
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
    const user = await User.findOne({ email, role: { $in: ["admin", "manager", "editor"] } });
    if (!user) {
      logAdminAuthFailure(email, "not_found", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      logAdminAuthFailure(email, "wrong_password", req.ip, req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const force2fa = String(process.env.ADMIN_2FA_REQUIRED || "").toLowerCase() === "true";
    const should2fa = force2fa || user.adminTwoFactorEnabled;
    if (should2fa) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      user.adminTwoFactorCode = code;
      user.adminTwoFactorExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      try {
        await sendMail({
          to: user.email,
          subject: "Hand Aura Admin 2FA",
          text: `رمز التحقق: ${code}`
        });
      } catch {}
      return res.json({
        requires2fa: true,
        adminId: user._id
      });
    }

    const token = makeToken(user);
    logLoginSuccess("admin", email, req.ip, req.headers["user-agent"]);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    logAdminAuthFailure(req.body?.email, "error", req.ip, req.headers["user-agent"]);
    res.status(400).json({ error: err.message });
  }
});

router.post("/admin/verify-2fa", async (req, res) => {
  try {
    const { adminId, code } = req.body || {};
    if (!adminId || !code) return res.status(400).json({ error: "Missing fields" });
    const user = await User.findOne({ _id: adminId, role: "admin" });
    if (!user) return res.status(404).json({ error: "Admin not found" });
    if (!user.adminTwoFactorCode || user.adminTwoFactorCode !== String(code)) {
      return res.status(400).json({ error: "Invalid code" });
    }
    if (!user.adminTwoFactorExpires || user.adminTwoFactorExpires < new Date()) {
      return res.status(400).json({ error: "Code expired" });
    }
    user.adminTwoFactorCode = undefined;
    user.adminTwoFactorExpires = undefined;
    await user.save();
    const token = makeToken(user);
    logLoginSuccess("admin-2fa", user.email, req.ip, req.headers["user-agent"]);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/admin/exists", async (req, res) => {
  const existingAdmin = await User.findOne({ role: "admin" });
  res.json({ exists: !!existingAdmin });
});

router.get("/admin/users", requirePermission("role.manage"), async (req, res) => {
  const users = await User.find().select("name email role permissions createdAt").sort({ createdAt: -1 });
  res.json(users);
});

router.put("/admin/users/:id", requirePermission("role.manage"), async (req, res) => {
  const role = normalizeRole(req.body?.role);
  const permissions = Array.isArray(req.body?.permissions)
    ? req.body.permissions.map((p) => String(p || "").trim()).filter(Boolean)
    : [];
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role, permissions },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true, user: { id: user._id, email: user.email, role: user.role, permissions: user.permissions || [] } });
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

router.put("/admin/2fa", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const enabled = !!req.body?.enabled;
    await User.findByIdAndUpdate(req.user.id, { adminTwoFactorEnabled: enabled });
    res.json({ ok: true, enabled });
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
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, country: user.country, address: user.address, avatar: user.avatar } });
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
    res.status(400).json({ error: err.message });
  }
});

router.post("/resend", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing fields" });
    const user = await User.findOne({ email });
    if (!user) return res.json({ ok: true });
    if (user.emailVerified) return res.json({ ok: true });
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verifyCode = verifyCode;
    await user.save();
    await sendMail({
      to: email,
      subject: "Hand Aura - تأكيد الحساب",
      text: `رمز تأكيد الحساب: ${verifyCode}`
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    res.json({ ok: true });
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
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, country: user.country, address: user.address, avatar: user.avatar } });
});

router.put("/profile", requireAuth, upload.fields([
  { name: "avatar", maxCount: 1 },
  { name: "avatarFile", maxCount: 1 },
  { name: "profileImage", maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, phone, country, address } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (country !== undefined) user.country = country;
    if (address !== undefined) user.address = address;
    const avatarFile =
      req.files?.avatar?.[0] ||
      req.files?.avatarFile?.[0] ||
      req.files?.profileImage?.[0];
    if (avatarFile) {
      user.avatar = `/uploads/${avatarFile.filename}`;
    }
    await user.save();
    const token = makeToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, country: user.country, address: user.address, avatar: user.avatar } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
