const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabs = read('app/(tabs)/_layout.tsx');
const marketRoute = read('app/(tabs)/market.tsx');
const market = read('screens/fate-market-screen-v2.tsx');
const fatePrice = read('screens/fate-price-screen.tsx');
const fatePriceService = read('services/fate-market.ts');

test('FateFind remains the centre of the Fate Network compass', () => {
  assert.match(tabs, /accessibilityLabel="Open FateFind"/);
  assert.match(tabs, /openTool\('\/fatefind'\)/);
  assert.match(tabs, /<Text style=\{styles\.fateFindTitle\}>FateFind<\/Text>/);
});

test('Fate Network contains action tools including Fate Trader, not Fate Market intelligence', () => {
  assert.match(tabs, /title="FateMatch"/);
  assert.match(tabs, /title="Retailers"/);
  assert.match(tabs, /title="Local Radar"/);
  assert.match(tabs, /title="Wishlist"/);
  assert.match(tabs, /title="Fate Trader"[\s\S]*openTool\('\/fate-trader'\)/);
  assert.doesNotMatch(tabs, /<CompassNode[^>]*title="Search"/);
});

test('Fate Market is Pulse Price Collectors and does not own Fate Trader', () => {
  assert.match(marketRoute, /fate-market-screen-v2/);
  assert.match(market, /type MarketAreaKey = 'pulse' \| 'price' \| 'collectors'/);
  assert.match(market, /title: 'FatePulse'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Fate Collectors'/);
  assert.doesNotMatch(market, /title: 'Fate Trader'/);
});

test('FatePrice owns a dedicated exact-card evidence page and fails closed', () => {
  assert.match(market, /CANONICAL EXACT-CARD VALUE/);
  assert.match(market, /OPEN FATEPRICE/);
  assert.match(fatePrice, /EXACT-CARD VALUE/);
  assert.match(fatePrice, /7D MOVE/);
  assert.match(fatePrice, /30D MOVE/);
  assert.match(fatePrice, /CHOOSE EXACT MARKET SCOPE/);
  assert.match(fatePriceService, /\/v1\/fate-price\//);
  assert.doesNotMatch(fatePrice, /Math\.random|mock|demo/i);
});
