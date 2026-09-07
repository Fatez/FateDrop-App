const test = require('node:test');
const assert = require('node:assert/strict');
const { retailOfferViewState } = require('./retail-offer-view-state');

test('a failed or unavailable check never claims no stock', () => {
  for (const status of [undefined, null, 'unavailable', 'unexpected']) {
    assert.equal(retailOfferViewState({ loading: false, status, visibleCount: 0 }), 'unavailable');
  }
});
test('an authoritative empty response shows no verified offers', () => {
  assert.equal(retailOfferViewState({ loading: false, status: 'empty', visibleCount: 0 }), 'empty');
});
test('filters hiding available offers offer a filter reset, not a no-stock claim', () => {
  assert.equal(retailOfferViewState({ loading: false, status: 'available', visibleCount: 0 }), 'filtered');
  assert.equal(retailOfferViewState({ loading: false, status: 'available', visibleCount: 2 }), 'available');
});
test('refresh suppresses previous empty or filtered states', () => {
  for (const status of ['empty', 'available', 'unavailable']) {
    assert.equal(retailOfferViewState({ loading: true, status, visibleCount: 0 }), 'loading');
  }
});
