const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../screens/network-screen-v2.tsx'), 'utf8');

test('Network screen consumes public retailer coverage and never private status diagnostics', () => {
  assert.match(source, /SIGNAL_ENGINE_URL\}\/api\/retailers/);
  assert.doesNotMatch(source, /\/api\/status/);
  assert.doesNotMatch(source, /\/api\/signal-health/);
});

test('Network screen keeps monitor health separate from stock truth', () => {
  assert.match(source, /monitor health is never treated as proof of stock/i);
  assert.match(source, /It is not a stock claim/i);
});
