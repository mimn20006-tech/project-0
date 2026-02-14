const crypto = require("crypto");

const KEY_HEX = process.env.DATA_ENCRYPTION_KEY || "";
const KEY = KEY_HEX && KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, "hex") : null;

function isEnabled() {
  return !!KEY;
}

function encryptText(value) {
  const text = String(value || "");
  if (!text || !KEY) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptText(value) {
  const text = String(value || "");
  if (!text.startsWith("enc:") || !KEY) return text;
  const [, ivHex, tagHex, dataHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

module.exports = { encryptText, decryptText, encryptionEnabled: isEnabled };

