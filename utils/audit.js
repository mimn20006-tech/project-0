const AuditLog = require("../models/auditLog");

async function writeAudit({
  req,
  action,
  targetType,
  targetId,
  metadata
}) {
  try {
    await AuditLog.create({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: metadata || {}
    });
  } catch {}
}

module.exports = { writeAudit };

