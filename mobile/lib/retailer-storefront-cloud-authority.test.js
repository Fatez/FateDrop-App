const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const search = fs.readFileSync(path.join(root, 'screens', 'search-screen-v2.tsx'), 'utf8');
const retailers = fs.readFileSync(path.join(root, 'screens', 'indies-screen-v2.tsx'), 'utf8');
const storefront = fs.readFileSync(path.join(root, 'app', 'retailers', '[id].tsx'), 'utf8');
const retailerService = fs.readFileSync(path.join(root, 'services', 'retailer-directory.ts'), 'utf8');
const localRadar = fs.readFileSync(path.join(root, 'app', 'local-radar.tsx'), 'utf8');
const localStore = fs.readFileSync(path.join(root, 'app', 'local-radar-store.tsx'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
const retailerHero = fs.readFileSync(path.join(root, 'constants', 'retailer-hero.ts'), 'utf8');

test('Search retailer identity comes from the Cloud retailer directory', () => {
  assert.match(search, /fetchRetailerDirectory/);
  assert.match(search, /retailerDirectory/);
  assert.doesNotMatch(search, /@\/constants\/retailers/);
  assert.match(search, /pathname: '\/retailers\/\[id\]'/);
  assert.match(search, /id: offer\.retailerId/);
});

test('retailer storefront resolves Cloud profile first and excludes static demo truth', () => {
  assert.match(storefront, /fetchRetailerProfile/);
  assert.match(storefront, /fetchRetailerDirectory/);
  assert.match(storefront, /result\.retailers\.find/);
  assert.doesNotMatch(storefront, /@\/constants\/retailers/);
  assert.doesNotMatch(storefront, /retailer\.isDemo/);
  assert.match(retailerService, /\/api\/retailers\/\$\{encodeURIComponent\(retailerId\)\}/);
  assert.match(retailerService, /NetworkRetailerLocation/);
  assert.match(storefront, /Branch stock remains unknown unless Local Radar has exact-branch evidence/);
});

test('Fate Network exposes one Retailers entry rather than a competing independent-store tool', () => {
  assert.match(tabs, /title="Retailers"/);
  assert.match(tabs, /Browse major retailers, TCG specialists and independent or local storefronts/);
  assert.doesNotMatch(tabs, /title="Support Independent Stores"/);
  assert.match(tabs, /openTool\('\/\(tabs\)\/indies'\)/);
});

test('Retailers categorises the same Cloud directory into major, specialist and independent-local views', () => {
  assert.match(retailers, /type RetailerView = 'all' \| 'major' \| 'specialist' \| 'local'/);
  assert.match(retailers, /retailer\.retailerClass === 'national'/);
  assert.match(retailers, /retailer\.retailerClass === 'specialist'/);
  assert.match(retailers, /\['independent', 'regional'\]\.includes\(retailer\.retailerClass\)/);
  assert.match(retailers, /label="Major Retailers"/);
  assert.match(retailers, /label="TCG Specialists"/);
  assert.match(retailers, /label="Independent & Local"/);
  assert.match(retailers, /fetchRetailerDirectory/);
  assert.doesNotMatch(retailers, /@\/constants\/retailers/);
});

test('Retailers mirrors the approved premium discovery mockup without hard-coded retailer examples', () => {
  assert.match(retailers, /retailerHeroUri/);
  assert.match(retailerHero, /data:image\/webp;base64/);
  assert.match(retailers, /Discover the/);
  assert.match(retailers, /stores behind/);
  assert.match(retailers, /the hobby\./);
  assert.match(retailers, /Retailer storefronts/);
  assert.match(retailers, /A–Z · NO RANKING/);
  assert.doesNotMatch(retailers, /Smyths Toys/);
  assert.doesNotMatch(retailers, /Chaos Cards/);
  assert.doesNotMatch(retailers, /Cob & Pip/);
  assert.doesNotMatch(retailers, /Titan Cards/);
});

test('Retailers stays business-first and sends product discovery to FateFind', () => {
  assert.match(retailers, /Search retailer or TCG/);
  assert.match(retailers, /Looking for a product\? Use FateFind\./);
  assert.match(retailers, /router\.push\('\/fatefind'\)/);
  assert.match(retailers, /same comparison pool/);
  assert.match(retailers, /localeCompare/);
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

test('individual storefront mirrors approved mockup while searching only its own strict in-stock catalogue', () => {
  assert.match(storefront, /PREMIUM CARDS · REAL CONNECTIONS/);
  assert.match(storefront, /retailerHeroUri/);
  assert.match(storefront, /Visit retailer/);
  assert.match(storefront, /Find stores/);
  assert.match(storefront, /Shop catalogue/);
  assert.match(storefront, /useLocalSearchParams<\{ id\?: string \}>/);
  assert.match(storefront, /query: cleanCatalogueQuery \|\| undefined/);
  assert.match(storefront, /item\.stockStatus === 'IN_STOCK' && !item\.preorder/);
  assert.match(storefront, /Search only \{retailer\.name\}'s connected in-stock offers/);
  assert.match(storefront, /Trading card games/);
  assert.match(storefront, /retailer\.tcgs\.map\(tcgLabel\)/);
});

test('storefront renders canonical known branch addresses without treating them as stock', () => {
  assert.match(storefront, /retailer\.locations\?\.length/);
  assert.match(storefront, /PHYSICAL LOCATIONS/);
  assert.match(storefront, /location\.address/);
  assert.match(storefront, /location\.postcode/);
  assert.match(storefront, /VIEW THIS RETAILER IN LOCAL RADAR/);
  assert.match(storefront, /Online retailer availability never proves stock at a physical branch/);
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