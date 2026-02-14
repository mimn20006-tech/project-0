const test = require("node:test");
const assert = require("node:assert/strict");

const paymentsRouter = require("../routes/payments");

function getPostHandler(path) {
  const layer = paymentsRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods.post);
  if (!layer) throw new Error(`Route not found: POST ${path}`);
  const routeStack = layer.route.stack || [];
  return routeStack[routeStack.length - 1].handle;
}

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("paymob hmac source is deterministic and ordered", () => {
  const obj = {
    amount_cents: 25000,
    created_at: "2026-02-14T00:00:00.000Z",
    currency: "EGP",
    error: false,
    has_parent_transaction: false,
    id: 98765,
    integration_id: 11111,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 12345 },
    owner: 555,
    pending: false,
    source_data: { pan: "411111******1111", sub_type: "MasterCard", type: "card" },
    success: true
  };
  const src = paymentsRouter.__test.paymobHmacSource(obj);
  assert.equal(
    src,
    "250002026-02-14T00:00:00.000ZEGPfalsefalse9876511111truefalsefalsefalsetruefalse12345555false411111******1111MasterCardcardtrue"
  );
});

test("paymob hmac uses sha512", () => {
  const payload = "abc123";
  const secret = "top-secret";
  const h = paymentsRouter.__test.makePaymobHmac(payload, secret);
  assert.equal(typeof h, "string");
  assert.equal(h.length, 128);
});

test("timing-safe compare works for hex signatures", () => {
  const a = "aa".repeat(32);
  const b = "aa".repeat(32);
  const c = "ab".repeat(32);
  assert.equal(paymentsRouter.__test.timingSafeEqualHex(a, b), true);
  assert.equal(paymentsRouter.__test.timingSafeEqualHex(a, c), false);
  assert.equal(paymentsRouter.__test.timingSafeEqualHex(a, "zz"), false);
});

test("checkout-session rejects order that does not belong to user", async () => {
  const Order = require("../models/order");
  const originalFindById = Order.findById;
  Order.findById = async () => ({
    _id: "order-1",
    userId: "owner-user",
    paymentMethod: "visa",
    total: 100,
    items: [{ name: "T", price: 100, quantity: 1 }],
    transactionCode: "TX-1"
  });

  const handler = getPostHandler("/checkout-session");
  const req = {
    body: { orderId: "order-1", method: "visa" },
    user: { id: "another-user" }
  };
  const res = createRes();

  try {
    await handler(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, "Forbidden");
  } finally {
    Order.findById = originalFindById;
  }
});

test("markOrderPaid is idempotent for double webhook calls", async () => {
  const calls = { updates: 0, finds: 0 };
  const fakeModel = {
    paid: false,
    async findOneAndUpdate(_filter, _update) {
      if (this.paid) return null;
      this.paid = true;
      calls.updates += 1;
      return { _id: "order-1", paymentStatus: "paid" };
    },
    findById() {
      calls.finds += 1;
      return {
        select: async () => ({ _id: "order-1" })
      };
    }
  };

  const originalFindOneAndUpdate = require("../models/order").findOneAndUpdate;
  const originalFindById = require("../models/order").findById;
  require("../models/order").findOneAndUpdate = fakeModel.findOneAndUpdate.bind(fakeModel);
  require("../models/order").findById = fakeModel.findById.bind(fakeModel);

  try {
    const first = await paymentsRouter.__test.markOrderPaid("order-1", "TX-1");
    const second = await paymentsRouter.__test.markOrderPaid("order-1", "TX-1");
    assert.equal(first, "paid_now");
    assert.equal(second, "already_paid");
    assert.equal(calls.updates, 1);
  } finally {
    require("../models/order").findOneAndUpdate = originalFindOneAndUpdate;
    require("../models/order").findById = originalFindById;
  }
});

test("paymob webhook success with valid hmac returns ok", async () => {
  process.env.PAYMOB_HMAC_SECRET = "paymob-secret";

  const Order = require("../models/order");
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  const originalFindById = Order.findById;

  let updates = 0;
  Order.findOneAndUpdate = async () => {
    updates += 1;
    return { _id: "order-1", paymentStatus: "paid" };
  };
  Order.findById = () => ({ select: async () => ({ _id: "order-1" }) });

  const handler = getPostHandler("/webhook/:provider");
  const obj = {
    amount_cents: 15000,
    created_at: "2026-02-14T00:00:00.000Z",
    currency: "EGP",
    error: false,
    has_parent_transaction: false,
    id: 7777,
    integration_id: 22,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 100, merchant_order_id: "order-1" },
    owner: 50,
    pending: false,
    source_data: { pan: "411111******1111", sub_type: "MasterCard", type: "card" },
    success: true
  };
  const src = paymentsRouter.__test.paymobHmacSource(obj);
  const hmac = paymentsRouter.__test.makePaymobHmac(src, process.env.PAYMOB_HMAC_SECRET);

  const req = { params: { provider: "paymob" }, body: { obj, hmac }, headers: {} };
  const res = createRes();

  try {
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(updates, 1);
  } finally {
    Order.findOneAndUpdate = originalFindOneAndUpdate;
    Order.findById = originalFindById;
  }
});

test("paymob webhook rejects invalid hmac", async () => {
  process.env.PAYMOB_HMAC_SECRET = "paymob-secret";
  const handler = getPostHandler("/webhook/:provider");
  const req = {
    params: { provider: "paymob" },
    body: { obj: { success: true, pending: false, order: { merchant_order_id: "order-1" } }, hmac: "deadbeef" },
    headers: {}
  };
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, "Invalid Paymob hmac");
});
