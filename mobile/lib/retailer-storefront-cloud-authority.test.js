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

test('retailer directory cards open the internal Cloud-backed storefront', () => {
  assert.match(retailers, /pathname: '\/retailers\/\[id\]'/);
  assert.match(retailers, /params: \{ id: retailer\.id \}/);
  assert.doesNotMatch(retailers, /Linking\.openURL\(retailer\.websiteUrl\)/);
});

test('Local Radar keeps exact-branch physical evidence separate and links back by canonical retailer id', () => {
  assert.match(localStore, /does not infer physical stock from an online product page or retailer-wide availability/);
  assert.match(localStore, /pathname: '\/retailers\/\[id\]'/);
  assert.match(localStore, /id: shop\.retailerId!/);
});
