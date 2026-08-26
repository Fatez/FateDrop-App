const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const tabLayout = fs.readFileSync(path.join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
const homeRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');
const alertsRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/alerts.tsx'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '../screens/home-screen-v3.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v4.tsx'), 'utf8');
const fateNetwork = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');

test('tabs route to the human-audited Home and canonical Alerts screens', () => {
  assert.match(homeRoute, /home-screen-v3/);
  assert.match(alertsRoute, /alerts-screen-v4/);
});

test('Home combines seven-day lifecycle pulse, personal FateDrop summary and discovery without monitor-health clutter', () => {
  assert.doesNotMatch(home, /\/api\/status/);
  assert.match(home, /fetchNetworkPulse\(7\)/);
  assert.match(home, /ACTIVE FATEFINDS/);
  assert.match(home, /7D FATEMATCHES/);
  assert.doesNotMatch(home, /Action title="Local Radar"/);
  assert.match(fateNetwork, /title="Local Radar"/);
  assert.match(home, /How FateDrop works/);
});

test('Alerts separates canonical lifecycle Signals from personal FateFind and FateMatch results', () => {
  assert.match(alerts, /SIGNALS/);
  assert.match(alerts, /FATEMATCHES/);
  assert.match(alerts, /WHISPER/);
  assert.match(alerts, /ECHO/);
  assert.match(alerts, /MANIFESTED/);
  assert.match(alerts, /VANISHED/);
  assert.match(alerts, /fetchCanonicalAlerts\(100\)/);
  assert.match(alerts, /FATEFIND → FATEMATCH/);
  assert.doesNotMatch(alerts, /fetchNetworkSignals/);
});

test('Alerts tab badge is live canonical history and never a hard-coded demo count', () => {
  assert.match(tabLayout, /fetchCanonicalAlerts\(100\)/);
  assert.match(tabLayout, /tabBarBadge: alertCount > 0/);
  assert.doesNotMatch(tabLayout, /tabBarBadge:\s*3/);
});
