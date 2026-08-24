const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const shared = read('components/fatedrop-ui.tsx');
const home = read('screens/home-screen-v2.tsx');
const tabs = read('app/(tabs)/_layout.tsx');

test('final cosmic artwork is the shared FateDrop app background', () => {
  assert.match(shared, /app-background-cosmic\.jpg/);
  assert.doesNotMatch(shared, /fatedrop-portal-hero\.png/);
});

test('shared brand header uses the supplied FateDrop wordmark and emblem', () => {
  assert.match(shared, /fatedrop-wordmark\.webp/);
  assert.match(shared, /fatedrop-emblem\.webp/);
  assert.doesNotMatch(shared, /brandTextAccent/);
});

test('Home uses the final Koru hero and greets the FateDrop ID display name', () => {
  assert.match(home, /home-koru-hero\.jpg/);
  assert.match(home, /snapshot\?\.user\.displayName\?\.trim\(\)/);
  assert.match(home, /Welcome, \$\{displayName\}/);
  assert.match(home, /fatedrop-wordmark\.webp/);
});

test('center tool launcher uses the final compact FateDrop emblem', () => {
  assert.match(tabs, /fatedrop-emblem\.webp/);
  assert.doesNotMatch(tabs, /fatedrop-center-emblem\.png/);
});
