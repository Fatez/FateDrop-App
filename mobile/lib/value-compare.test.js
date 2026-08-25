const test = require('node:test');
const assert = require('node:assert/strict');
const valueCompare = require('./value-compare');

function group(kind, rrpGbp = 4) {
  return { rrpKind: kind, rrpGbp };
}

test('mobile keeps only the presentation-only RRP basis label helper', () => {
  assert.equal(valueCompare.rrpBasisLabel(group('component_reference')), 'Component RRP reference');
  assert.equal(valueCompare.rrpBasisLabel(group('pack_reference')), 'Pack RRP reference');
  assert.equal(valueCompare.rrpBasisLabel(group('official')), 'Verified official RRP');
  assert.equal(valueCompare.rrpBasisLabel(group('source_market_msrp')), 'Official source-market MSRP reference');
  assert.equal(valueCompare.rrpBasisLabel(group('source_market_component_reference')), 'Source-market component reference');
  assert.equal(valueCompare.rrpBasisLabel({}), 'Verified RRP unavailable');
});

test('mobile value helper cannot calculate or choose the authoritative Fate Verdict', () => {
  assert.equal(valueCompare.compareValueGroups, undefined);
  assert.equal(valueCompare.valuePosition, undefined);
  assert.equal(valueCompare.bestOffer, undefined);
});
