const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const marketRoute = read('app/(tabs)/market.tsx');
const market = read('screens/fate-market-screen-v2.tsx');
const pulseRoute = read('app/fate-pulse/index.tsx');
const pulseOverview = read('screens/fate-pulse-overview-screen.tsx');
const pulseSetsRoute = read('app/fate-pulse/sets.tsx');
const pulseCardsRoute = read('app/fate-pulse/cards.tsx');
const myPulseRoute = read('app/fate-pulse/my-pulse.tsx');
const pulseScreen = read('screens/fate-pulse-screen.tsx');
const home = read('screens/home-screen-v3.tsx');
const dock = read('components/persistent-bottom-nav.tsx');

test('Fate Market keeps the approved entry screen and only hands FatePulse off to its dedicated route', () => {
  assert.match(marketRoute, /fate-market-screen-v2/);
  assert.match(market, /title: 'FatePulse'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Collections'/);
  assert.match(market, /key === 'pulse' \? router\.push\('\/fate-pulse'\)/);
  assert.match(market, /key === 'price' \? router\.push\('\/fate-price'\)/);
  assert.match(market, /: setActiveArea\(key\)/);
});

test('FatePulse Overview is the simple investor dashboard', () => {
  assert.match(pulseRoute, /fate-pulse-overview-screen/);
  assert.match(pulseOverview, /Search any card or set/);
  assert.match(pulseOverview, /Overview/);
  assert.match(pulseOverview, /Sets/);
  assert.match(pulseOverview, /Cards/);
  assert.match(pulseOverview, /My Pulse/);
  assert.match(pulseOverview, /Biggest Card Risers/);
  assert.match(pulseOverview, /Biggest Card Fallers/);
  assert.match(pulseOverview, /Sets Heating Up/);
  assert.match(pulseOverview, /key: 'd1', label: '1D'/);
  assert.match(pulseOverview, /key: 'd7', label: '7D'/);
  assert.match(pulseOverview, /key: 'd30', label: '30D'/);
  assert.match(pulseOverview, /key: 'd90', label: '90D'/);
  assert.doesNotMatch(pulseOverview, /MARKET DIRECTION|OrbMetric|orbitOuter|INDEX NOT CONNECTED|EVIDENCE COVERAGE/);
});

test('FatePulse keeps routed Sets, Cards and My Pulse depth', () => {
  assert.match(pulseSetsRoute, /initialView="sets"/);
  assert.match(pulseCardsRoute, /initialView="cards"/);
  assert.match(myPulseRoute, /initialView="watchlist"/);
  assert.match(pulseScreen, /'\/fate-pulse\/sets'/);
  assert.match(pulseScreen, /'\/fate-pulse\/cards'/);
  assert.match(pulseScreen, /'\/fate-pulse\/my-pulse'/);
});

test('Home opens the real investor and collection hubs without an extra preview tap', () => {
  assert.match(home, /onPress=\{\(\) => router\.push\('\/fate-pulse'\)\}/);
  assert.match(home, /onPress=\{\(\) => router\.push\('\/collections'\)\}/);
});

test('Pulse stays Cloud-owned and never invents unsupported intelligence', () => {
  assert.match(pulseOverview, /fetchFatePulse/);
  assert.match(pulseOverview, /Only verified market movement is shown/);
  assert.match(pulseOverview, /90-day rankings will appear when verified 90D market history is available/);
  assert.match(pulseScreen, /Most Watched needs a canonical global card-watch signal/);
  assert.match(pulseScreen, /High Volume needs a verified market-liquidity or sales-volume source/);
  assert.match(pulseScreen, /Wishlist remains separate: it saves retail products/);
  assert.doesNotMatch(pulseOverview, /Math\.random|mock data|demo data/i);
});

test('Card movers drill into exact FatePrice evidence', () => {
  assert.match(pulseOverview, /pathname: '\/fate-price'/);
  assert.match(pulseOverview, /cardId: item\.cardIdentityId/);
  assert.match(pulseScreen, /FatePrice evidence/);
});

test('Fate Market family keeps persistent bottom navigation', () => {
  assert.match(dock, /'\/fate-pulse'/);
  assert.match(dock, /'\/fate-price'/);
  assert.match(dock, /'\/collection'/);
});
