const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const alertsRoute = read('app/(tabs)/alerts.tsx');
const alertsV4 = read('screens/alerts-screen-v4.tsx');
const canonicalAlerts = read('services/canonical-alerts.ts');

test('canonical alert presentation is applied to the routed Alerts v4 screen', () => {
  assert.match(alertsRoute, /alerts-screen-v4/);
  assert.match(alertsV4, /function AlertRow/);
  assert.match(alertsV4, /alert\.presentation/);
});

test('mobile accepts source-market reference provenance without doing App-side pricing lookup', () => {
  assert.match(canonicalAlerts, /CanonicalAlertPresentation/);
  assert.match(canonicalAlerts, /sourceMarket: string \| null/);
  assert.match(canonicalAlerts, /sourceCurrency: string \| null/);
  assert.match(canonicalAlerts, /sourceMsrp: string \| null/);
  assert.match(alertsV4, /Official \$\{market\} MSRP/);
  assert.match(alertsV4, /GBP ref/);
  assert.doesNotMatch(alertsV4, /fetch\([^)]*msrp/i);
  assert.doesNotMatch(alertsV4, /fetch\([^)]*rrp/i);
});

test('collector-facing alert cards humanise availability and confidence', () => {
  assert.match(alertsV4, /in_stock'\) return 'In stock'/);
  assert.match(alertsV4, /out_of_stock'\) return 'Out of stock'/);
  assert.match(alertsV4, /High/);
  assert.match(alertsV4, /Moderate/);
  assert.match(alertsV4, /Developing/);
});

test('True Price is rendered only when a delivered price actually exists', () => {
  assert.match(alertsV4, /deliveredPricePence == null \? null/);
  assert.match(alertsV4, /True Price · \{truePrice\}/);
});
