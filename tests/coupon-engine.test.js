const test = require("node:test");
const assert = require("node:assert/strict");

test("math sanity", () => {
  const subtotal = 1000;
  const percent = subtotal * 0.1;
  const fixed = 150;
  assert.equal(percent, 100);
  assert.equal(fixed, 150);
});

