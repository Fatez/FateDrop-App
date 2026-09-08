const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const compass = fs.readFileSync(path.join(__dirname, '..', 'components', 'fate-network-compass.tsx'), 'utf8');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabs = read('app/(tabs)/_layout.tsx');
const marketRoute = read('app/(tabs)/market.tsx');
const market = read('screens/fate-market-screen-v2.tsx');
const fatePrice = read('screens/fate-price-screen.tsx');
const fatePriceService = read('services/fate-market.ts');

test('The Network centre toggles the arc and FateFind has its own destination', () => {
  assert.match(compass, /title: 'FateFind'/);
  assert.match(compass, /route: '\/fatefind'/);
  assert.match(compass, /accessibilityLabel="Close Fate Network"[\s\S]*onPress=\{onClose\}/);
});

test('Fate Network keeps Trader outside its action arc', () => {
  assert.match(compass, /title: 'FateMatch'/);
  assert.match(compass, /title: 'Retailers'/);
  assert.match(compass, /title: 'Local Radar'/);
  assert.match(compass, /title: 'Wishlist'/);
  assert.doesNotMatch(compass, /fate-trader|Fate Trader/);
  assert.doesNotMatch(tabs, /<CompassNode[^>]*title="Search"/);
});

test('Fate Market is Pulse Price and Collections and does not own Fate Trader', () => {
  assert.match(marketRoute, /fate-market-screen-v2/);
  assert.match(market, /type MarketAreaKey = 'pulse' \| 'price' \| 'collectors'/);
  assert.match(market, /title: 'FateInsight'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Collections'/);
  assert.doesNotMatch(market, /title: 'Fate Trader'/);
});

test('FatePrice owns a dedicated exact-card evidence page and fails closed', () => {
  assert.match(market, /CANONICAL EXACT-CARD VALUE/);
  assert.match(market, /OPEN FATEPRICE/);
  assert.match(fatePrice, /EXACT-CARD VALUE/);
  assert.match(fatePrice, /7D MOVE/);
  assert.match(fatePrice, /30D MOVE/);
  assert.match(fatePrice, /VERIFIED PRICE HISTORY/);
  assert.match(fatePrice, /\[7, 30, 90\]/);
  assert.match(fatePrice, /CHOOSE EXACT MARKET SCOPE/);
  assert.match(fatePriceService, /\/v1\/fate-price\/cards/);
  assert.match(fatePriceService, /\/history/);
  assert.doesNotMatch(fatePrice, /Math\.random|mock|demo/i);
});
