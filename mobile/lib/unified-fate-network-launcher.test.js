const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabLayout = read('app/(tabs)/_layout.tsx');
const persistentDock = read('components/persistent-bottom-nav.tsx');
const tools = read('app/tools.tsx');
const market = read('screens/fate-market-screen.tsx');
const profile = read('screens/profile-screen-v2.tsx');

function assertCompassDestinations(source) {
  assert.match(source, /accessibilityLabel="Open FateFind"/);
  assert.match(source, /title="FateMatch"/);
  assert.match(source, /title="Local Radar"/);
  assert.match(source, /title="Retailers"/);
  assert.match(source, /title="Search"/);
  assert.match(source, /title="Wishlist"/);
  assert.doesNotMatch(source, /title="Fate Trader"/);
}

test('main centre compass keeps the approved hunting and discovery destinations', () => {
  assertCompassDestinations(tabLayout);
});

test('Fate Market owns Trader Pulse and Collectors in the former Live Network slot', () => {
  assert.match(tabLayout, /name="market"/);
  assert.match(tabLayout, /name="network" options=\{\{ href: null \}\}/);
  assert.match(market, /title: 'Fate Trader'/);
  assert.match(market, /title: 'FatePulse'/);
  assert.match(market, /title: 'Fate Collectors'/);
  assert.match(persistentDock, /label="Fate Market"/);
  assert.doesNotMatch(persistentDock, /label="Live Network"/);
});

test('full tools directory remains available and Live Network moves to Profile', () => {
  assert.match(tools, /title="FateFind"/);
  assert.match(tools, /title="FateMatch"/);
  assert.match(tools, /title="Fate Trader"/);
  assert.match(tools, /title="Local Radar"/);
  assert.match(tools, /title="Stores"/);
  assert.match(tools, /Search live database/);
  assert.match(tools, /Wishlist/);
  assert.match(persistentDock, /router\.push\('\/tools'\)/);
  assert.match(profile, /title="Live Network"/);
  assert.match(profile, /router\.push\('\/\(tabs\)\/network'\)/);
});
