// Regression guards for the physically approved Fate Network integration shell.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const tabLayout = fs.readFileSync(path.join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
const rootLayout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
const homeRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');
const alertsRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/alerts.tsx'), 'utf8');
const traderRoute = fs.readFileSync(path.join(__dirname, '../app/fate-trader.tsx'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '../screens/home-screen-v3.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v4.tsx'), 'utf8');
const fateNetwork = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');
const persistentNav = fs.readFileSync(path.join(__dirname, '../components/persistent-bottom-nav.tsx'), 'utf8');
const networkSignals = fs.readFileSync(path.join(__dirname, '../services/network-signals.ts'), 'utf8');

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
  assert.match(home, /How FateDrop works/);
});

test('Home network pulse uses the stable Web gateway rather than direct Railway signal health', () => {
  assert.match(networkSignals, /webBaseUrl\(\)\}\/api\/mobile\/signal-health/);
  assert.doesNotMatch(networkSignals, /SIGNAL_ENGINE_URL\}\/api\/signal-health/);
});

test('Fate Network keeps the physically approved five-job hierarchy and monitoring semantics', () => {
  assert.match(fateNetwork, /title="FateFind"/);
  assert.match(fateNetwork, /title="FateMatch"/);
  assert.match(fateNetwork, /title="Fate Trader"/);
  assert.match(fateNetwork, /title="Local Radar"/);
  assert.match(fateNetwork, /title="Stores"/);
  assert.match(fateNetwork, /Monitor the products and conditions you care about/);
  assert.doesNotMatch(fateNetwork, /FateMatch means it was found/);
  assert.match(tabLayout, /title="Fate Trader"/);
  assert.match(tabLayout, /title="Local Radar"/);
  assert.match(tabLayout, /title="Stores"/);
});

test('Fate Trader and Local Radar destinations cannot become dead Fate Network buttons', () => {
  assert.match(traderRoute, /fate-trader-screen/);
  assert.match(rootLayout, /name="fate-trader"/);
  assert.match(rootLayout, /name="local-radar"/);
  assert.match(rootLayout, /name="local-radar-stock"/);
  assert.match(rootLayout, /name="local-radar-events"/);
  assert.match(rootLayout, /name="local-radar-store"/);
  assert.match(persistentNav, /'\/fate-trader'/);
  assert.match(persistentNav, /'\/local-radar'/);
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
