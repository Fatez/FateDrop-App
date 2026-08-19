const test = require('node:test');
const assert = require('node:assert/strict');
const { stockEvents } = require('./push');

test('only stock arrival events trigger push notifications', () => {
  const events = ['RESTOCK', 'NEW_PRODUCT_LIVE', 'SOLD_OUT', 'NEW_PRODUCT', 'PRICE_CHANGE'].map((type) => ({ type }));
  assert.deepEqual(stockEvents(events).map((event) => event.type), ['RESTOCK', 'NEW_PRODUCT_LIVE']);
});
