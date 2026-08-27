const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const service = read('services/local-radar-intelligence.ts');
const overview = read('app/local-radar.tsx');
const map = read('components/local-radar-map.tsx');
const stores = read('app/local-radar-stock.tsx');
const detail = read('app/local-radar-store.tsx');

const customerScreens = `${overview}\n${stores}\n${detail}`;

test('Local Radar consumes Cloud Expected Confirmed Unknown as the customer contract', () => {
  assert.match(service, /export type RadarLocalState = 'expected' \| 'confirmed' \| 'unknown'/);
  assert.match(service, /localAvailability\?: RadarLocalAvailability/);
  assert.match(service, /localState\?: RadarLocalState/);
  assert.match(service, /if \(projected === 'confirmed' \|\| projected === 'expected' \|\| projected === 'unknown'\)/);
  assert.match(service, /if \(state === 'confirmed'\) return 'CONFIRMED'/);
  assert.match(service, /if \(state === 'expected'\) return 'EXPECTED'/);
  assert.match(service, /return 'UNKNOWN'/);
});

test('Local Radar requests the Pokemon Cloud contract and preserves the standard Expected disclaimer', () => {
  assert.match(service, /tcg: 'pokemon'/);
  assert.match(service, /Expected stock information is indicative only and is not guaranteed/);
  assert.match(service, /We recommend checking with the retailer before travelling/);
  assert.match(detail, /Expected stock information is indicative only and is not guaranteed/);
});

test('customer-facing Local Radar screens do not expose online signal lifecycle vocabulary', () => {
  assert.doesNotMatch(customerScreens, /LOCAL MANIFESTED|LOCAL ECHO|LOCAL WHISPER|LOCAL VANISHED/);
  assert.doesNotMatch(customerScreens, /PREPARATION DETECTED|EARLY LOCAL MOVEMENT|AVAILABILITY DISAPPEARED/);
  assert.doesNotMatch(customerScreens, /Incoming Watch/i);
  assert.match(overview, />Confirmed</);
  assert.match(overview, />Expected</);
  assert.match(stores, /Confirmed/);
  assert.match(stores, /Expected/);
  assert.match(detail, /CONFIRMED/);
  assert.match(detail, /EXPECTED/);
});

test('Local Stores remains map-first and keeps online stock separate from physical truth', () => {
  assert.match(overview, /<LocalRadarMap/);
  assert.match(map, /<MapView/);
  assert.match(map, /clusterRadarShops/);
  assert.match(overview, />Local Stores</);
  assert.match(overview, /Online stock remains separate/);
  assert.match(stores, /exact-branch Confirmed stock/);
  assert.match(stores, /never inferred from generic online availability/);
  assert.match(detail, /does not infer physical stock from an online product page/);
});

test('Expected store cards expose the stock title, date and disclaimer while Confirmed uses exact evidence', () => {
  assert.match(stores, /Expected stock: \{expectedStock\.title\}/);
  assert.match(stores, /expectedStock\.label/);
  assert.match(stores, /expectedStock\.disclaimer/);
  assert.match(detail, /EXPECTED STOCK/);
  assert.match(detail, /expectedStock\.title/);
  assert.match(detail, /expectedStock\.label/);
  assert.match(detail, /Stock has been confirmed at this exact store/);
});