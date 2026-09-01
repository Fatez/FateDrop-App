const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const notifications = fs.readFileSync(path.join(__dirname, 'notifications.ts'), 'utf8');
const preferences = fs.readFileSync(path.join(__dirname, '../app/notification-preferences.tsx'), 'utf8');
const localRadarHelper = notifications.slice(notifications.indexOf('export async function sendLocalRadarPresentationTest'));

test('Notifications exposes one Local Radar QA control and no retired Vanished test control', () => {
  assert.match(preferences, /TEST LOCAL RADAR ALERT/);
  assert.match(preferences, /sendLocalRadarPresentationTest/);
  assert.doesNotMatch(preferences, /TEST VANISHED ALERT/);
  assert.doesNotMatch(preferences, /sendVanishedPresentationTest/);
});

test('Local Radar presentation test uses the production notification route shape without stock persistence', () => {
  assert.match(localRadarHelper, /export async function sendLocalRadarPresentationTest/);
  assert.match(localRadarHelper, /route: 'local-radar'/);
  assert.match(localRadarHelper, /stage: 'ECHO'/);
  assert.match(localRadarHelper, /presentationType: 'big_fate_signal'/);
  assert.match(localRadarHelper, /physicalEvidenceState: 'expected'/);
  assert.match(localRadarHelper, /availabilityVerified: false/);
  assert.match(localRadarHelper, /retailerName: 'The Entertainer'/);
  assert.match(localRadarHelper, /pokemon-at-the-entertainer/);
  assert.match(localRadarHelper, /productTitle: '\[TEST\] Pokémon TCG 30th Celebration'/);
  assert.match(localRadarHelper, /branchCount: 2/);
  assert.match(localRadarHelper, /radiusTargeted: true/);
  assert.match(localRadarHelper, /test: true/);
  assert.match(localRadarHelper, /canary: true/);
  assert.doesNotMatch(localRadarHelper, /fetch\(/);
  assert.doesNotMatch(localRadarHelper, /fatedrop_local_stock|upsertLocalStock|stock_observation/i);
});

test('retired Vanished local presentation helper is removed', () => {
  assert.doesNotMatch(notifications, /sendVanishedPresentationTest/);
  assert.doesNotMatch(notifications, /Vanished presentation test/);
});
