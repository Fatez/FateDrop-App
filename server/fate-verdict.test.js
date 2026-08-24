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
      id: `${id}:offer`,
      retailerId: id,
      retailerName: id,
      priceGbp: itemPriceGbp,
      shippingGbp: deliveryGbp,
      totalDeliveredGbp: itemPriceGbp + deliveryGbp,
      deliveryKnown: true,
      stockStatus: 'IN_STOCK',
    }],
    ...overrides,
  };
}

test('canonical Fate Verdict scales a verified unit RRP for the 4-pack vs 10-pack comparison', () => {
  const fourPack = packGroup('four', 4, 60);
  const tenPack = packGroup('ten', 10, 140);
  const verdict = compareGroups(fourPack, tenPack);

  assert.equal(verdict.left.rrpGbp, 17.16);
  assert.equal(verdict.right.rrpGbp, 42.9);
  assert.equal(verdict.left.reference.scaledFromUnit, true);
  assert.equal(verdict.right.reference.scaledFromUnit, true);
  assert.equal(verdict.winnerId, 'ten');
  assert.equal(verdict.basis, 'rrp_percent');
  assert.ok(Math.abs(verdict.left.rrpPercent - 249.65034965034965) < 1e-6);
  assert.ok(Math.abs(verdict.right.rrpPercent - 226.34032634032635) < 1e-6);
});

test('below RRP beats above RRP', () => {
  assert.equal(compareGroups(packGroup('below', 4, 16), packGroup('above', 4, 18)).winnerId, 'below');
});

test('exact RRP beats an above-RRP candidate', () => {
  assert.equal(compareGroups(packGroup('exact', 4, 17.16), packGroup('above', 4, 18)).winnerId, 'exact');
});

test('same RRP percentage uses lower known True Price as the tie-break', () => {
  assert.equal(compareGroups(packGroup('left', 4, 20, 6), packGroup('right', 4, 20, 2)).winnerId, 'right');
});

test('unknown delivery remains unknown and cannot be used as a True Price tie-break', () => {
  const known = packGroup('known', 4, 20, 2);
  const unknown = packGroup('unknown', 4, 20);
  unknown.offers[0].deliveryKnown = false;
  delete unknown.offers[0].shippingGbp;
  delete unknown.offers[0].totalDeliveredGbp;
  const verdict = compareGroups(known, unknown);

  assert.equal(verdict.winnerId, null);
  assert.equal(verdict.right.truePrice, null);
  assert.equal(verdict.right.checkoutCost, null);
  assert.equal(verdict.right.truePriceEvidence.deliveryGbp, null);
  assert.equal(verdict.right.truePriceEvidence.totalGbp, null);
});

test('missing verified RRP on either side blocks an RRP winner', () => {
  const missing = packGroup('missing', 4, 10);
  delete missing.unitRrpGbp;
  assert.equal(compareGroups(packGroup('known', 4, 20), missing).winnerId, null);
});

test('incompatible value families never receive a canonical winner', () => {
  const different = packGroup('different', 10, 30, 0, { valueFamilyKey: 'different-product-family' });
  assert.equal(compareGroups(packGroup('known', 4, 20), different).winnerId, null);
});

test('per-unit fallback is allowed only for the same verified family and unit kind with known True Price', () => {
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

test('global ranking refuses to ignore a comparable candidate with missing RRP', () => {
  const known = packGroup('known', 4, 20);
  const missing = packGroup('missing', 10, 40);
  delete missing.unitRrpGbp;
  assert.equal(rankGroups([known, missing]).winnerId, null);
});

test('global ranking refuses mixed identities/value families', () => {
  const different = packGroup('different', 10, 40, 0, { valueFamilyKey: 'different-product-family' });
  assert.equal(rankGroups([packGroup('known', 4, 20), different]).winnerId, null);
});

test('RRP without provenance is not treated as verified', () => {
  const unverified = packGroup('unverified', 4, 20);
  delete unverified.rrpSource;
  const verdict = compareGroups(unverified, packGroup('verified', 4, 18));
  assert.equal(verdict.winnerId, null);
  assert.equal(verdict.left.rrpGbp, null);
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
