const test = require("node:test");
const assert = require("node:assert/strict");

const ordersRouter = require("../routes/orders");
const Product = require("../models/product");
const Order = require("../models/order");

function getPostHandler(path) {
  const layer = ordersRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods.post);
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

test("create order fails when cart is empty", async () => {
  const handler = getPostHandler("/");
  const req = { body: { items: [] } };
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error, "Cart is empty");
});

test("create order rolls back created order when stock update fails", async () => {
  const handler = getPostHandler("/");

  const originalProductFind = Product.find;
  const originalProductBulkWrite = Product.bulkWrite;
  const originalOrderSave = Order.prototype.save;
  const originalOrderDelete = Order.findByIdAndDelete;

  let deletedOrderId = null;

  Product.find = async () => ([
    {
      _id: "p1",
      name: "Hoodie",
      stock: 10,
      price: 500,
      images: []
    }
  ]);
  Product.bulkWrite = async () => {
    throw new Error("STOCK_WRITE_FAILED");
  };
  Order.prototype.save = async function saveMock() {
    this._id = "order-rollback-1";
    return this;
  };
  Order.findByIdAndDelete = async (id) => {
    deletedOrderId = String(id);
    return { _id: id };
  };

  const req = {
    body: {
      customerName: "User",
      customerEmail: "u@example.com",
      customerPhone: "01000000000",
      address: "Cairo",
      paymentMethod: "visa",
      items: [{ productId: "p1", quantity: 1 }]
    }
  };
  const res = createRes();

  try {
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, "STOCK_WRITE_FAILED");
    assert.ok(deletedOrderId, "expected rollback delete to run");
  } finally {
    Product.find = originalProductFind;
    Product.bulkWrite = originalProductBulkWrite;
    Order.prototype.save = originalOrderSave;
    Order.findByIdAndDelete = originalOrderDelete;
  }
});
