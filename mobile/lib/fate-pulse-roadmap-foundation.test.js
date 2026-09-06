const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const marketRoute = read('app/(tabs)/market.tsx');
const market = read('screens/fate-market-screen-v2.tsx');
const pulseRoute = read('app/fate-pulse.tsx');
const pulseScreen = read('screens/fate-pulse-screen.tsx');
const dock = read('components/persistent-bottom-nav.tsx');

test('Fate Market keeps the approved entry screen', () => {
  assert.match(marketRoute, /fate-market-screen-v2/);
  assert.match(market, /title: 'FatePulse'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Collections'/);
});

test('FatePulse has the locked exploration roadmap', () => {
  assert.match(pulseRoute, /fate-pulse-screen/);
  assert.match(pulseScreen, /key: 'overview', label: 'Overview'/);
  assert.match(pulseScreen, /key: 'sets', label: 'Sets'/);
  assert.match(pulseScreen, /key: 'cards', label: 'Cards'/);
  assert.match(pulseScreen, /key: 'watchlist', label: 'Watchlist'/);
  assert.match(pulseScreen, /key: 'd1', label: '1D'/);
  assert.match(pulseScreen, /key: 'd7', label: '7D'/);
  assert.match(pulseScreen, /key: 'd30', label: '30D'/);
  assert.match(pulseScreen, /key: 'd90', label: '90D'/);
});

test('Pulse stays Cloud-owned and never invents unsupported intelligence', () => {
  assert.match(pulseScreen, /fetchFatePulse/);
  assert.match(pulseScreen, /NOT SCORED/);
  assert.match(pulseScreen, /90D remains visibly unscored until Cloud owns it/);
  assert.match(pulseScreen, /Most Watched needs a canonical global card-watch signal/);
  assert.match(pulseScreen, /High Volume needs a verified market-liquidity or sales-volume source/);
  assert.doesNotMatch(pulseScreen, /Math\.random|mock data|demo data/i);
});

test('Card movers drill into exact FatePrice evidence', () => {
  assert.match(pulseScreen, /pathname: '\/fate-price'/);
  assert.match(pulseScreen, /cardId: item\.cardIdentityId/);
  assert.match(pulseScreen, /FatePrice evidence/);
});

test('Fate Market family keeps persistent bottom navigation', () => {
  assert.match(dock, /'\/fate-pulse'/);
  assert.match(dock, /'\/fate-price'/);
  assert.match(dock, /'\/collection'/);
});
