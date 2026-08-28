'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobile = path.join(__dirname, '..');
const tabs = fs.readFileSync(path.join(mobile, 'app', '(tabs)', '_layout.tsx'), 'utf8');
const dock = fs.readFileSync(path.join(mobile, 'components', 'persistent-bottom-nav.tsx'), 'utf8');
const store = fs.readFileSync(path.join(mobile, 'app', 'local-radar-store.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(mobile, 'screens', 'alerts-screen-v4.tsx'), 'utf8');
const outbound = fs.readFileSync(path.join(mobile, 'services', 'outbound-links.ts'), 'utf8');

test('tab navigation visually follows the canonical Tesco/root dock', () => {
  assert.match(dock, /FateDropNavEmblem size=\{48\}/);
  assert.match(tabs, /FateDropNavEmblem size=\{48\}/);
  assert.match(dock, /width: 74, height: 68, marginTop: -18/);
  assert.match(tabs, /width: 74, height: 68, marginTop: -18/);
  assert.match(tabs, /name="home-sharp" size=\{20\}/);
  assert.match(dock, /label="Home" icon="home-sharp"/);
});

test('Local Radar store detail derives a stable area from primitive route values', () => {
  assert.doesNotMatch(store, /areaFromParams\(params\), \[params\]/);
  assert.match(store, /const source = routeValue\(params\.source\)/);
  assert.match(store, /const postcode = routeValue\(params\.postcode\)/);
  assert.match(store, /const lat = routeValue\(params\.lat\)/);
  assert.match(store, /const lng = routeValue\(params\.lng\)/);
  assert.match(store, /areaFromParams\(\{ source, postcode, lat, lng \}\)/);
  assert.match(store, /\[source, postcode, lat, lng\]/);
});

test('lifecycle alert body opens in-app and explicit external button opens the device browser', () => {
  assert.match(alerts, /openTrackedRetailerLink/);
  assert.match(alerts, /placement: 'lifecycle-alert'/);
  assert.match(alerts, /openExternalRetailerLink/);
  assert.match(alerts, /placement: 'lifecycle-alert-external'/);
  assert.match(alerts, /Open retailer in external browser/);
  assert.match(alerts, /Tap an alert for a quick in-app look · ↗ opens in your browser\./);
});

test('outbound helper keeps both browser choices behind the same public-HTTPS validation', () => {
  assert.match(outbound, /safeExternalHttpsUrl/);
  assert.match(outbound, /openBrowserAsync/);
  assert.match(outbound, /WebBrowserPresentationStyle\.PAGE_SHEET/);
  assert.match(outbound, /Linking\.canOpenURL/);
  assert.match(outbound, /Linking\.openURL/);
});
