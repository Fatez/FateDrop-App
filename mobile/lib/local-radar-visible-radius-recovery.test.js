const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const radar = fs.readFileSync(path.join(__dirname, '..', 'app', 'local-radar.tsx'), 'utf8');
const tabs = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '..', 'app', 'tools.tsx'), 'utf8');

test('Local Radar fits returned mapped branches before falling back to a fixed user-centred viewport', () => {
  const mappedBranch = radar.indexOf('if (mapped.length)');
  const fixedAreaFallback = radar.indexOf("if (area?.latitude !== undefined && area.longitude !== undefined)", mappedBranch + 1);
  assert.ok(mappedBranch >= 0, 'mapped branch framing is present');
  assert.ok(fixedAreaFallback > mappedBranch, 'returned branch bounds are considered before fixed area fallback');
  assert.match(radar, /latitudeDelta: Math\.max\(0\.28, latitudeSpan \* 1\.25\)/);
  assert.match(radar, /longitudeDelta: Math\.max\(0\.28, longitudeSpan \* 1\.25\)/);
});

test('central Fate Network Local Radar entry remains unscoped', () => {
  assert.match(tabs, /setCompassOpen\(true\)/);
  assert.match(tabs, /onPress=\{\(\) => openTool\('\/local-radar'\)\}/);
  assert.doesNotMatch(tabs, /openTool\(\{[^}]*retailerId/);
  assert.match(tools, /title="Local Radar"/);
  assert.doesNotMatch(tools, /retailerId/);
});

test('retailer scope filters only when an explicit retailerId is present', () => {
  assert.match(radar, /const nextShops = scopedRetailerId \? allShops\.filter\(\(shop\) => shop\.retailerId === scopedRetailerId\) : allShops;/);
});
