const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const screen = fs.readFileSync(path.join(__dirname, '../app/local-radar.tsx'), 'utf8');

test('Local Radar leaves the native map camera uncontrolled by React region state', () => {
  assert.match(screen, /ref=\{mapRef\}/);
  assert.match(screen, /initialRegion=\{UK_REGION\}/);
  assert.doesNotMatch(screen, /<MapView[\s\S]*?\sregion=\{region\}/);
  assert.match(screen, /onRegionChangeComplete=\{\(nextRegion\) =>/);
});

test('cluster taps animate imperatively and reject overlapping native camera animations', () => {
  assert.match(screen, /clusterAnimationInFlight\.current/);
  assert.match(screen, /if \(clusterAnimationInFlight\.current\) return;/);
  assert.match(screen, /mapRef\.current\?\.animateToRegion\(nextRegion, 260\)/);
  assert.match(screen, /setTimeout\(\(\) => \{[\s\S]*?clusterAnimationInFlight\.current = false;[\s\S]*?\}, 650\);/);
});
