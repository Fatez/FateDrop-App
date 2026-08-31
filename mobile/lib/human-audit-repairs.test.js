const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const homeRoute = read('app/(tabs)/index.tsx');
const home = read('screens/home-screen-v3.tsx');
const alertsRoute = read('app/(tabs)/alerts.tsx');
const rootLayout = read('app/_layout.tsx');
const dock = read('components/persistent-bottom-nav.tsx');
const navEmblem = read('components/fatedrop-nav-emblem.tsx');
const apiConstants = read('constants/api.ts');
const idService = read('services/fatedrop-id.ts');
const alertService = read('services/canonical-alerts.ts');
const signalService = read('services/network-signals.ts');
const wishlistService = read('services/wishlist.ts');

test('human audit repair routes Home and Alerts through the vNext screens', () => {
  assert.match(homeRoute, /home-screen-v3/);
  assert.match(alertsRoute, /alerts-screen-v4/);
});

test('Home uses the shared seven-day network lifecycle pulse from the public Cloud contract', () => {
  assert.match(home, /fetchNetworkPulse\(7\)/);
  assert.match(signalService, /SIGNAL_ENGINE_URL\}\/api\/signal-summary\?days=/);
  assert.match(signalService, /PUBLIC_SIGNAL_CONTRACT_VERSION = 1/);
  assert.doesNotMatch(signalService, /\/api\/mobile\/signal-health/);
  assert.doesNotMatch(signalService, /\/api\/signal-health/);
  for (const state of ['whisper', 'echo', 'manifested', 'vanished']) {
    assert.match(signalService, new RegExp(state));
  }
  assert.match(home, /Last 7 days/);
});

test('normal root browsing keeps the FateDrop five-button shell visible with the canonical shared emblem', () => {
  assert.match(rootLayout, /PersistentBottomNav/);
  assert.match(dock, /Home/);
  assert.match(dock, /Alerts/);
  assert.match(dock, /FateDropNavEmblem/);
  assert.match(navEmblem, /Canonical FateDrop emblem/);
  assert.match(navEmblem, /FATEDROP_CENTER_EMBLEM_URI/);
  assert.doesNotMatch(navEmblem, /styles\.ring|styles\.diamond|styles\.vertical|styles\.horizontal/);
  assert.doesNotMatch(dock, /fatedrop-center-emblem\.png/);
  assert.match(dock, /Network/);
  assert.match(dock, /Profile/);
  assert.match(dock, /\/encounters/);
  assert.match(dock, /\/local-radar/);
  assert.match(dock, /\/fatefind/);
});

test('mobile account and canonical alert services share the centralized current FateDrop domain', () => {
  assert.match(apiConstants, /DEFAULT_FATEDROP_WEB_URL = 'https:\/\/fatedrop\.co\.uk'/);
  assert.match(apiConstants, /CANONICAL_FATEDROP_WEB_HOST = 'fatedrop\.co\.uk'/);
  assert.match(apiConstants, /canonicalWebBaseUrl\(process\.env\.EXPO_PUBLIC_FATEDROP_WEB_URL\)/);
  for (const service of [idService, alertService]) {
    assert.match(service, /FATEDROP_WEB_URL/);
    assert.doesNotMatch(service, /process\.env\.EXPO_PUBLIC_FATEDROP_WEB_URL/);
  }
  assert.match(signalService, /fetchCanonicalAlerts/);
  assert.doesNotMatch(apiConstants, /DEFAULT_FATEDROP_WEB_URL = 'https:\/\/fate-drop\.com'/);
});

test('legacy Wishlist migration remains passive', () => {
  assert.match(wishlistService, /alertsEnabled: false/);
  assert.doesNotMatch(wishlistService, /alertsEnabled:true/);
});
