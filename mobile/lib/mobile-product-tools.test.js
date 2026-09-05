const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabs = read('app/(tabs)/_layout.tsx');
const tools = read('app/tools.tsx');
const marketRoute = read('app/(tabs)/market.tsx');
const market = read('screens/fate-market-screen-v2.tsx');
const search = read('screens/search-screen-v2.tsx');
const fateFindRoute = read('app/fatefind.tsx');
const fateFind = read('screens/fatefind-live-screen-v2.tsx');
const fateMatch = read('screens/fatematch-screen-v2.tsx');
const fateDropId = read('services/fatedrop-id.ts');
const legacyTruePrice = read('app/true-price.tsx');
const fatePriceRoute = read('app/fate-price.tsx');
const fatePrice = read('screens/fate-price-screen.tsx');

test('primary navigation is Home, Alerts, FateDrop compass, Fate Market and Profile', () => {
  assert.match(tabs, /name="index"/);
  assert.match(tabs, /name="alerts"/);
  assert.match(tabs, /name="tools"/);
  assert.match(tabs, /FateDropNavEmblem/);
  assert.match(tabs, /setCompassOpen\(true\)/);
  assert.match(tabs, /accessibilityLabel="Open FateFind"/);
  assert.match(tabs, /title="FateMatch"/);
  assert.match(tabs, /title="Local Radar"/);
  assert.match(tabs, /title="Retailers"/);
  assert.match(tabs, /title="Fate Trader"/);
  assert.doesNotMatch(tabs, /<CompassNode[^>]*title="Search"/);
  assert.match(tabs, /title="Wishlist"/);
  assert.match(tabs, /name="market"/);
  assert.match(tabs, /name="network" options=\{\{ href: null \}\}/);
  assert.match(tabs, /name="profile"/);
  assert.match(tabs, /name="search" options=\{\{ href: null \}\}/);
  assert.match(tools, /title="FateFind"/);
  assert.match(tools, /title="FateMatch"/);
  assert.match(tools, /title="Fate Trader"/);
  assert.match(tools, /title="Local Radar"/);
  assert.match(tools, /title="Stores"/);
  assert.match(tools, /Search live database/);
  assert.match(tools, /Wishlist/);
  assert.match(marketRoute, /fate-market-screen-v2/);
  assert.match(market, /title: 'FatePulse'/);
  assert.match(market, /title: 'FatePrice'/);
  assert.match(market, /title: 'Fate Collectors'/);
  assert.doesNotMatch(market, /title: 'Fate Trader'/);
});

test('FateFind owns live value finding, visible True Price and one Cloud Fate Verdict', () => {
  assert.match(fateFindRoute, /fatefind-live-screen-v2/);
  assert.match(fateFind, /SIGNAL_ENGINE_URL/);
  assert.match(fateFind, /\/api\/fatefind\/matches/);
  assert.match(fateFind, /mode: 'verdict'/);
  assert.match(fateFind, /FATEDROP_WEB_URL/);
  assert.match(fateFind, /\/api\/fatefind\/verdict/);
  assert.match(fateFind, /FATEDROP_CLOUD/);
  assert.doesNotMatch(fateFind, /compareValueGroups/);
  assert.match(fateFind, /True Price shows what you will actually pay/);
  assert.match(fateFind, /Unknown delivery never becomes £0/);
  assert.match(fateFind, /FATE VERDICT/);
  assert.match(fateFind, /BEST ACROSS THIS SEARCH/);
  assert.match(fateFind, /Compare two items/);
  assert.match(fateFind, /KEEP HUNTING WITH FATEFIND/);
  assert.match(fateFind, /alertsEnabled: false/);
  assert.doesNotMatch(fateFind, /function\s+bestOffer|function\s+valuePosition|function\s+rankGroups/);
});

test('FateFind compare always uses two distinct product IDs and never fakes a waiting request', () => {
  assert.match(fateFind, /compareLeftId === compareRightId/);
  assert.match(fateFind, /excludedId/);
  assert.match(fateFind, /group\.id !== excludedId/);
  assert.match(fateFind, /fatefind-cloud-pair-verdict-missing/);
  assert.doesNotMatch(fateFind, /Waiting for FateDrop Cloud to return the canonical head-to-head verdict/);
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

test('chosen companion travels with synced FateMatches and is visible on the result', () => {
  assert.match(fateDropId, /export type FateFindCompanionId = 'koru'\|'fenn'\|'oru'\|'nyxen'/);
  assert.match(fateDropId, /companionId:FateFindCompanionId/);
  assert.match(fateDropId, /isCompanionId\(match\.companionId\)\?match\.companionId:'koru'/);
  assert.match(fateMatch, /companionName\(match\.companionId\)/);
  assert.match(fateMatch, /found this/);
});

test('Search remains passive database discovery and hands intelligent work to FateFind', () => {
  assert.match(search, /RUN FATEFIND/);
  assert.match(search, /alertsEnabled: false/);
  assert.match(search, /FateFind owns the intelligent value verdict and persistent hunt/);
  assert.doesNotMatch(search, /WATCH WITH FATEMATCH/);
  assert.doesNotMatch(search, /FATE VERDICT/);
  assert.doesNotMatch(search, /saveRemoteFateFind/);
});

test('legacy True Price deep links resolve into the dedicated FatePrice page', () => {
  assert.match(legacyTruePrice, /Redirect/);
  assert.match(legacyTruePrice, /pathname: '\/fate-price'/);
  assert.match(fatePriceRoute, /fate-price-screen/);
  assert.match(fatePrice, /fetchFatePrice/);
  assert.doesNotMatch(fatePrice, /\/fatefind/);
});
