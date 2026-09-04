const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services/canonical-alerts.ts'), 'utf8');
const home = fs.readFileSync(path.join(root, 'screens/home-screen-v3.tsx'), 'utf8');

test('App reads current availability through the existing canonical alert gateway', () => {
  assert.match(service, /fetchCanonicalAlertStage\(token, 'manifested', safeLimit, true\)/);
  assert.match(service, /currentOnly \? '&current=true' : ''/);
  assert.match(service, /alert\.fateStage === 'MANIFESTED'/);
  assert.match(service, /alert\.liveWindow\?\.historyComplete === true/);
  assert.match(service, /alert\.liveWindow\.vanishedAt === null/);
  assert.match(service, /alert\.liveWindow\.lastConfirmedLiveAt !== null/);
});

test('Home cycles verified stock without creating or replaying an alert', () => {
  assert.match(home, /fetchCanonicalLiveOpportunities\(20\)/);
  assert.match(home, /VERIFIED LIVE NOW/);
  assert.match(home, /Seeing one here never repeats the alarm/);
  assert.match(home, /Nothing is freshly verified live right now/);
  assert.match(home, /alert\.product\.imageUrl/);
  assert.doesNotMatch(home, /sendPush|scheduleNotification|deliverSignals|enqueue/);
  assert.match(home, /openExternalRetailerLink/);
  assert.doesNotMatch(home, /Linking\.openURL\(alert\.productUrl/);
});

test('Home ranks at most five opportunities by wanted match, selected TCG, then freshness', () => {
  assert.match(home, /snapshot\?\.tcgPreferences\.selectedTcgCodes \?\? \['pokemon'\]/);
  assert.match(home, /wantedDifference/);
  assert.match(home, /selectedDifference/);
  assert.match(home, /liveEvidenceTime\(right\) - liveEvidenceTime\(left\)/);
  assert.match(home, /slice\(0, LIVE_OPPORTUNITY_LIMIT\)/);
  assert.match(home, /const LIVE_OPPORTUNITY_LIMIT = 5/);
  assert.match(home, /snapToInterval=\{liveCardWidth \+ LIVE_CARD_GAP\}/);
  assert.match(home, /TCG_REGISTRY\.find/);
});
