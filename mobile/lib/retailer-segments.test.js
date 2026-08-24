const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'screens', 'indies-screen-v2.tsx'), 'utf8');
const directory = fs.readFileSync(path.join(root, 'services', 'retailer-directory.ts'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');

test('retailer tab separates major/RRP and independent markets', () => {
  assert.match(screen, /type MarketSegment = 'major' \| 'indies'/);
  assert.match(screen, /RRP \/ Major/);
  assert.match(screen, /Independents/);
  assert.match(screen, /retailerClass === 'national'/);
  assert.match(screen, /\['independent', 'specialist', 'regional'\]/);
});

test('independent retailer presence uses explicit Cloud evidence', () => {
  assert.match(directory, /physicalStores: boolean \| null/);
  assert.match(directory, /physicalLocations: number \| null/);
  assert.match(screen, /Physical stores/);
  assert.match(screen, /retailer\.physicalStores === true/);
  assert.match(screen, /PHYSICAL STATUS UNVERIFIED/);
  assert.doesNotMatch(screen, /Boolean\(retailer\.websiteUrl\).*physical/i);
});

test('RRP wording is a comparison baseline, not a retailer price promise', () => {
  assert.match(screen, /RRP\/reference is FateDrop's comparison baseline/);
  assert.match(screen, /can still price above or below it/);
});

test('bottom navigation exposes the retailer hub without route churn', () => {
  assert.match(tabs, /name="indies"/);
  assert.match(tabs, /title: 'Retailers'/);
});
