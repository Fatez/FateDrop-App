const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('screens/home-screen-v3.tsx');
const briefing = read('components/home-personal-briefing.tsx');
const signal = read('lib/home-signal-state.ts');

test('Home implements the approved Orbital Command hierarchy', () => {
  assert.match(home, /HomePersonalBriefing[\s\S]*?embedded/);
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

test('personal briefing remains evidence-backed and fail closed', () => {
  assert.doesNotMatch(briefing, /Echo activity loading|Echoes since your last visit|HOME_VISIT_PREFIX/);
  assert.match(briefing, /wishlistItemMatchesLiveOpportunity/);
  assert.match(briefing, /POKÉMON CENTER UK STATUS UNAVAILABLE/);
  assert.match(briefing, /POKÉMON CENTER UK ACTIVITY DETECTED/);
  assert.match(home, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.doesNotMatch(briefing, /Animated\.loop/);
  assert.match(briefing, /color: FateDropColors\.goldBright/);
  assert.match(briefing, /backgroundColor: 'transparent'/);
  assert.match(briefing, /countUnreadCanonicalAlertsByStage/);
  assert.match(briefing, /exactWishlistItems\.some/);
  assert.match(briefing, /queryCanonicalAlertPage/);
  assert.doesNotMatch(briefing, /fetchCanonicalAlerts|fetchCanonicalLiveOpportunities/);
  assert.match(home, /liveOpportunities=\{liveOpportunities\}[\s\S]*?liveState=\{liveState\}/);
});

test('centre crystal is a deterministic personal signal rather than a network score', () => {
  const manifested = signal.indexOf("wantedLiveCount > 0");
  const echo = signal.indexOf("unreadEchoes > 0");
  const pcuk = signal.indexOf('if (evidence.pokemonCenterActive)');
  const whisper = signal.indexOf("unreadWhispers > 0");
  const vanished = signal.indexOf("unreadVanished > 0");
  assert.ok(manifested > 0 && manifested < echo && echo < pcuk && pcuk < whisper && whisper < vanished);
  assert.doesNotMatch(signal, /NetworkPulse|marketHeat|collectionValue|healthScore/);
  assert.match(home, /accessibilityRole="image" accessibilityLabel=\{signal\.label\}/);
  assert.doesNotMatch(home, /accessibilityLabel="Open Fate Market"/);
});

test('Home market snapshots render Cloud values only when evidence is available', () => {
  assert.match(home, /fetchFatePulse\(\)/);
  assert.match(home, /fetchFateCollectorsSummary\(\)/);
  assert.match(home, /period\.status !== 'available'/);
  assert.match(home, /period\.condition === 'insufficient_evidence'/);
  assert.match(home, /collection\.status === 'unavailable'/);
  assert.match(home, /collection\.pricedUnits === 0/);
});
