const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services/fate-price-discovery.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'components/fate-price-discovery-panel.tsx'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'screens/fate-price-screen.tsx'), 'utf8');

test('FatePrice discovery uses Cloud-owned durable series and set metadata', () => {
  assert.match(service, /\/v1\/fate-price\/series\?tcg=/);
  assert.match(service, /\/v1\/fate-price\/sets\?/);
  assert.match(panel, /fetchFatePriceSeries\(scope\.tcgCode\)/);
  assert.match(panel, /fetchFatePriceSets\(scope\.tcgCode, scope\.seriesId\)/);
  assert.doesNotMatch(panel, /new Set\(results/);
});

test('card search carries every active scope plus the free-text query', () => {
  assert.match(service, /q=\$\{encodeURIComponent\(query\.trim\(\)\)\}/);
  assert.match(service, /tcg=\$\{encodeURIComponent\(tcgCode\.trim\(\)\)\}/);
  assert.match(service, /seriesId=\$\{encodeURIComponent\(seriesId\.trim\(\)\)\}/);
  assert.match(service, /setId=\$\{encodeURIComponent\(setId\.trim\(\)\)\}/);
  assert.match(panel, /query: cleanQuery/);
  assert.match(panel, /tcgCode: nextScope\.tcgCode/);
  assert.match(panel, /seriesId: nextScope\.seriesId/);
  assert.match(panel, /setId: nextScope\.setId/);
});

test('scope clearing is deliberately cascading rather than resetting everything', () => {
  assert.match(panel, /label="ALL" selected=\{!scope\.tcgCode\}/);
  assert.match(panel, /applyScope\(\{ tcgCode: '', seriesId: '', setId: '' \}\)/);
  assert.match(panel, /label="ALL SERIES" selected=\{!scope\.seriesId\}/);
  assert.match(panel, /applyScope\(\{ tcgCode: scope\.tcgCode, seriesId: '', setId: '' \}\)/);
  assert.match(panel, /label="ALL SETS" selected=\{!scope\.setId\}/);
  assert.match(panel, /applyScope\(\{ tcgCode: scope\.tcgCode, seriesId: scope\.seriesId, setId: '' \}\)/);
});

test('FatePrice screen accepts route-initialised TCG, series and set scope', () => {
  assert.match(screen, /seriesId\?: string \| string\[\]/);
  assert.match(screen, /seriesName\?: string \| string\[\]/);
  assert.match(screen, /<FatePriceDiscoveryPanel/);
  assert.match(screen, /initialTcgCode=\{routeTcg\}/);
  assert.match(screen, /initialSeriesId=\{routeSeriesId\}/);
  assert.match(screen, /initialSetId=\{routeSetId\}/);
});
