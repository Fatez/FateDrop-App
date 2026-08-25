const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const tabLayout = fs.readFileSync(path.join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
const homeRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');
const alertsRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/alerts.tsx'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '../screens/home-screen-v2.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v3.tsx'), 'utf8');

test('tabs route to the redesigned Home and canonical Alerts screens', () => {
  assert.match(homeRoute, /home-screen-v2/);
  assert.match(alertsRoute, /alerts-screen-v3/);
});

test('Home combines live network, canonical alerts, FateMatch and discovery data', () => {
  assert.match(home, /\/api\/status/);
  assert.match(home, /fetchCanonicalAlerts/);
  assert.match(home, /\/api\/calendar-events/);
  assert.match(home, /FATEMATCH/);
  assert.match(home, /Local Radar/);
  assert.match(home, /Fate Encounters/);
});

test('Alerts separates canonical Signals from personal FateMatch monitoring', () => {
  assert.match(alerts, /SIGNALS/);
  assert.match(alerts, /FATEMATCH/);
  assert.match(alerts, /WHISPER/);
  assert.match(alerts, /ECHO/);
  assert.match(alerts, /MANIFESTED/);
  assert.match(alerts, /VANISHED/);
  assert.match(alerts, /fetchCanonicalAlerts\(100\)/);
  assert.doesNotMatch(alerts, /fetchNetworkSignals/);
});

test('Alerts tab badge is live canonical history and never a hard-coded demo count', () => {
  assert.match(tabLayout, /fetchCanonicalAlerts\(100\)/);
  assert.match(tabLayout, /tabBarBadge: alertCount > 0/);
  assert.doesNotMatch(tabLayout, /tabBarBadge:\s*3/);
});
