const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const compass = fs.readFileSync(path.join(__dirname, '..', 'components', 'fate-network-compass.tsx'), 'utf8');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabLayout = read('app/(tabs)/_layout.tsx');
const persistentDock = read('components/persistent-bottom-nav.tsx');
const tools = read('app/tools.tsx');
const market = read('screens/fate-market-screen-v2.tsx');
const profile = read('screens/profile-screen-v2.tsx');

function assertCompassDestinations(source) {
  assert.match(compass, /title: 'FateFind'/);
  assert.match(compass, /title: 'FateMatch'/);
  assert.match(compass, /title: 'Local Radar'/);
  assert.match(compass, /title: 'Retailers'/);
  assert.doesNotMatch(compass, /fate-trader|Fate Trader/);
  assert.match(compass, /title: 'Wishlist'/);
  assert.doesNotMatch(source, /<CompassNode[^>]*title="Search"/);
}

test('main centre compass keeps the approved hunting and action destinations', () => {
  assertCompassDestinations(tabLayout);
});

test('Fate Market owns Pulse Price and Collections in the former Live Network slot', () => {
  assert.match(tabLayout, /name="market"/);
  assert.match(tabLayout, /name="network" options=\{\{ href: null \}\}/);
  assert.match(market, /title: 'FateInsight'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Collections'/);
  assert.doesNotMatch(market, /title: 'Fate Trader'/);
  assert.match(persistentDock, /label="Fate Market"/);
  assert.doesNotMatch(persistentDock, /label="Live Network"/);
});

test('full tools directory remains available and Live Network moves to Profile', () => {
  assert.match(tools, /title="FateFind"/);
  assert.match(tools, /title="FateMatch"/);
  assert.doesNotMatch(tools, /title="Fate Trader"/);
  assert.match(tools, /title="Local Radar"/);
  assert.match(tools, /title="Stores"/);
  assert.match(tools, /Search live database/);
  assert.match(tools, /Wishlist/);
  assert.match(persistentDock, /<FateNetworkCompass/);
  assert.match(profile, /title="Live Network"/);
  assert.match(profile, /router\.push\('\/\(tabs\)\/network'\)/);
});
