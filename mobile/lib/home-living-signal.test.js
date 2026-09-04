const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('screens/home-screen-v3.tsx');
const briefing = read('components/home-personal-briefing.tsx');

test('Home implements the approved Living Signal hierarchy', () => {
  assert.match(home, /HomePersonalBriefing embedded/);
  assert.match(home, /NETWORK · Last 7 days/);
  assert.match(home, /FATEPULSE/);
  assert.match(home, /FATE COLLECTORS/);
  assert.match(home, /visibleLiveOpportunities\[0\]/);
});

test('personal briefing remains evidence-backed and fail closed', () => {
  assert.match(briefing, /HOME_VISIT_PREFIX/);
  assert.match(briefing, /alert\.fateStage !== 'ECHO'/);
  assert.match(briefing, /wishlistItemMatchesLiveOpportunity/);
  assert.match(briefing, /POKÉMON CENTER UK STATUS UNAVAILABLE/);
});

test('Home market snapshots render Cloud values only when evidence is available', () => {
  assert.match(home, /fetchFatePulse\(\)/);
  assert.match(home, /fetchFateCollectorsSummary\(\)/);
  assert.match(home, /pulse30d\?\.status === 'available'/);
  assert.match(home, /collection\.status === 'unavailable'/);
  assert.match(home, /collection\.pricedUnits === 0/);
});
