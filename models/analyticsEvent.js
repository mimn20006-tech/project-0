const mongoose = require("mongoose");

const AnalyticsEventSchema = new mongoose.Schema({
  name: { type: String, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sessionId: String,
  path: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);

