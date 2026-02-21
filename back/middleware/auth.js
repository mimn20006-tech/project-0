const jwt = require("jsonwebtoken");
const { hasPermission } = require("../utils/permissions");

const JWT_SECRET = process.env.JWT_SECRET || "hoodie-dev-secret";

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
  } catch {}
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user?.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    });
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!hasPermission(req.user, permission)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    });
  };
}

module.exports = { requireAuth, optionalAuth, requireAdmin, requireRole, requirePermission, JWT_SECRET };
