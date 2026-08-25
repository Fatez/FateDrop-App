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
    offers: [{ id: `${id}:offer`, retailerId: id, retailerName: id, priceGbp: itemPriceGbp, shippingGbp: deliveryGbp, totalDeliveredGbp: itemPriceGbp + deliveryGbp, deliveryKnown: true, stockStatus: 'IN_STOCK' }],
    ...overrides,
  };
}

test('canonical Fate Verdict scales verified unit RRP', () => {
  const fourPack = packGroup('four', 4, 60);
  const tenPack = packGroup('ten', 10, 140);
  const verdict = compareGroups(fourPack, tenPack);
  assert.equal(verdict.left.rrpGbp, 17.16);
  assert.equal(verdict.right.rrpGbp, 42.9);
  assert.equal(verdict.winnerId, 'ten');
  assert.equal(verdict.basis, 'rrp_percent');
});

test('below RRP beats above RRP', () => { assert.equal(compareGroups(packGroup('below', 4, 16), packGroup('above', 4, 18)).winnerId, 'below'); });
test('same RRP percentage uses lower known True Price as tie-break', () => { assert.equal(compareGroups(packGroup('left', 4, 20, 6), packGroup('right', 4, 20, 2)).winnerId, 'right'); });
test('unknown delivery cannot become a fake True Price tie-break', () => { const known=packGroup('known',4,20,2), unknown=packGroup('unknown',4,20); unknown.offers[0].deliveryKnown=false; delete unknown.offers[0].shippingGbp; delete unknown.offers[0].totalDeliveredGbp; const verdict=compareGroups(known,unknown); assert.equal(verdict.winnerId,null); assert.equal(verdict.right.truePrice,null); });
test('missing verified RRP on either side blocks an RRP winner', () => { const missing=packGroup('missing',4,10); delete missing.unitRrpGbp; assert.equal(compareGroups(packGroup('known',4,20),missing).winnerId,null); });
test('incompatible value families never receive a canonical winner', () => { const different=packGroup('different',10,30,0,{valueFamilyKey:'different-product-family'}); assert.equal(compareGroups(packGroup('known',4,20),different).winnerId,null); });
test('global ranking refuses mixed families', () => { const different=packGroup('different',10,40,0,{valueFamilyKey:'different-product-family'}); assert.equal(rankGroups([packGroup('known',4,20),different]).winnerId,null); });
test('RRP without provenance is not verified', () => { const unverified=packGroup('unverified',4,20); delete unverified.rrpSource; const verdict=compareGroups(unverified,packGroup('verified',4,18)); assert.equal(verdict.winnerId,null); assert.equal(verdict.left.rrpGbp,null); });