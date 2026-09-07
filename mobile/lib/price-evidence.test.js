const test = require('node:test');
const assert = require('node:assert/strict');
const { itemRrpPercent, selectWishlistPrice } = require('./price-evidence');
test('RRP premium concerns item price, independently of postage', () => {
  assert.equal(itemRrpPercent(4000,5000),-20);
  assert.equal(itemRrpPercent(null,5000),null);
  assert.equal(itemRrpPercent(4000,0),null);
});
test('unknown delivery cannot beat a verified delivered total', () => {
  const unknown = {priceGbp:40, deliveryKnown:false};
  const known = {priceGbp:43, totalDeliveredGbp:43, deliveryKnown:true};
  assert.deepEqual(selectWishlistPrice([unknown,known]),{offer:known,delivered:true});
});
test('all unknown delivery exposes an item-only comparison', () => {
  const low={priceGbp:40,deliveryKnown:false};
  assert.deepEqual(selectWishlistPrice([{priceGbp:44},low]),{offer:low,delivered:false});
});
test('invalid prices are not ranked and source order remains unchanged', () => {
  const rows=[{priceGbp:NaN},{priceGbp:30},{priceGbp:20}];
  assert.equal(selectWishlistPrice(rows).offer,rows[2]);
  assert.equal(rows[1].priceGbp,30);
  assert.equal(selectWishlistPrice([]).offer,undefined);
});
