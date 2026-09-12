const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, 'fate-price-verdict.ts'), 'utf8');
const helper = import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const now = Date.UTC(2026, 8, 10);
function snapshot(percent = -10) {
  return { available: true, marketScope: { currencyCode: 'GBP' }, price: { amount: 90, asOf: now }, confidence: { level: 'high' }, movement: { d30: { available: true, percent, fromAmount: 100, toAmount: 90 } } };
}
test('missing, zero, stale, future and low-confidence prices cannot receive buying context', async () => {
  const { fatePriceVerdict: verdict } = await helper;
  assert.equal(verdict(null, now).title, 'Not enough evidence yet');
  for (const patch of [{ price: { amount: 0, asOf: now } }, { price: { amount: 90, asOf: now - 49 * 3600000 } }, { price: { amount: 90, asOf: now + 1000 } }, { confidence: { level: 'low' } }]) {
    assert.equal(verdict({ ...snapshot(), ...patch }, now).title, 'Wait for stronger price evidence');
  }
});
test('missing or mismatched movement fails closed', async () => {
  const { fatePriceVerdict: verdict } = await helper;
  for (const movement of [{ available: false }, { available: true, percent: NaN }, { available: true, percent: -10, fromAmount: 100, toAmount: 80 }]) {
    assert.equal(verdict({ ...snapshot(), movement: { d30: movement } }, now).title, 'Not enough evidence yet');
  }
});
test('falling prices describe evidence without promising a bargain or recovery', async () => {
  const { fatePriceVerdict: verdict } = await helper;
  const result = verdict(snapshot(), now);
  assert.equal(result.title, 'Lower than 30 days ago');
  assert.match(result.detail, /does not prove/);
  assert.match(result.detail, /10.0%/);
});
test('rising and flat prices stay descriptive', async () => {
  const { fatePriceVerdict: verdict } = await helper;
  assert.equal(verdict(snapshot(10), now).title, 'Higher than 30 days ago');
  assert.equal(verdict(snapshot(0), now).title, 'Unchanged against the 30-day reference');
});
