const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const market = read('screens/fate-market-screen-v2.tsx');
const price = read('screens/fate-price-screen.tsx');
const dashboard = read('screens/fate-collections-dashboard-screen.tsx');
const personal = read('screens/fate-collection-browser-screen.tsx');
const binders = read('screens/fate-binders-screen.tsx');
const binder = read('screens/fate-binder-screen.tsx');
const graded = read('screens/fate-graded-collection-screen.tsx');
const collectorBridge = read('components/fate-collector-enhancements.tsx');
const collectorArt = read('components/fate-collections-art.tsx');
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

test('Fate Collections dashboard owns the personal top-three movement overview', () => {
  assert.match(collectorBridge, /router\.replace\('\/collections'\)/);
  assert.match(dashboard, /YOUR COLLECTION PULSE/);
  assert.match(dashboard, /Your biggest risers and fallers/);
  assert.match(dashboard, /BIGGEST WINS/);
  assert.match(dashboard, /BIGGEST LOSSES/);
  assert.match(dashboard, /items\.slice\(0, 3\)/);
  assert.match(dashboard, /pulse\?\.risers \|\| \[\]/);
  assert.match(dashboard, /pulse\?\.decliners \|\| \[\]/);
  assert.match(dashboard, /label="7D"/);
  assert.match(dashboard, /label="30D"/);
});

test('Collections dashboard is an overview with three dedicated destinations', () => {
  assert.match(dashboard, /title="Personal Collection"/);
  assert.match(dashboard, /title="Binders"/);
  assert.match(dashboard, /title="Graded"/);
  assert.match(dashboard, /router\.push\('\/collection'\)/);
  assert.match(dashboard, /router\.push\('\/binders'\)/);
  assert.match(dashboard, /router\.push\('\/graded-collection'\)/);
  assert.match(dashboard, /SETS COMPLETED/);
  assert.doesNotMatch(dashboard, /CLOSEST TO COMPLETION/);
  assert.doesNotMatch(dashboard, /Import Collection CSV/);
});

test('Collections uses the approved three-section artwork without redefining lifecycle companions', () => {
  for (const name of ['personal', 'binder', 'graded']) {
    assert.ok(collectorArt.includes(`fate-collections-${name}.png`));
    assert.ok(fs.existsSync(path.join(root, 'assets/images', `fate-collections-${name}.png`)));
  }
  assert.doesNotMatch(collectorArt, /\b(?:Oru|Fenn|Koru|Nyxen)\b/);
});

test('Collector valuation labels known coverage without presenting a partial sum as a total', () => {
  assert.match(dashboard, /completeValue \? 'COLLECTION VALUE' : 'KNOWN COLLECTION VALUE'/);
  assert.match(dashboard, /collection\.pricedUnits === collection\.totalUnits/);
  assert.match(dashboard, /Price coverage \$\{collection\.priceCoveragePercent\.toFixed\(1\)\}%/);
  assert.match(dashboard, /verified evidence only/);
  assert.doesNotMatch(dashboard, /knownValue \|\| 0/);
});

test('exact FatePrice cards can be manually added to the canonical collection', () => {
  assert.match(price, /AddToFateCollectorAction cardIdentityId=\{selectedCardId\} setName=\{selectedSet\}/);
  assert.match(addAction, /addExactCardToCollector\(cardIdentityId\)/);
  assert.match(service, /POST|method: 'POST'/);
  assert.match(service, /\/v1\/collection\/items/);
  assert.match(service, /fateCardId: id, quantity, copyState: 'raw', conditionCode/);
});

test('Collectr import belongs to Binders and remains preview-first and confirmed', () => {
  assert.doesNotMatch(personal, /File\.pickFileAsync|previewCollectrCsv|CONFIRM EXACT IMPORT/);
  assert.match(binders, /COLLECTR IMPORT/);
  assert.match(binders, /File\.pickFileAsync/);
  assert.match(binders, /previewCollectrCsv\(text\)/);
  assert.match(binders, /SAFE IMPORT PREVIEW/);
  assert.match(binders, /CONFIRM EXACT IMPORT/);
  assert.match(binders, /confirmCollectrCsv\(csvText/);
  assert.match(binders, /ambiguous or unresolved rows stay held/i);
  assert.match(service, /\/v1\/collectors\/import\/collectr\/preview/);
  assert.match(service, /\/v1\/collectors\/import\/collectr\/confirm/);
  assert.match(service, /confirmed: true/);
  assert.match(binders, /await load\(\)/);
  assert.match(service, /invalidateFateCollectorsSummaryCache\(\)/);
});

test('Binders owns closest set and set-list organisation', () => {
  assert.match(binders, /CLOSEST TO COMPLETION/);
  assert.match(binders, /Your Set Binders/);
  assert.match(binders, /label="All"/);
  assert.match(binders, /label="In progress"/);
  assert.match(binders, /label="Completed"/);
  assert.match(binders, /router\.push\(\{ pathname: '\/binder\/\[setId\]'/);
});

test('raw binders and graded pride cards have separate dedicated routes', () => {
  assert.match(dashboard, /router\.push\('\/graded-collection'\)/);
  assert.match(dashboard, /router\.push\('\/binders'\)/);
  assert.match(binder, /accessibilityLabel=\{`Add \$\{card\.name \|\| 'card'\} as owned`\}/);
  assert.match(binder, /addExactCardToCollector\(card\.fateCardId\)/);
  assert.match(binder, /Graded cards do not fill binder slots/);
  assert.match(graded, /Raw-card FatePrice is never reused for slabs/);
  assert.match(graded, /exact card \+ grader \+ grade evidence/i);
  assert.match(personal, /item\.copyState === 'raw'/);
});

test('graded performance fails visibly closed until exact slab history exists', () => {
  assert.match(graded, /BEST PERFORMER/);
  assert.match(graded, /BIGGEST DROP/);
  assert.match(graded, /Building graded history/);
  assert.match(graded, /exact card, grader and grade have trustworthy historical evidence/);
  assert.doesNotMatch(graded, /\+42\.3%|-18\.6%/);
});
