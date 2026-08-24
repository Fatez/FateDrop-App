'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compareGroups, rankGroups } = require('./fate-verdict');

function packGroup(id, packCount, itemPriceGbp, deliveryGbp = 0) {
  const unitRrpGbp = 4.29;
  return {
    id,
    title: `${packCount} pack bundle`,
    unitCount: packCount,
    unitKind: 'booster_pack',
    unitRrpGbp,
    rrpGbp: unitRrpGbp * packCount,
    rrpKind: 'pack_reference',
    offers: [{
      id: `${id}:offer`,
      retailerId: id,
      retailerName: id,
      priceGbp: itemPriceGbp,
      shippingGbp: deliveryGbp,
      totalDeliveredGbp: itemPriceGbp + deliveryGbp,
      deliveryKnown: true,
    }],
  };
}

test('canonical Fate Verdict compares bundle price against its scaled RRP basis, not sticker price', () => {
  const fourPack = packGroup('four', 4, 60);
  const tenPack = packGroup('ten', 10, 140);
  const verdict = compareGroups(fourPack, tenPack);

  assert.equal(fourPack.rrpGbp, 17.16);
  assert.equal(tenPack.rrpGbp, 42.9);
  assert.equal(verdict.winnerId, 'ten');
  assert.equal(verdict.basis, 'rrp_percent');
  assert.ok(verdict.left.rrpPercent > verdict.right.rrpPercent);
});

test('ranking chooses the best value across all searched groups rather than the lowest sticker price', () => {
  const verdict = rankGroups([
    packGroup('four', 4, 60),
    packGroup('ten', 10, 140),
    packGroup('six', 6, 95),
  ]);
  assert.equal(verdict.winnerId, 'ten');
  assert.equal(verdict.basis, 'rrp_percent');
});

test('RRP percentage remains item-price based while known delivery contributes to True Price per unit', () => {
  const left = packGroup('left', 4, 20, 10);
  const right = packGroup('right', 4, 22, 0);
  const verdict = compareGroups(left, right);

  assert.equal(verdict.winnerId, 'left');
  assert.equal(verdict.basis, 'rrp_percent');
  assert.equal(verdict.left.truePrice, 30);
  assert.equal(verdict.right.truePrice, 22);
});

test('unknown delivery is provisional and is never invented as free', () => {
  const group = packGroup('unknown', 4, 20);
  group.offers[0].deliveryKnown = false;
  delete group.offers[0].shippingGbp;
  delete group.offers[0].totalDeliveredGbp;
  const verdict = rankGroups([group]);

  assert.equal(verdict.ranking[0].truePrice, null);
  assert.equal(verdict.ranking[0].provisional, true);
});
