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
  assert.match(tabs, /fatedrop-center-emblem\.png/);
  assert.match(tabs, /name="network"/);
  assert.match(tabs, /name="profile"/);
  assert.match(tabs, /title="FateFind"/);
  assert.match(tabs, /title="FateMatches"/);
  assert.match(tabs, /title="Search live database"/);
});

test('FateFind owns live value finding, visible True Price and one Cloud Fate Verdict', () => {
  assert.match(fateFind, /\/api\/fatefind\/matches/);
  assert.match(fateFind, /mode: 'verdict'/);
  assert.match(fateFind, /FATEDROP_CLOUD/);
  assert.doesNotMatch(fateFind, /compareValueGroups/);
  assert.match(fateFind, /True Price shows what you will actually pay/);
  assert.match(fateFind, /Unknown delivery never becomes £0/);
  assert.match(fateFind, /FATE VERDICT/);
  assert.match(fateFind, /BEST ACROSS THIS SEARCH/);
  assert.match(fateFind, /Compare two items/);
  assert.match(fateFind, /KEEP HUNTING WITH FATEFIND/);
  assert.match(fateFind, /alertsEnabled: false/);
  assert.doesNotMatch(fateFind, /compareValueGroups/);
});

test('FateFind owns hosted hunt rules and FateMatch is the successful outcome', () => {
  assert.match(fateMatch, /saveRemoteFateFind/);
  assert.match(fateMatch, /maxPercentAboveRrp/);
  assert.match(fateMatch, /maxTruePricePence/);
  assert.match(fateMatch, /\['0', '5', '10', 'custom'\]/);
  assert.match(fateMatch, /stockRequirement: 'in_stock'/);
  assert.match(fateMatch, /companionId/);
  assert.match(fateMatch, /START FATEFIND/);
  assert.match(fateMatch, /FATEMATCH — LIVE NOW/);
  assert.match(fateMatch, /A FateMatch means FateFind found what you asked for/);
  assert.doesNotMatch(fateMatch, /START FATEMATCH/);
});

test('Search remains passive database discovery and hands intelligent work to FateFind', () => {
  assert.match(search, /RUN FATEFIND/);
  assert.match(search, /alertsEnabled: false/);
  assert.match(search, /FateFind owns the intelligent value verdict and persistent hunt/);
  assert.doesNotMatch(search, /WATCH WITH FATEMATCH/);
  assert.doesNotMatch(search, /FATE VERDICT/);
  assert.doesNotMatch(search, /saveRemoteFateFind/);
});

test('legacy True Price deep links resolve into FateFind instead of a duplicate tool', () => {
  assert.match(legacyTruePrice, /Redirect/);
  assert.match(legacyTruePrice, /pathname: '\/fatefind'/);
});
