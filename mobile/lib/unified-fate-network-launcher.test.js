const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabLayout = read('app/(tabs)/_layout.tsx');
const persistentDock = read('components/persistent-bottom-nav.tsx');
const tools = read('app/tools.tsx');

function assertAllDestinations(source) {
  assert.match(source, /title="FateFind"/);
  assert.match(source, /title="FateMatch"/);
  assert.match(source, /title="Fate Trader"/);
  assert.match(source, /title="Local Radar"/);
  assert.match(source, /title="(?:Retailers|Stores)"/);
  assert.match(source, /title="Search live database"/);
  assert.match(source, /title="Wishlist"/);
}

test('main centre Fate Network menu exposes every current destination', () => {
  assertAllDestinations(tabLayout);
});

test('full Fate Network launcher exposes the same destination set', () => {
  assertAllDestinations(tools);
  assert.match(persistentDock, /router\.push\('\/tools'\)/);
});
