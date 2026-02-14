const ROLE_PERMISSIONS = {
  admin: ["*"],
  manager: [
    "dashboard.read",
    "product.read",
    "product.write",
    "order.read",
    "order.update",
    "comment.read",
    "comment.moderate",
    "coupon.manage",
    "report.read",
    "payment.manage",
    "marketing.manage",
    "settings.manage",
    "translation.manage"
  ],
  editor: [
    "dashboard.read",
    "product.read",
    "product.write",
    "comment.read",
    "comment.moderate",
    "translation.manage"
  ],
  user: []
};

function normalizeRole(role) {
  const value = String(role || "user").trim().toLowerCase();
  if (["admin", "manager", "editor", "user"].includes(value)) return value;
  return "user";
}

function getRolePermissions(role) {
  return [...(ROLE_PERMISSIONS[normalizeRole(role)] || [])];
}

function mergePermissions(role, extra = []) {
  const base = new Set(getRolePermissions(role));
  (Array.isArray(extra) ? extra : []).forEach((p) => {
    const key = String(p || "").trim();
    if (key) base.add(key);
  });
  return [...base];
}

function hasPermission(userPayload, permission) {
  if (!permission) return true;
  const perms = Array.isArray(userPayload?.permissions) ? [...userPayload.permissions] : [];
  const role = normalizeRole(userPayload?.role);
  // Backward compatibility for older tokens that do not include permissions.
  if (!perms.length) perms.push(...getRolePermissions(role));
  return perms.includes("*") || perms.includes(permission);
}

module.exports = {
  ROLE_PERMISSIONS,
  normalizeRole,
  getRolePermissions,
  mergePermissions,
  hasPermission
};
