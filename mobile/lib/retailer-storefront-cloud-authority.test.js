const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const search = fs.readFileSync(path.join(root, 'screens', 'search-screen-v2.tsx'), 'utf8');
const retailers = fs.readFileSync(path.join(root, 'screens', 'indies-screen-v2.tsx'), 'utf8');
const storefront = fs.readFileSync(path.join(root, 'app', 'retailers', '[id].tsx'), 'utf8');
const localStore = fs.readFileSync(path.join(root, 'app', 'local-radar-store.tsx'), 'utf8');

test('Search retailer identity comes from the Cloud retailer directory', () => {
  assert.match(search, /fetchRetailerDirectory/);
  assert.match(search, /retailerDirectory/);
  assert.doesNotMatch(search, /@\/constants\/retailers/);
  assert.match(search, /pathname: '\/retailers\/\[id\]'/);
  assert.match(search, /id: offer\.retailerId/);
});

test('retailer storefront resolves the retailer from the Cloud directory and excludes static demo truth', () => {
  assert.match(storefront, /fetchRetailerDirectory/);
  assert.match(storefront, /result\.retailers\.find/);
  assert.doesNotMatch(storefront, /@\/constants\/retailers/);
  assert.doesNotMatch(storefront, /retailer\.isDemo/);
  assert.doesNotMatch(storefront, /retailer\.locations/);
  assert.match(storefront, /Branch stock is separate and remains unknown unless Local Radar has exact-branch evidence/);
});

test('Retailers is a neutral storefront discovery page rather than a major-vs-indie ranking surface', () => {
  assert.match(retailers, /FATE NETWORK STOREFRONTS/);
  assert.match(retailers, /Search a retailer or product/);
  assert.match(retailers, /This page does not rank shops/);
  assert.match(retailers, /localeCompare/);
  assert.doesNotMatch(retailers, /RRP \/ Major/);
  assert.doesNotMatch(retailers, /Retailer directory/);
  assert.doesNotMatch(retailers, /Live offers/);
});

test('Retailers product search only surfaces storefront retailers with strict in-stock evidence', () => {
  assert.match(retailers, /retailer\.retailerClass !== 'event_vendor'/);
  assert.match(retailers, /inStockOnly: true/);
  assert.match(retailers, /offer\.stockStatus === 'IN_STOCK' && !offer\.preorder/);
  assert.match(retailers, /offersByRetailer/);
  assert.match(retailers, /MATCHING IN-STOCK/);
  assert.match(retailers, /params: matchingOffers\.length > 0 \? \{ id: retailer\.id, q: searchTerm \}/);
});

test('retailer directory cards open the internal Cloud-backed storefront', () => {
  assert.match(retailers, /pathname: '\/retailers\/\[id\]'/);
  assert.match(retailers, /id: retailer\.id/);
  assert.doesNotMatch(retailers, /Linking\.openURL\(retailer\.websiteUrl\)/);
});

test('storefront preserves a retailer product search context without weakening stock truth', () => {
  assert.match(storefront, /useLocalSearchParams<\{ id\?: string; q\?: string \}>/);
  assert.match(storefront, /query: productQuery \|\| undefined/);
  assert.match(storefront, /item\.stockStatus === 'IN_STOCK' && !item\.preorder/);
  assert.match(storefront, /Showing this storefront's current in-stock matches/);
});

test('Local Radar keeps exact-branch physical evidence separate and links back by canonical retailer id', () => {
  assert.match(localStore, /does not infer physical stock from an online product page or retailer-wide availability/);
  assert.match(localStore, /pathname: '\/retailers\/\[id\]'/);
  assert.match(localStore, /id: shop\.retailerId!/);
});
