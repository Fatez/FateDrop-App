const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabs = read('app/(tabs)/_layout.tsx');
const marketRoute = read('app/(tabs)/market.tsx');
const market = read('screens/fate-market-hub-screen.tsx');
const pulse = read('screens/fate-pulse-screen.tsx');
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

test('Fate Market is Pulse Price and Collections and does not own Fate Trader', () => {
  assert.match(marketRoute, /fate-market-hub-screen/);
  assert.match(market, /title: 'FatePulse'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Fate Collections'/);
  assert.match(market, /route: '\/fate-pulse'/);
  assert.match(market, /route: '\/fate-price'/);
  assert.match(market, /route: '\/collection'/);
  assert.doesNotMatch(market, /title: 'Fate Trader'/);
});

test('FatePulse owns a dedicated evidence-led exploration page', () => {
  assert.match(pulse, /key: 'overview', label: 'Overview'/);
  assert.match(pulse, /key: 'sets', label: 'Sets'/);
  assert.match(pulse, /key: 'cards', label: 'Cards'/);
  assert.match(pulse, /key: 'watchlist', label: 'Watchlist'/);
  assert.match(pulse, /fetchFatePulse/);
  assert.doesNotMatch(pulse, /Math\.random|mock data|demo data/i);
});

test('FatePrice owns a dedicated exact-card evidence page and fails closed', () => {
  assert.match(market, /route: '\/fate-price'/);
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
