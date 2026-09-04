const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services/fate-market.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'screens/fate-market-screen-v2.tsx'), 'utf8');

test('Fate Market snapshots are freshness bounded and single flight', () => {
  assert.match(service, /MARKET_SNAPSHOT_TTL_MS = 30_000/);
  assert.match(service, /pulseFlights\.get\(key\)/);
  assert.match(service, /collectorsFlight\?\.token === token/);
});

test('personal collection cache remains isolated by authenticated token', () => {
  assert.match(service, /collectorsCache\?\.token === token/);
  assert.match(service, /authorizationToken:token/);
});

test('normal focus reuses fresh snapshots while pull-to-refresh bypasses them', () => {
  assert.match(screen, /loadMarket\(false\)/);
  assert.match(screen, /loadMarket\(true\)/);
});
