const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'fate-collections-view.ts'), 'utf8');
const helpers = import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const set = (extra = {}) => ({ setId: '151', setName: '151', status: 'available', totalCount: 207, ownedCount: 3, missingCount: 204, completionPercent: 1.4, ...extra });
const card = (id, number) => ({ fateCardId: id, setId: '151', name: id, collectorNumber: number });
const item = (id, number, extra = {}) => ({ id: `lot-${id}`, fateCardId: id, card: card(id, number), copyState: 'raw', quantity: 1, ...extra });

test('an unknown, empty or inconsistent checklist cannot celebrate completion', async () => {
  const { isBinderComplete } = await helpers;
  assert.equal(isBinderComplete(null), false);
  assert.equal(isBinderComplete(set({ status: 'unavailable', ownedCount: null, totalCount: null, missingCount: 0 })), false);
  assert.equal(isBinderComplete(set({ ownedCount: 0, totalCount: 0, missingCount: 0 })), false);
  assert.equal(isBinderComplete(set({ missingCount: 0 })), false);
  assert.equal(isBinderComplete(set({ ownedCount: 207, missingCount: 0 })), true);
});

test('binder sorting keeps building checklists visible and searches without mutating input', async () => {
  const { orderBinders } = await helpers;
  const building = set({ setId: 'darkness', setName: 'Darkness Ablaze', status: 'unavailable', completionPercent: null });
  const sets = [building, set()];
  assert.deepEqual(orderBinders(sets).map((s) => s.setId), ['151', 'darkness']);
  assert.deepEqual(orderBinders(sets, ' DARKNESS ').map((s) => s.setId), ['darkness']);
  assert.equal(sets[0], building);
});

test('All binder entries interleave owned and needed in collector-number order', async () => {
  const { binderEntries } = await helpers;
  const result = binderEntries([item('ten', '10'), item('one', '1')], [card('two', '2')], '151', 'all');
  assert.deepEqual(result.map((r) => r.key), ['owned:one', 'needed:two', 'owned:ten']);
});

test('binder pockets combine same-identity copies while keeping variants and slabs separate', async () => {
  const { binderEntries } = await helpers;
  const first = item('one', '1', { quantity: 2, conditionCode: 'near_mint' });
  const items = [first, item('one', '1', { id: 'second-lot', quantity: 3, conditionCode: 'played' }), item('one-holo', '1'), item('two-graded', '2', { copyState: 'graded' }), item('other-set', '5', { card: { ...card('other-set', '5'), setId: 'other' } })];
  const result = binderEntries(items, [card('one', '1'), card('two', '2')], '151', 'all');
  assert.equal(result.length, 3);
  assert.equal(result.find((r) => r.key === 'owned:one').item.quantity, 5);
  assert.equal(result.find((r) => r.key === 'owned:one').item.conditionCode, 'mixed');
  assert.equal(first.quantity, 2);
  assert.equal(result.some((r) => r.key.includes('graded')), false);
  assert.equal(result.some((r) => r.key === 'needed:two'), true);
});

test('binder search and Owned/Needed filters retain exact identities', async () => {
  const { binderEntries } = await helpers;
  const items = [item('Daisy', '195')];
  assert.deepEqual(binderEntries(items, [card('Mew', '151')], '151', 'needed', 'mew').map((r) => r.key), ['needed:Mew']);
  assert.deepEqual(binderEntries(items, [], '151', 'owned', '195').map((r) => r.key), ['owned:Daisy']);
  assert.equal(binderEntries(items, [], '151', 'owned', 'absent').length, 0);
});

test('row quotes accept only available exact-card GBP evidence, independent of mover rankings', async () => {
  const { collectionCardQuote } = await helpers;
  const quote = { available: true, cardIdentityId: 'daisy', price: { amount: 4.45, currencyCode: 'GBP' } };
  assert.equal(collectionCardQuote(quote, 'daisy').amount, 4.45);
  assert.equal(collectionCardQuote({ ...quote, available: false }, 'daisy'), null);
  assert.equal(collectionCardQuote(quote, 'other'), null);
  assert.equal(collectionCardQuote({ ...quote, price: { amount: 4.45, currencyCode: 'EUR' } }, 'daisy'), null);
  assert.equal(collectionCardQuote({ ...quote, price: { amount: NaN, currencyCode: 'GBP' } }, 'daisy'), null);
});
