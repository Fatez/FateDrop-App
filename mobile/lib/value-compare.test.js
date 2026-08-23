const test = require('node:test');
const assert = require('node:assert/strict');
const { compareValueGroups, rrpBasisLabel, valuePosition } = require('./value-compare');

function group({ id, title, price, delivered, rrp, units, kind = 'component_reference', unitKind = 'booster_pack' }) {
  return {
    id,
    title,
    rrpGbp: rrp,
    rrpKind: kind,
    unitCount: units,
    unitKind,
    offers: [{
      id: `${id}-offer`,
      retailerName: 'Test Retailer',
      priceGbp: price,
      totalDeliveredGbp: delivered,
      deliveryKnown: delivered != null,
    }],
  };
}

test('mobile compare chooses the lower RRP/reference inflation before sticker price', () => {
  const fourPack = group({ id: 'four', title: 'Destined Rivals 4 Pack Bundle', price: 66.95, delivered: 70.94, rrp: 17.16, units: 4 });
  const tenPack = group({ id: 'ten', title: 'Destined Rivals 10 Pack Bundle', price: 166.95, delivered: 170.94, rrp: 42.90, units: 10 });

  const result = compareValueGroups(fourPack, tenPack);
  assert.equal(result.basis, 'rrp');
  assert.equal(result.winnerId, 'ten');
  assert.ok(result.gap > 0 && result.gap < 2);
});

test('RRP percentage always uses item price while unit cost can use delivered True Price', () => {
  const item = group({ id: 'four', title: 'Four pack', price: 20, delivered: 24, rrp: 16, units: 4 });
  const value = valuePosition(item);

  assert.equal(value.rrpPercent, 25);
  assert.equal(value.unitCost, 6);
  assert.equal(value.provisional, false);
});

test('unknown delivery remains provisional and is never invented as free', () => {
  const item = group({ id: 'four', title: 'Four pack', price: 20, delivered: null, rrp: 16, units: 4 });
  const value = valuePosition(item);

  assert.equal(value.rrpPercent, 25);
  assert.equal(value.unitCost, 5);
  assert.equal(value.provisional, true);
});

test('component and pack RRP provenance stays visible on mobile', () => {
  assert.equal(rrpBasisLabel(group({ id: 'a', title: 'A', price: 10, delivered: 10, rrp: 8, units: 2 })), 'Component RRP reference');
  assert.equal(rrpBasisLabel(group({ id: 'b', title: 'B', price: 5, delivered: 5, rrp: 4, units: 1, kind: 'pack_reference' })), 'Pack RRP reference');
  assert.equal(rrpBasisLabel(group({ id: 'c', title: 'C', price: 5, delivered: 5, rrp: 4, units: 1, kind: 'official' })), 'Verified official RRP');
});
