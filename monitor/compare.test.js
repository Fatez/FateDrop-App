const test = require("node:test");
const assert = require("node:assert/strict");
const { transitionProduct, compareProducts } = require("./compare");

const now = "2026-01-01T00:00:00.000Z";
const p = (availability, extra = {}) => ({ sku: "A", title: "Card", availability, ...extra });

test("new unavailable is WHISPER", () => {
  assert.equal(transitionProduct(null, p("OUT_OF_STOCK"), now).product.fateStage, "WHISPER");
});

test("new in stock is MANIFESTED", () => {
  assert.equal(transitionProduct(null, p("IN_STOCK"), now).product.fateStage, "MANIFESTED");
});

test("in stock to unavailable is VANISHED", () => {
  assert.equal(
    transitionProduct(p("IN_STOCK", { fateStage: "MANIFESTED" }), p("OUT_OF_STOCK"), now).product.fateStage,
    "VANISHED",
  );
});

test("vanished to verified stock is MANIFESTED restock, not ECHO", () => {
  const result = transitionProduct(
    p("OUT_OF_STOCK", {
      fateStage: "VANISHED",
      firstInStockAt: "2025-01-01",
      vanishedAt: "2025-02-01",
    }),
    p("IN_STOCK"),
    now,
  );
  assert.equal(result.product.fateStage, "MANIFESTED");
  assert.equal(result.events[0].type, "RESTOCK");
  assert.equal(result.product.timesRestocked, 1);
  assert.equal(result.product.returnedAt, now);
  assert.ok(!result.events.some((event) => event.fateStage === "ECHO"));
});

test("unchanged unavailable emits no event", () => {
  assert.equal(transitionProduct(p("OUT_OF_STOCK", { fateStage: "WHISPER" }), p("OUT_OF_STOCK"), now).events.length, 0);
});

test("metadata change does not manufacture Echo", () => {
  const result = transitionProduct(
    p("OUT_OF_STOCK", { fateStage: "WHISPER", price: 1 }),
    p("OUT_OF_STOCK", { price: 2 }),
    now,
  );
  assert.equal(result.product.fateStage, "WHISPER");
  assert.ok(!result.events.some((event) => event.fateStage === "ECHO"));
});

test("verified reduction preserves history", () => {
  const result = compareProducts({ A: p("IN_STOCK") }, {}, { scanVerified: true, now });
  assert.equal(result.products.A.isCurrentlyListed, false);
  assert.equal(result.products.A.fateStage, "VANISHED");
  assert.equal(result.events[0].priority, "LOW");
});

test("incomplete scan leaves database unchanged", () => {
  const old = { A: p("IN_STOCK") };
  const result = compareProducts(old, {}, { scanVerified: false, now });
  assert.equal(result.committed, false);
  assert.strictEqual(result.products, old);
});