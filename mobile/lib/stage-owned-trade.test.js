const test = require('node:test');
const assert = require('node:assert/strict');
const { stageOwnedTrade } = require('./stage-owned-trade');

const item = { id: 'owned-lot', fateCardId: 'exact-card', quantity: 3, tradeQuantity: 0, revision: 7, copyState: 'raw', conditionCode: 'lightly_played', card: { fateCardId: 'exact-card', tcgCode: 'pokemon' } };
const terms = { tradeMode: 'negotiable', localTradeAllowed: true, postalTradeAllowed: false };
function setup(overrides = {}) {
  const calls = [];
  return { calls, api: { fetchBinder: async () => ({ items: [] }), updateTradeQuantity: async (...args) => calls.push(['patch', ...args]), createBinder: async (body) => calls.push(['binder', body]), ...overrides } };
}
test('uses existing lot, changes only offered quantity, and stages privately', async () => {
  const { calls, api } = setup();
  await stageOwnedTrade({ item, tradeQuantity: 2, terms }, api);
  assert.deepEqual(calls, [['patch', item.id, { tradeQuantity: 2, expectedRevision: 7 }], ['binder', { ...terms, collectionItemId: item.id, visibility: 'private' }]]);
  assert.equal(item.quantity, 3);
  assert.equal(item.conditionCode, 'lightly_played');
});
test('repeated staging detects the existing entry without any writes', async () => {
  const { calls, api } = setup({ fetchBinder: async () => ({ items: [{ collectionItemId: item.id }] }) });
  assert.deepEqual(await stageOwnedTrade({ item, tradeQuantity: 1, terms }, api), { alreadyPresent: true });
  assert.deepEqual(calls, []);
});
test('invalid quantities or unverified identity fail before any API call', async () => {
  const api = new Proxy({}, { get: () => { throw new Error('API must not be used'); } });
  for (const quantity of [0, 4, 1.5, NaN]) await assert.rejects(stageOwnedTrade({ item, tradeQuantity: quantity, terms }, api), /whole number/);
  await assert.rejects(stageOwnedTrade({ item: { ...item, card: null }, tradeQuantity: 1, terms }, api), /verified owned card/);
});
test('revision conflict prevents binder creation', async () => {
  const { calls, api } = setup({ updateTradeQuantity: async () => { throw new Error('Revision conflict'); } });
  await assert.rejects(stageOwnedTrade({ item, tradeQuantity: 1, terms }, api), /Revision conflict/);
  assert.deepEqual(calls, []);
});
test('binder failure preserves holding and describes partial success', async () => {
  const { calls, api } = setup({ createBinder: async () => { throw new Error('Offline'); } });
  await assert.rejects(stageOwnedTrade({ item, tradeQuantity: 1, terms }, api), /Trade availability may have been saved/);
  assert.deepEqual(calls, [['patch', item.id, { tradeQuantity: 1, expectedRevision: 7 }]]);
});
test('an already tradeable slab checks its revision without changing ownership', async () => {
  const slab = { ...item, quantity: 1, tradeQuantity: 1, copyState: 'graded', grading: { certificationNumber: '123', certificationStatus: 'verified' } };
  const { calls, api } = setup();
  await stageOwnedTrade({ item: slab, tradeQuantity: 1, terms }, api);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['patch', item.id, { tradeQuantity: 1, expectedRevision: 7 }]);
  assert.equal(calls[1][0], 'binder');
  assert.equal(slab.grading.certificationStatus, 'verified');
});

