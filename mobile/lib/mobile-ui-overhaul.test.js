const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const homeRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');
const alertsRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/alerts.tsx'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '../screens/home-screen-v2.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v3.tsx'), 'utf8');

test('tabs route to the redesigned Home and canonical Alerts screens', () => {
  assert.match(homeRoute, /home-screen-v2/);
  assert.match(alertsRoute, /alerts-screen-v3/);
});

test('Home separates network health from canonical alert history', () => {
  assert.match(home, /\/api\/status/);
  assert.match(home, /fetchCanonicalAlerts/);
  assert.match(home, /The network can be active without creating an alert/);
});

test('Alerts leads with canonical alert and Discord delivery truth', () => {
  assert.match(alerts, /ONE ALERT · EVERY SURFACE/);
  assert.match(alerts, /DISCORD SENT/);
  assert.match(alerts, /DELIVERY ISSUES/);
  assert.doesNotMatch(alerts, /fetchNetworkSignals/);
});
