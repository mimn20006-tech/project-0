const router = require("express").Router();
const mongoose = require("mongoose");
const Order = require("../models/order");
const Product = require("../models/product");
const AuditLog = require("../models/auditLog");
const { requirePermission } = require("../middleware/auth");

function parseDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

router.get("/sales", requirePermission("report.read"), async (req, res) => {
  const now = new Date();
  const from = parseDate(req.query.from, new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  const to = parseDate(req.query.to, now);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const match = { createdAt: { $gte: from, $lte: end } };
  const orders = await Order.find(match).lean();

  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.paymentStatus === "paid").length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const paidRevenue = orders
    .filter(o => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  const byPaymentMethod = {};
  orders.forEach((o) => {
    const key = o.paymentMethod || "unknown";
    byPaymentMethod[key] = (byPaymentMethod[key] || 0) + Number(o.total || 0);
  });

  const daily = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" }
        },
        revenue: { $sum: "$total" },
        orders: { $sum: 1 },
        paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } }
      }
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } }
  ]);

  const topProducts = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        qty: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        name: { $first: "$items.name" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    from,
    to: end,
    totals: {
      totalOrders,
      paidOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paidRevenue: Math.round(paidRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100
    },
    byPaymentMethod,
    daily: daily.map((d) => ({
      date: `${d._id.y}-${String(d._id.m).padStart(2, "0")}-${String(d._id.d).padStart(2, "0")}`,
      orders: d.orders,
      paidOrders: d.paidOrders,
      revenue: Math.round(Number(d.revenue || 0) * 100) / 100
    })),
    topProducts: topProducts.map((p) => ({
      productId: p._id ? String(p._id) : "",
      name: p.name,
      qty: Number(p.qty || 0),
      revenue: Math.round(Number(p.revenue || 0) * 100) / 100
    }))
  });
});

router.get("/inventory", requirePermission("report.read"), async (req, res) => {
  const products = await Product.find().lean();
  const lowStock = products.filter((p) => Number(p.stock || 0) <= 5);
  res.json({
    totalProducts: products.length,
    lowStockCount: lowStock.length,
    lowStock: lowStock.map((p) => ({
      id: String(p._id),
      name: p.name,
      stock: Number(p.stock || 0),
      price: Number(p.price || 0)
    }))
  });
});

router.get("/audit", requirePermission("report.read"), async (req, res) => {
  const limit = Math.min(500, Math.max(20, Number(req.query.limit || 100)));
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  res.json(logs);
});

router.get("/payments-health", requirePermission("report.read"), async (req, res) => {
  const hours = Math.min(168, Math.max(1, Number(req.query.hours || 24)));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const logs = await AuditLog.find({
    action: { $in: ["payment.webhook", "payment.webhook_error"] },
    createdAt: { $gte: since }
  }).sort({ createdAt: -1 }).lean();

  const webhookLogs = logs.filter((l) => l.action === "payment.webhook");
  const errorLogs = logs.filter((l) => l.action === "payment.webhook_error");

  const processing = webhookLogs
    .map((l) => Number(l?.metadata?.processingMs || 0))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const avgProcessingMs = processing.length
    ? Math.round(processing.reduce((a, b) => a + b, 0) / processing.length)
    : 0;

  const paidNow = webhookLogs.filter((l) => l?.metadata?.paymentResult === "paid_now").length;
  const duplicates = webhookLogs.filter((l) => l?.metadata?.paymentResult === "already_paid").length;
  const notFound = webhookLogs.filter((l) => l?.metadata?.paymentResult === "not_found").length;
  const ignored = webhookLogs.filter((l) => l?.metadata?.ignored === true).length;

  const byProvider = {};
  webhookLogs.forEach((l) => {
    const p = String(l?.metadata?.provider || "unknown");
    byProvider[p] = (byProvider[p] || 0) + 1;
  });

  res.json({
    from: since,
    hours,
    totals: {
      webhookEvents: webhookLogs.length,
      webhookErrors: errorLogs.length,
      paidNow,
      duplicates,
      notFound,
      ignored,
      avgProcessingMs
    },
    byProvider,
    latest: logs.slice(0, 50)
  });
});

module.exports = router;
