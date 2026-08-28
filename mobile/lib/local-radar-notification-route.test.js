const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');

test('Local Radar operator notification routes into the stable Local Radar screen', () => {
  assert.match(layout, /data\?\.route === 'local-radar'/);
  assert.match(layout, /router\.push\('\/local-radar'\)/);
  assert.match(layout, /return;/);
});

test('Local Radar routing is checked before the normal product URL handoff', () => {
  const routeCheck = layout.indexOf("data?.route === 'local-radar'");
  const productCheck = layout.indexOf('safeExternalHttpsUrl(data?.productUrl)');
  assert.ok(routeCheck >= 0, 'Local Radar route check must exist');
  assert.ok(productCheck > routeCheck, 'product URL fallback must run after Local Radar routing');
});

test('normal product notifications keep the hardened external URL path', () => {
  assert.match(layout, /safeExternalHttpsUrl\(data\?\.productUrl\)/);
  assert.match(layout, /Linking\.openURL\(safeProductUrl\)/);
});
