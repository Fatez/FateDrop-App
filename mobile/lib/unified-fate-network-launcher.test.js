const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabLayout = read('app/(tabs)/_layout.tsx');
const persistentDock = read('components/persistent-bottom-nav.tsx');
const tools = read('app/tools.tsx');

test('both centre Fate Network emblems open the same canonical launcher', () => {
  assert.match(tabLayout, /router\.push\('\/tools'\)/);
  assert.match(persistentDock, /router\.push\('\/tools'\)/);
  assert.doesNotMatch(tabLayout, /toolboxOpen|<Modal|ToolChoice/);
});

test('canonical Fate Network launcher exposes Search and Wishlist alongside core jobs', () => {
  assert.match(tools, /title="FateFind"/);
  assert.match(tools, /title="FateMatch"/);
  assert.match(tools, /title="Fate Trader"/);
  assert.match(tools, /title="Local Radar"/);
  assert.match(tools, /title="Stores"/);
  assert.match(tools, /title="Search live database"/);
  assert.match(tools, /title="Wishlist"/);
});
