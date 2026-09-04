const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'screens/home-screen-v3.tsx'), 'utf8');
const crystal = path.join(root, 'assets/images/home-orbital-crystal.png');

test('approved Orbital Home is free-flowing and uses its dedicated centre crystal', () => {
  assert.equal(fs.existsSync(crystal), true);
  assert.ok(fs.statSync(crystal).size < 150_000, 'orbital crystal must remain decode-friendly');
  assert.match(home, /LifecycleRibbon/);
  assert.match(home, /OrbitalIntelligenceHub/);
  assert.match(home, /VERIFIED LIVE NOW/);
  assert.match(home, /OrnamentTitle title="YOUR FATEDROP"/);
  assert.match(home, /OrbitalCommandPortal/);
  assert.doesNotMatch(home, /settings-outline|floatingSettings|QUICK ACTIONS/);
});

test('Orbital Home preserves real evidence and interactive destinations', () => {
  assert.match(home, /fetchNetworkPulse\(7\)/);
  assert.match(home, /fetchFatePulse\(\)/);
  assert.match(home, /fetchFateCollectorsSummary\(\)/);
  assert.match(home, /fetchCanonicalLiveOpportunities\(20\)/);
  assert.match(home, /pathname: '\/\(tabs\)\/market', params: \{ area: 'pulse' \}/);
  assert.match(home, /pathname: '\/\(tabs\)\/market', params: \{ area: 'collectors' \}/);
  assert.match(home, /router\.push\('\/\(tabs\)\/search'\)/);
  assert.match(home, /router\.push\('\/fatefind'\)/);
  assert.match(home, /router\.push\('\/encounters'\)/);
});

test('Orbital motion is bounded and honours Reduce Motion', () => {
  assert.match(home, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(home, /useNativeDriver: true/);
  assert.match(home, /initialNumToRender=\{2\}/);
  assert.match(home, /windowSize=\{3\}/);
  assert.doesNotMatch(home, /Animated\.loop|autoplay|setInterval/);
});
