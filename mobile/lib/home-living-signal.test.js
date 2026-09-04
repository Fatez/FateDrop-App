const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('screens/home-screen-v3.tsx');
const briefing = read('components/home-personal-briefing.tsx');

test('Home implements the approved Orbital Command hierarchy', () => {
  assert.match(home, /HomePersonalBriefing embedded/);
  assert.match(home, /home-living-stage-v2\.png/);
  assert.match(home, /styles\.lifecycleRibbon/);
  assert.match(home, /OrbitalIntelligenceHub/);
  assert.match(home, /home-orbital-crystal\.png/);
  assert.match(home, /TCG MARKET/);
  assert.match(home, /FATE COLLECTORS/);
  assert.match(home, /OrbitalCommandPortal/);
  assert.match(home, /rankedLiveOpportunities/);
  assert.match(home, /alert\.product\.imageUrl/);
});

test('Orbital Home keeps briefing and lifecycle in vertical flow', () => {
  assert.match(home, /paddingTop: insets\.top \+ 58/);
  assert.match(home, /heroBriefing: \{ marginLeft: 23, marginRight: 19/);
  assert.match(home, /heroLifecycle: \{ marginTop: 10, marginLeft: 14, marginRight: 14/);
  assert.doesNotMatch(home, /heroBriefing: \{ position: 'absolute'/);
  assert.doesNotMatch(home, /heroLifecycle: \{ position: 'absolute'/);
});

test('Orbital Home temporarily uses the stable fallback wallpaper', () => {
  assert.match(home, /HOME_PROFILE_WALLPAPER_ENABLED = false/);
  assert.match(home, /!HOME_PROFILE_WALLPAPER_ENABLED \|\| homeWallpaperId === 'koruHome'/);
});

test('Home Echo activity row is disabled while the briefing is simplified', () => {
  assert.match(briefing, /HOME_ECHO_ACTIVITY_ENABLED = false/);
  assert.match(briefing, /HOME_ECHO_ACTIVITY_ENABLED \? \(/);
});

test('personal briefing remains evidence-backed and fail closed', () => {
  assert.match(briefing, /HOME_VISIT_PREFIX/);
  assert.match(briefing, /alert\.fateStage !== 'ECHO'/);
  assert.match(briefing, /wishlistItemMatchesLiveOpportunity/);
  assert.match(briefing, /POKÉMON CENTER UK STATUS UNAVAILABLE/);
  assert.match(briefing, /POKÉMON CENTER UK ACTIVITY DETECTED/);
  assert.match(briefing, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.doesNotMatch(briefing, /Animated\.loop/);
  assert.match(briefing, /color: FateDropColors\.cyan/);
  assert.match(briefing, /backgroundColor: 'transparent'/);
});

test('Home market snapshots render Cloud values only when evidence is available', () => {
  assert.match(home, /fetchFatePulse\(\)/);
  assert.match(home, /fetchFateCollectorsSummary\(\)/);
  assert.match(home, /period\.status !== 'available'/);
  assert.match(home, /period\.condition === 'insufficient_evidence'/);
  assert.match(home, /collection\.status === 'unavailable'/);
  assert.match(home, /collection\.pricedUnits === 0/);
});
