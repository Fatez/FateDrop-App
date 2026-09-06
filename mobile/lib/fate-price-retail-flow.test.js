const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const discovery = read('screens/fate-price-discovery-screen.tsx');
const setView = read('screens/fate-price-set-screen.tsx');
const variants = read('screens/fate-price-variants-screen.tsx');
const detail = read('screens/fate-price-screen.tsx');
const buy = read('screens/fate-price-buy-screen.tsx');
const service = read('services/fate-market.ts');
const chrome = read('components/fate-price-chrome.tsx');
const layout = read('app/_layout.tsx');

test('FatePrice is a five-surface exact identity journey', () => {
  assert.match(discovery, /pathname: '\/fate-price-set'/);
  assert.match(discovery, /pathname: '\/fate-price-variants'/);
  assert.match(setView, /pathname: '\/fate-price-variants'/);
  assert.match(variants, /pathname: '\/fate-price'/);
  assert.match(detail, /pathname: '\/fate-price-buy'/);
  for (const route of ['fate-price', 'fate-price-set', 'fate-price-variants', 'fate-price-buy']) {
    assert.match(layout, new RegExp(`name="${route}"`));
  }
});

test('set browsing keeps finish, rarity and language as independent exact fields', () => {
  assert.match(setView, /languageCode: '', variantCode: ''/);
  assert.match(setView, /label="FINISH"/);
  assert.match(setView, /label="RARITY"/);
  assert.match(setView, /label="LANGUAGE"/);
  assert.match(setView, /card\.variantCode !== finish/);
  assert.match(setView, /card\.rarity !== rarity/);
  assert.match(setView, /card\.languageCode !== language/);
  assert.match(setView, /A Common card can also be Reverse Holo/);
});

test('Where to Buy consumes Cloud-owned delivered-price verdicts and safe retailer links', () => {
  assert.match(service, /\/v1\/fate-price\/\$\{encodeURIComponent\(id\)\}\/offers/);
  assert.match(buy, /fetchFatePriceRetailOffers/);
  assert.match(buy, /offer\.comparison\.status/);
  assert.match(buy, /DELIVERED TOTAL/);
  assert.match(buy, /safeExternalHttpsUrl\(offer\.url\)/);
  assert.match(buy, /Retail listings stay a separate live availability signal/);
  assert.doesNotMatch(buy, /function\s+(?:calculate|classify|score).*(?:price|offer|verdict)/i);
});

test('the FatePrice wayfinder is an optimized atmospheric asset, not a pasted poster', () => {
  assert.match(chrome, /fate-market-guardian-wayfinder\.webp/);
  assert.match(chrome, /copyVeil/);
  assert.match(chrome, /lowerVeil/);
  const assets = [
    'fate-market-guardian-wayfinder.webp',
    'fate-market-guardian-violet.webp',
    'fate-market-guardian-ivory.webp',
    'fate-market-guardians-gateway.webp',
    'fate-market-guardians-lakeside.webp',
  ];
  for (const asset of assets) {
    assert.ok(fs.statSync(path.join(root, 'assets/images', asset)).size < 200_000, `${asset} should remain below 200KB`);
  }
});
