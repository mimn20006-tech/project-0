const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model("Setting", SettingSchema);
