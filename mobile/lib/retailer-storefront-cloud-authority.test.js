const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const search = fs.readFileSync(path.join(root, 'screens', 'search-screen-v2.tsx'), 'utf8');
const retailers = fs.readFileSync(path.join(root, 'screens', 'indies-screen-v2.tsx'), 'utf8');
const storefront = fs.readFileSync(path.join(root, 'app', 'retailers', '[id].tsx'), 'utf8');
const localRadar = fs.readFileSync(path.join(root, 'app', 'local-radar.tsx'), 'utf8');
const localStore = fs.readFileSync(path.join(root, 'app', 'local-radar-store.tsx'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');

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

test('Fate Network separates all retailer discovery from independent-store discovery without a second data source', () => {
  assert.match(tabs, /title="Retailers"/);
  assert.match(tabs, /title="Support Independent Stores"/);
  assert.match(tabs, /openRetailers\('all'\)/);
  assert.match(tabs, /openRetailers\('independent'\)/);
  assert.match(retailers, /useLocalSearchParams<\{ view\?: string \}>/);
  assert.match(retailers, /\['independent', 'regional', 'specialist'\]/);
  assert.match(retailers, /fetchRetailerDirectory/);
  assert.doesNotMatch(retailers, /@\/constants\/retailers/);
});

test('Retailers stays business-first and leaves cross-retailer product discovery to FateFind', () => {
  assert.match(retailers, /Search retailer or TCG/);
  assert.match(retailers, /FateFind still owns product comparison across the full market/);
  assert.match(retailers, /localeCompare/);
  assert.match(retailers, /NO RANKING/);
  assert.doesNotMatch(retailers, /useCatalogue/);
  assert.doesNotMatch(retailers, /offersByRetailer/);
  assert.doesNotMatch(retailers, /MATCHING IN-STOCK/);
  assert.doesNotMatch(retailers, /Search a retailer or product/);
});

test('retailer directory cards open the internal Cloud-backed storefront', () => {
  assert.match(retailers, /pathname: '\/retailers\/\[id\]'/);
  assert.match(retailers, /id: retailer\.id/);
  assert.doesNotMatch(retailers, /Linking\.openURL\(retailer\.websiteUrl\)/);
});

test('individual storefront can search its own strict in-stock catalogue and exposes retailer TCGs', () => {
  assert.match(storefront, /useLocalSearchParams<\{ id\?: string \}>/);
  assert.match(storefront, /query: cleanCatalogueQuery \|\| undefined/);
  assert.match(storefront, /item\.stockStatus === 'IN_STOCK' && !item\.preorder/);
  assert.match(storefront, /Search only \{retailer\.name\}'s connected in-stock offers/);
  assert.match(storefront, /Trading card games/);
  assert.match(storefront, /retailer\.tcgs\.map\(tcgLabel\)/);
});

test('storefront deep-links physical retailers into Local Radar by canonical retailer id', () => {
  assert.match(storefront, /pathname: '\/local-radar'/);
  assert.match(storefront, /retailerId: retailer\.id/);
  assert.match(localRadar, /useLocalSearchParams<\{ retailerId\?: string; retailerName\?: string \}>/);
  assert.match(localRadar, /shop\.retailerId === scopedRetailerId/);
  assert.match(localRadar, /does not match stores by name or infer physical stock from the retailer's online catalogue/);
});

test('Local Radar keeps exact-branch physical evidence separate and links back by canonical retailer id', () => {
  assert.match(localStore, /does not infer physical stock from an online product page or retailer-wide availability/);
  assert.match(localStore, /pathname: '\/retailers\/\[id\]'/);
  assert.match(localStore, /id: shop\.retailerId!/);
});