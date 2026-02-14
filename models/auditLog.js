const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorEmail: String,
  actorRole: String,
  action: { type: String, index: true },
  targetType: String,
  targetId: String,
  ip: String,
  userAgent: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);

