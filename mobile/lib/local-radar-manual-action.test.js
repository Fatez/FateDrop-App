const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const overview = fs.readFileSync(path.join(root, 'app/local-radar.tsx'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services/local-radar-intelligence.ts'), 'utf8');

test('manual postcode action is single-flight before Local Radar fetch begins', () => {
  assert.match(overview, /const locationActionInFlight = useRef\(false\)/);
  assert.match(overview, /const handlePostcodeSearch = async \(\) => \{\s*if \(locationActionInFlight\.current\) return;\s*locationActionInFlight\.current = true;\s*setLoading\(true\)/s);
  assert.match(overview, /finally \{\s*locationActionInFlight\.current = false;\s*setLoading\(false\);\s*\}/s);
});

test('manual postcode and radius controls are disabled while a Radar request is active', () => {
  assert.match(overview, /handlePostcodeSearch\(\)\} disabled=\{loading\}/);
  assert.match(overview, /onPress=\{\(\) => setRadius\(value\)\} disabled=\{loading\}/);
  assert.match(overview, /\{loading \? 'Scanning…' : 'Set'\}/);
});

test('manual postcode stays on the canonical Cloud Local Radar contract', () => {
  assert.match(overview, /adapter\.fromPostcode\(postcode\)/);
  assert.match(service, /fetch\(`\$\{SIGNAL_ENGINE_URL\}\/api\/local-radar\?\$\{params\.toString\(\)\}`\)/);
  assert.match(service, /params\.set\('postcode', area\.postcode\)/);
  assert.match(service, /tcg: 'pokemon'/);
});

test('Local Radar physical truth remains fail-closed', () => {
  assert.match(service, /verifiedBranchStock && lifecycle === 'manifested'/);
  assert.match(service, /return 'unknown'/);
  assert.match(overview, /Online stock remains separate/);
});
