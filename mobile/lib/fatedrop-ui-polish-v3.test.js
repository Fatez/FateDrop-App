const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

const profileRoute = read('app/(tabs)/profile.tsx');
const moreRoute = read('app/(tabs)/more.tsx');
const watchlistRoute = read('app/(tabs)/watchlist.tsx');
const searchRoute = read('app/(tabs)/search.tsx');
const fateMatchRoute = read('app/fate-match.tsx');
const bindersRoute = read('app/binders.tsx');
const binderRoute = read('app/binder/[setId].tsx');

const profile = read('screens/profile-screen-v3.tsx');
const more = read('screens/more-screen-v3.tsx');
const watchlist = read('screens/watchlist-screen-v2.tsx');
const search = read('screens/search-screen-v3.tsx');
const fateMatch = read('screens/fatematch-screen-v3.tsx');
const binders = read('screens/fate-binders-screen-v2.tsx');
const binder = read('screens/fate-binder-screen-v2.tsx');
const catalogueHook = read('hooks/use-catalogue.ts');

test('Profile and More route to the new FateDrop command-centre experience', () => {
  assert.match(profileRoute, /profile-screen-v3/);
  assert.match(moreRoute, /more-screen-v3/);
  assert.match(profile, /FATEDROP COMMAND CENTRE/);
  assert.match(profile, /notificationPreferences\?\.push/);
  assert.doesNotMatch(profile, /notificationPreferences\?\.app/);
  assert.match(profile, /Live Network/);
  assert.match(profile, /FateFind & FateMatch/);
  assert.match(more, /FATEDROP TOOL DIRECTORY/);
  assert.match(more, /The machinery stays behind the experience/);
});

test('Wishlist keeps saved products distinct from watching, FateFind and FateMatch', () => {
  assert.match(watchlistRoute, /watchlist-screen-v2/);
  assert.match(watchlist, /SAVE · WATCH · HUNT/);
  assert.match(watchlist, /No target price lives on Wishlist/);
  assert.match(watchlist, /SET FATEFIND RULES/);
  assert.match(watchlist, /SAVED ONLY/);
  assert.match(watchlist, /WATCHING/);
  assert.match(watchlist, /FATEMATCHES/);
});

test('Search guides TCG to product to verified set before scoped catalogue evidence', () => {
  assert.match(searchRoute, /search-screen-v3/);
  assert.match(search, /TCG/);
  assert.match(search, /PRODUCT/);
  assert.match(search, /VERIFIED SET/);
  assert.match(search, /fetchFatePriceSets/);
  assert.match(search, /setName: selectedSet\?\.name/);
  assert.match(search, /enabled: discoveryReady/);
  assert.match(search, /will not fake a TCG filter/);
  assert.match(catalogueHook, /enabled\?: boolean/);
});

test('FateMatch is presented as a qualified FateFind outcome, not another watchlist', () => {
  assert.match(fateMatchRoute, /fatematch-screen-v3/);
  assert.match(fateMatch, /FATEMATCH · QUALIFIED OUTCOMES/);
  assert.match(fateMatch, /These are outcomes/);
  assert.match(fateMatch, /FATEFIND · SEARCHING NOW/);
  assert.match(fateMatch, /Unknown delivery never qualifies as free delivery/);
  assert.match(fateMatch, /saveRemoteFateFind/);
});

test('Binders foreground verified completion and exact missing-card identity', () => {
  assert.match(bindersRoute, /fate-binders-screen-v2/);
  assert.match(binderRoute, /fate-binder-screen-v2/);
  assert.match(binders, /CLOSEST TO COMPLETION/);
  assert.match(binders, /NEXT CARDS TO FIND/);
  assert.match(binders, /Collectr/);
  assert.match(binder, /STILL NEEDED/);
  assert.match(binder, /NEEDED/);
  assert.match(binder, /Exact raw printings only/);
  assert.match(binder, /Graded cards never fill binder slots/);
});
