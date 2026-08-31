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
  assert.match(home, /Closed or stale Manifested alerts stay in history/);
  assert.doesNotMatch(home, /sendPush|scheduleNotification|deliverSignals|enqueue/);
  assert.match(home, /openExternalRetailerLink/);
  assert.doesNotMatch(home, /Linking\.openURL\(alert\.productUrl/);
});

test('Home uses local TCG filtering and preserves the account selection', () => {
  assert.match(home, /snapshot\?\.tcgPreferences\.selectedTcgCodes \?\? \['pokemon'\]/);
  assert.match(home, /tcgFilter === 'all' \|\| alert\.tcgCode === tcgFilter/);
  assert.match(home, /TCG_REGISTRY\.find/);
});
