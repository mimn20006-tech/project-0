const router = require("express").Router();
const User = require("../models/user");
const Product = require("../models/product");
const Order = require("../models/order");
const Setting = require("../models/setting");
const AbandonedCart = require("../models/abandonedCart");
const { requirePermission } = require("../middleware/auth");
const { normalizeRole } = require("../utils/permissions");
const { writeAudit } = require("../utils/audit");

router.get("/users", requirePermission("dashboard.read"), async (req, res) => {
  const users = await User.find()
    .select("_id name email role createdAt")
    .sort({ createdAt: -1 })
    .lean();
  res.json(users);
});

router.put("/users/:id/role", requirePermission("settings.manage"), async (req, res) => {
  const role = normalizeRole(req.body?.role);
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select("_id name email role");
  if (!user) return res.status(404).json({ error: "User not found" });
  await writeAudit({
    req,
    action: "admin.user_role_update",
    targetType: "user",
    targetId: user._id,
    metadata: { role }
  });
  res.json(user);
});

router.get("/alerts/stock", requirePermission("report.read"), async (req, res) => {
  const setting = await Setting.findOne({ key: "lowStockThreshold" }).lean();
  const threshold = Math.max(1, Number(setting?.value || 5));
  const lowStock = await Product.find({ stock: { $lte: threshold } })
    .select("_id name stock price")
    .sort({ stock: 1, updatedAt: -1 })
    .lean();
  res.json({ threshold, count: lowStock.length, products: lowStock });
});

router.put("/alerts/stock-threshold", requirePermission("settings.manage"), async (req, res) => {
  const threshold = Math.max(1, Number(req.body?.threshold || 5));
  await Setting.findOneAndUpdate(
    { key: "lowStockThreshold" },
    { value: threshold },
    { upsert: true, new: true }
  );
  await writeAudit({
    req,
    action: "admin.stock_threshold_update",
    targetType: "setting",
    targetId: "lowStockThreshold",
    metadata: { threshold }
  });
  res.json({ ok: true, threshold });
});

router.get("/dashboard/overview", requirePermission("dashboard.read"), async (req, res) => {
  const [usersCount, productsCount, activeAbandoned, paidOrders, pointsTotal] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
    AbandonedCart.countDocuments({ status: "active" }),
    Order.countDocuments({ paymentStatus: "paid" }),
    User.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ["$loyaltyPoints", 0] } } } }])
  ]);
  res.json({
    usersCount,
    productsCount,
    paidOrders,
    activeAbandoned,
    loyaltyPointsIssued: Number(pointsTotal?.[0]?.total || 0)
  });
});

module.exports = router;
