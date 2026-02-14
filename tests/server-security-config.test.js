const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverFile = path.join(__dirname, "..", "server.js");
const src = fs.readFileSync(serverFile, "utf8");

test("stripe raw body parser is registered before express.json", () => {
  const rawIdx = src.indexOf('app.use("/api/payments/webhook/stripe", express.raw');
  const jsonIdx = src.indexOf("app.use(express.json");
  assert.ok(rawIdx >= 0, "stripe raw parser middleware not found");
  assert.ok(jsonIdx >= 0, "express.json middleware not found");
  assert.ok(rawIdx < jsonIdx, "stripe raw parser must be before express.json");
});

test("security middlewares are enabled", () => {
  assert.ok(src.includes("app.use(helmet("), "helmet is not enabled");
  assert.ok(src.includes("const generalLimiter = rateLimit("), "rate limiting is not configured");
  assert.ok(src.includes("app.use(cors("), "CORS middleware is not configured");
});
