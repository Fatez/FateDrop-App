const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobile = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(mobile, relative), 'utf8');

const resolver = read('services/canonical-product-images.ts');
const alerts = read('services/canonical-alerts.ts');

test('Home product image resolver keeps exact canonical identity as the hard gate', () => {
  assert.match(resolver, /offer\.canonicalProductId === exactProductId/);
  assert.doesNotMatch(resolver, /levenshtein|fuzzy|similarity/i);
  assert.match(resolver, /OFFICIAL_IMAGE_RETAILERS = new Set\(\['pokemon-center-uk'\]\)/);
});

test('resolver fails closed to the observed retailer image when no better exact asset exists', () => {
  assert.match(resolver, /return fallback;/);
  assert.match(resolver, /Do not swap one ordinary retailer JPEG for another/);
  assert.match(resolver, /likelyTransparentAsset/);
});

test('Verified Live Now enriches only a bounded pilot window before rendering', () => {
  assert.match(alerts, /LIVE_IMAGE_RESOLUTION_LIMIT = 8/);
  assert.match(alerts, /resolveExactCanonicalProductImage/);
  assert.match(alerts, /productId: alert\.productId/);
  assert.match(alerts, /fallbackImageUrl: alert\.product\.imageUrl/);
  assert.match(alerts, /product: \{ \.\.\.alert\.product, imageUrl: resolvedImageUrl \}/);
});
