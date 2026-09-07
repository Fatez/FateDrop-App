const test = require('node:test');
const assert = require('node:assert/strict');
const { storedPeriodMovement } = require('./history-period');
const point = (marketDay, amount, currencyCode = 'GBP') => ({marketDay, amount, currencyCode});
test('short history cannot be labelled as a 90-day move', () => {
  assert.equal(storedPeriodMovement([point('2026-09-06',100),point('2026-09-07',120)],90),null);
});
test('90-day change uses its actual baseline, not the oldest available point', () => {
  assert.equal(storedPeriodMovement([point('2026-06-08',100),point('2026-06-01',50),point('2026-09-06',120)],90),20);
});
test('missing baseline, mixed currencies and zero baseline remain unavailable', () => {
  assert.equal(storedPeriodMovement([point('2026-06-07',100),point('2026-09-06',120)],90),null);
  assert.equal(storedPeriodMovement([point('2026-06-08',100,'EUR'),point('2026-09-06',120)],90),null);
  assert.equal(storedPeriodMovement([point('2026-06-08',0),point('2026-09-06',120)],90),null);
});
