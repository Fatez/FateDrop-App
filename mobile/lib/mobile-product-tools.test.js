const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabs = read('app/(tabs)/_layout.tsx');
const search = read('screens/search-screen-v2.tsx');
const fateFind = read('screens/fatefind-live-screen.tsx');
const fateMatch = read('screens/fatematch-screen-v2.tsx');
const legacyTruePrice = read('app/true-price.tsx');

test('primary navigation is Home, Alerts, FateDrop emblem, Network and Profile', () => {
  assert.match(tabs, /name="index"/);
  assert.match(tabs, /name="alerts"/);
  assert.match(tabs, /name="tools"/);
  assert.match(tabs, /fatedrop-emblem\.webp/);
  assert.match(tabs, /name="network"/);
  assert.match(tabs, /name="profile"/);
  assert.match(tabs, /title="FateFind"/);
  assert.match(tabs, /title="FateMatch"/);
  assert.match(tabs, /title="Search live database"/);
});

test('FateFind owns live value finding, RRP calculations, True Price and Fate Verdict', () => {
  assert.match(fateFind, /\/api\/true-price/);
  assert.match(fateFind, /compareValueGroups/);
  assert.match(fateFind, /True Price is built into FateFind/);
  assert.match(fateFind, /FATE VERDICT/);
  assert.match(fateFind, /Compare two items/);
  assert.doesNotMatch(fateFind, /saveRemoteFateFind/);
});

test('FateMatch owns Cloud watch rules including maximum percentage above RRP', () => {
  assert.match(fateMatch, /saveRemoteFateFind/);
  assert.match(fateMatch, /maxPercentAboveRrp/);
  assert.match(fateMatch, /\['0', '5', '10', 'custom'\]/);
  assert.match(fateMatch, /stockRequirement: 'in_stock'/);
  assert.match(fateMatch, /START FATEMATCH/);
  assert.match(fateMatch, /FATEMATCH — LIVE NOW/);
});

test('Search remains database discovery and hands off to FateFind or FateMatch', () => {
  assert.match(search, /RUN FATEFIND/);
  assert.match(search, /WATCH WITH FATEMATCH/);
  assert.doesNotMatch(search, /FATE VERDICT/);
  assert.doesNotMatch(search, /saveRemoteFateFind/);
});

test('legacy True Price deep links resolve into FateFind instead of a duplicate tool', () => {
  assert.match(legacyTruePrice, /Redirect/);
  assert.match(legacyTruePrice, /pathname: '\/fatefind'/);
});
