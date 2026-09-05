const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const market = read('screens/fate-market-screen-v2.tsx');
const price = read('screens/fate-price-screen.tsx');
const collector = read('components/fate-collector-enhancements.tsx');
const addAction = read('components/add-to-fate-collector-action.tsx');
const service = read('services/fate-collector.ts');

test('FatePulse keeps full-market top three rankings independent of ownership', () => {
  assert.match(market, /const TOP_MOVER_LIMIT = 3/);
  assert.match(market, /period\?\.setRisers : period\?\.cardRisers/);
  assert.match(market, /period\?\.setDecliners : period\?\.cardDecliners/);
  assert.match(market, /risers\.slice\(0, TOP_MOVER_LIMIT\)/);
  assert.match(market, /decliners\.slice\(0, TOP_MOVER_LIMIT\)/);
  assert.doesNotMatch(market, /personalPulse.*PulsePanel/s);
});

test('FateCollector owns the personal riser/faller and set-binder UI', () => {
  assert.match(market, /FateCollectorEnhancements data=\{data\} signedIn=\{signedIn\}/);
  assert.match(collector, /YOUR COLLECTION PULSE/);
  assert.match(collector, /Your biggest risers and fallers/);
  assert.match(collector, /YOUR BIGGEST RISERS/);
  assert.match(collector, /YOUR BIGGEST FALLERS/);
  assert.match(collector, /SET BINDERS/);
  assert.match(collector, /pulse\?\.risers \|\| \[\]/);
  assert.match(collector, /pulse\?\.decliners \|\| \[\]/);
});

test('exact FatePrice cards can be manually added to the canonical collection', () => {
  assert.match(price, /AddToFateCollectorAction cardIdentityId=\{selectedCardId\} setName=\{selectedSet\}/);
  assert.match(addAction, /addExactCardToCollector\(cardIdentityId\)/);
  assert.match(service, /POST|method: 'POST'/);
  assert.match(service, /\/v1\/collection\/items/);
  assert.match(service, /fateCardId: id, quantity, copyState: 'raw', conditionCode/);
});

test('Collectr import is user-picked, previewed and explicitly confirmed', () => {
  assert.match(collector, /File\.pickFileAsync/);
  assert.match(collector, /previewCollectrCsv\(text\)/);
  assert.match(collector, /CONFIRM EXACT IMPORT/);
  assert.match(collector, /confirmCollectrCsv\(csvText/);
  assert.match(service, /\/v1\/collectors\/import\/collectr\/preview/);
  assert.match(service, /\/v1\/collectors\/import\/collectr\/confirm/);
  assert.match(service, /confirmed: true/);
  assert.match(collector, /ambiguous.*unresolved.*rejected CSV rows/s);
});
