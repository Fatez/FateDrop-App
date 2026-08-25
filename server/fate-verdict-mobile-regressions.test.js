'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareGroups, rankGroups } = require('./fate-verdict');

function packGroup(id, packCount, itemPriceGbp, deliveryGbp = 0, overrides = {}) {
  return {
    id,
    title: `${packCount} pack bundle`,
    valueFamilyKey: 'destined-rivals-booster-packs',
    unitCount: packCount,
    unitKind: 'booster_pack',
    unitRrpGbp: 4.29,
    rrpKind: 'pack_reference',
    rrpSource: 'official-pack-reference',
    offers: [{
      id: `${id}:offer`, retailerId: id, retailerName: id,
      priceGbp: itemPriceGbp, shippingGbp: deliveryGbp,
      totalDeliveredGbp: itemPriceGbp + deliveryGbp,
      deliveryKnown: true, stockStatus: 'IN_STOCK',
    }],
    ...overrides,
  };
}

test('exact RRP beats an above-RRP candidate', () => {
  assert.equal(compareGroups(packGroup('exact', 4, 17.16), packGroup('above', 4, 18)).winnerId, 'exact');
});

test('per-unit fallback requires the same verified family and known True Price', () => {
  const left = packGroup('left', 4, 20);
  const right = packGroup('right', 10, 40);
  delete left.unitRrpGbp;
  delete right.unitRrpGbp;
  const verdict = compareGroups(left, right);
  assert.equal(verdict.winnerId, 'right');
  assert.equal(verdict.basis, 'unit_true_price');
  right.valueFamilyKey = 'different-product-family';
  assert.equal(compareGroups(left, right).winnerId, null);
});

test('global ranking refuses a comparable candidate with missing RRP', () => {
  const known = packGroup('known', 4, 20);
  const missing = packGroup('missing', 10, 40);
  delete missing.unitRrpGbp;
  assert.equal(rankGroups([known, missing]).winnerId, null);
});

test('unit fallback refuses unknown delivery rather than assuming free delivery', () => {
  const left = packGroup('left', 4, 20);
  const right = packGroup('right', 10, 40);
  delete left.unitRrpGbp;
  delete right.unitRrpGbp;
  right.offers[0].deliveryKnown = false;
  delete right.offers[0].shippingGbp;
  delete right.offers[0].totalDeliveredGbp;
  assert.equal(compareGroups(left, right).winnerId, null);
});
