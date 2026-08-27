const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'screens', 'indies-screen-v2.tsx'), 'utf8');
const directory = fs.readFileSync(path.join(root, 'services', 'retailer-directory.ts'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');

test('Retailers segments one Cloud directory into approved discovery views', () => {
  assert.match(screen, /type RetailerView = 'all' \| 'major' \| 'specialist' \| 'local'/);
  assert.match(screen, /label="Major Retailers"/);
  assert.match(screen, /label="TCG Specialists"/);
  assert.match(screen, /label="Independent & Local"/);
  assert.match(screen, /retailer\.retailerClass === 'national'/);
  assert.match(screen, /retailer\.retailerClass === 'specialist'/);
  assert.match(screen, /\['independent', 'regional'\]\.includes\(retailer\.retailerClass\)/);
  assert.match(screen, /localeCompare/);
});

test('retailer physical presence uses explicit Cloud evidence and preserves unknown', () => {
  assert.match(directory, /physicalStores: boolean \| null/);
  assert.match(directory, /physicalLocations: number \| null/);
  assert.match(screen, /retailer\.physicalStores === true/);
  assert.match(screen, /Online · Physical status unknown/);
  assert.match(screen, /Retail presence unknown/);
  assert.doesNotMatch(screen, /Boolean\(retailer\.websiteUrl\).*physical/i);
});

test('Retailers sends product discovery to FateFind rather than making retailer-price promises', () => {
  assert.match(screen, /Looking for a product\? Use FateFind\./);
  assert.match(screen, /same comparison pool/);
  assert.match(screen, /router\.push\('\/fatefind'\)/);
  assert.doesNotMatch(screen, /RRP \/ Major/);
});

test('retailer hub remains routable without occupying a primary bottom-tab slot', () => {
  assert.match(tabs, /<Tabs\.Screen name="indies" options=\{\{ href: null \}\} \/>/);
  assert.doesNotMatch(tabs, /name="indies"[\s\S]{0,220}title:\s*'Retailers'/);
});
