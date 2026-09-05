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

test('Fate Collections owns the personal riser/faller and set-binder UI', () => {
  assert.match(market, /FateCollectorEnhancements data=\{data\} onCollectionChanged=\{onRefresh\} signedIn=\{signedIn\}/);
  assert.match(collector, /PERSONAL COLLECTION PULSE/);
  assert.match(collector, /What moved among your cards\?/);
  assert.match(collector, /YOUR TOP \{label\}/);
  assert.match(collector, /SET BINDERS/);
  assert.match(collector, /pulse\?\.risers \|\| \[\]/);
  assert.match(collector, /pulse\?\.decliners \|\| \[\]/);
  assert.match(collector, /items\.slice\(0, 3\)/);
  assert.match(collector, /COMPARE THE BROAD MARKET/);
  assert.match(collector, /source \{sourceCurrency\} market/);
  assert.match(collector, /currency changes cannot create a rise or fall/);
});

test('Collector valuation labels known coverage without presenting a partial sum as a total', () => {
  assert.match(market, /fullyValued = Boolean\(collection && collection\.totalUnits > 0 && collection\.totalValue != null\)/);
  assert.match(market, /summary\?\.rawCollection \|\| summary\?\.collection/);
  assert.match(market, /fullyValued \? 'RAW COLLECTION VALUE' : 'KNOWN RAW-CARD VALUE'/);
  assert.match(market, /collection\.pricedUnits} of \$\{collection\.totalUnits/);
  assert.match(market, /excluded—not estimated/);
  assert.match(market, /\$\{collection\.pricedUnits\}\/\$\{collection\.totalUnits\} priced/);
  assert.match(market, /collectorCoverageTrack/);
  assert.match(market, /sourceMarketCurrencyCode/);
});

test('exact FatePrice cards can be manually added to the canonical collection', () => {
  assert.match(price, /AddToFateCollectorAction cardIdentityId=\{selectedCardId\} setName=\{selectedSet\}/);
  assert.match(addAction, /addExactCardToCollector\(cardIdentityId\)/);
  assert.match(service, /POST|method: 'POST'/);
  assert.match(service, /\/v1\/collection\/items/);
  assert.match(service, /fateCardId: id, quantity, copyState: 'raw', conditionCode/);
});

test('third-party collection import is user-picked, previewed and explicitly confirmed', () => {
  assert.match(collector, /File\.pickFileAsync/);
  assert.match(collector, /previewCollectrCsv\(text\)/);
  assert.match(collector, /CONFIRM EXACT IMPORT/);
  assert.match(collector, /confirmCollectrCsv\(csvText/);
  assert.match(service, /\/v1\/collectors\/import\/collectr\/preview/);
  assert.match(service, /\/v1\/collectors\/import\/collectr\/confirm/);
  assert.match(service, /confirmed: true/);
  assert.match(collector, /ambiguous.*unresolved.*rejected CSV rows/s);
  assert.match(collector, /await onCollectionChanged\(\)/);
  assert.match(service, /invalidateFateCollectorsSummaryCache\(\)/);
});

test('raw binders and graded pride cards have separate dedicated routes', () => {
  const binder = read('screens/fate-binder-screen.tsx');
  const graded = read('screens/fate-graded-collection-screen.tsx');
  const browser = read('screens/fate-collection-browser-screen.tsx');
  assert.match(market, /router\.push\('\/graded-collection'\)/);
  assert.match(market, /pathname: '\/binder\/\[setId\]'/);
  assert.match(binder, /Mark \$\{card\.name \|\| 'card'\} as owned/);
  assert.match(binder, /addExactCardToCollector\(card\.fateCardId\)/);
  assert.match(binder, /Graded slabs never fill binder slots/);
  assert.match(graded, /Exact grade evidence only/);
  assert.match(graded, /Raw-card FatePrice is never reused for a slab/);
  assert.match(browser, /item\.copyState === 'raw'/);
});
