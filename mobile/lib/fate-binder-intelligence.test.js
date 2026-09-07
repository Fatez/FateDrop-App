const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const binder = read('screens/fate-binder-screen-v2.tsx');
const service = read('services/fate-collector.ts');

test('Binder needed and owned rows use the shared canonical thumbnail boundary', () => {
  assert.match(binder, /CanonicalThumbnail/);
  assert.match(binder, /kind="card" setId=\{card\.setId\} collectorNumber=\{card\.collectorNumber\}/);
  assert.match(binder, /kind="card" setId=\{card\?\.setId \|\| setId\} collectorNumber=\{card\?\.collectorNumber\}/);
});

test('Binder exposes verified finish-cost coverage without estimating unknown prices', () => {
  assert.match(binder, /COST TO FINISH/);
  assert.match(binder, /KNOWN REMAINDER/);
  assert.match(binder, /missingPricedCount/);
  assert.match(binder, /missingUnpricedCount/);
  assert.match(binder, /does not estimate the rest/);
});

test('Binder is ready for exact Cloud-ranked top missing cards', () => {
  assert.match(service, /topMissingCards\?: FateCollectorMissingCard\[\]/);
  assert.match(service, /currentPrice\?: number \| null/);
  assert.match(binder, /3 most expensive cards left/);
  assert.match(binder, /Highest-priced known cards left/);
  assert.match(binder, /binder\?\.topMissingCards\?\.slice\(0, 3\)/);
});
