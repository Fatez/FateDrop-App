const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services/fate-market.ts'), 'utf8');
const collectorService = fs.readFileSync(path.join(root, 'services/fate-collector.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'screens/fate-market-screen-v2.tsx'), 'utf8');
const binders = fs.readFileSync(path.join(root, 'screens/fate-binders-screen.tsx'), 'utf8');
const fatePrice = fs.readFileSync(path.join(root, 'screens/fate-price-screen.tsx'), 'utf8');
const intelligence = fs.readFileSync(path.join(root, 'screens/fate-collection-browser-screen.tsx'), 'utf8');

test('Fate Market consumes Cloud-owned Pulse and owner-authenticated Collectors contracts', () => {
  assert.match(service, /SIGNAL_ENGINE_URL/);
  assert.match(service, /\/v1\/market\/pulse/);
  assert.match(service, /\/v1\/collectors\/summary\?currency=GBP&language=en&variant=standard/);
  assert.match(service, /headers\.Authorization = `Bearer \$\{token\}`/);
});

test('FatePrice consumes exact Cloud valuation in GBP presentation and never calculates market movement in the App', () => {
  assert.match(service, /displayCurrency=GBP/);
  assert.match(service, /\/v1\/fate-price\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(service, /\/v1\/fate-price\/cards\?/);
  assert.match(service, /\/v1\/fate-price\/sets\?/);
  assert.match(service, /\/v1\/fate-price\/sets\/\$\{encodeURIComponent\(id\)\}\/cards/);
  assert.match(service, /\/v1\/fate-price\/cards\/\$\{encodeURIComponent\(cardIdentityId\.trim\(\)\)\}/);
  assert.match(service, /\/v1\/fate-price\/\$\{encodeURIComponent\(id\)\}\/history/);
  assert.match(service, /marketSegment=\$\{encodeURIComponent\(scope\.marketSegmentKey\)\}/);
  assert.match(fatePrice, /movementText\(price\?\.movement\.d7\)/);
  assert.match(fatePrice, /movementText\(price\?\.movement\.d30\)/);
  assert.match(fatePrice, /stored market days only/i);
  assert.match(fatePrice, /Missing days are never filled/i);
  assert.match(fatePrice, /lowest listing is shown only as context/i);
  assert.doesNotMatch(fatePrice, /function\s+(?:calculate|score).*(?:price|movement|value)/i);
});

test('Collection Intelligence and zero-owned binders consume Cloud-owned contracts', () => {
  assert.match(collectorService, /\/v1\/collectors\/intelligence\?currency=GBP/);
  assert.match(collectorService, /\/v1\/collectors\/sets\/\$\{encodeURIComponent\(id\)\}\/progress/);
  assert.match(collectorService, /\/v1\/collectors\/binders\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(intelligence, /same cards and quantities are compared at both dates/i);
  assert.match(intelligence, /Duplicate copies stay one card identity/i);
  assert.doesNotMatch(intelligence, /function\s+(?:calculate|score).*(?:price|market movement)/i);
});

test('third-party collection import stays user-exported, preview-first and explicitly confirmed', () => {
  assert.match(collectorService, /\/v1\/collectors\/import\/collectr\/preview/);
  assert.match(collectorService, /\/v1\/collectors\/import\/collectr\/confirm/);
  assert.match(collectorService, /mode: 'preview_only'/);
  assert.match(collectorService, /writesPerformed: false/);
  assert.match(collectorService, /confirmed: true/);
  assert.match(binders, /File\.pickFileAsync/);
  assert.match(binders, /previewCollectrCsv\(text\)/);
  assert.match(binders, /CONFIRM EXACT IMPORT/);
  assert.match(binders, /confirmCollectrCsv\(csvText/);
});

test('FatePulse and collection value remain blank when Cloud evidence is unavailable', () => {
  assert.match(screen, /hasKnownValue \? formatMoney\(value, currency\) : '—'/);
  assert.match(screen, /collection\.pricedUnits === 0/);
  assert.match(screen, /Collection value appears only when verified FatePrice evidence exists/);
  assert.doesNotMatch(screen, /knownValue \|\| 0/);
});
