const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const notifications = fs.readFileSync(path.join(__dirname, 'notifications.ts'), 'utf8');
const preferences = fs.readFileSync(path.join(__dirname, '../app/notification-preferences.tsx'), 'utf8');

test('Notifications exposes one Local Radar QA control and no retired Vanished test control', () => {
  assert.match(preferences, /TEST LOCAL RADAR ALERT/);
  assert.match(preferences, /sendLocalRadarPresentationTest/);
  assert.doesNotMatch(preferences, /TEST VANISHED ALERT/);
  assert.doesNotMatch(preferences, /sendVanishedPresentationTest/);
});

test('Local Radar presentation test uses the production notification route shape without stock persistence', () => {
  assert.match(notifications, /export async function sendLocalRadarPresentationTest/);
  assert.match(notifications, /route: 'local-radar'/);
  assert.match(notifications, /stage: 'ECHO'/);
  assert.match(notifications, /retailerName: 'Test Retailer'/);
  assert.match(notifications, /productTitle: '\[TEST\] Pokémon TCG incoming stock'/);
  assert.match(notifications, /branchCount: 2/);
  assert.match(notifications, /test: true/);
  assert.match(notifications, /canary: true/);
  assert.doesNotMatch(notifications, /fetch\(/);
  assert.doesNotMatch(notifications, /fatedrop_local_stock|upsertLocalStock|stock_observation/i);
});

test('retired Vanished local presentation helper is removed', () => {
  assert.doesNotMatch(notifications, /sendVanishedPresentationTest/);
  assert.doesNotMatch(notifications, /Vanished presentation test/);
});
