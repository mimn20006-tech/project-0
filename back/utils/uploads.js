const fs = require("fs");
const path = require("path");

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "..", "uploads");
const legacyUploadDir = path.join(__dirname, "..", "uploads");

function ensureUploadDir() {
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

function getUploadDir() {
  return ensureUploadDir();
}

function toUploadUrl(filename) {
  return `/uploads/${filename}`;
}

function migrateLegacyUploads() {
  const target = ensureUploadDir();
  if (path.resolve(target) === path.resolve(legacyUploadDir)) return;
  if (!fs.existsSync(legacyUploadDir)) return;
  const files = fs.readdirSync(legacyUploadDir, { withFileTypes: true });
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const src = path.join(legacyUploadDir, entry.name);
    const dst = path.join(target, entry.name);
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
    }
  }
}

module.exports = {
  getUploadDir,
  toUploadUrl,
  migrateLegacyUploads
};
