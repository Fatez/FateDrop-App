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
const idService = read('services/fatedrop-id.ts');
const alertService = read('services/canonical-alerts.ts');
const signalService = read('services/network-signals.ts');
const wishlistService = read('services/wishlist.ts');

 test('human audit repair routes Home and Alerts through the vNext screens', () => {
  assert.match(homeRoute, /home-screen-v3/);
  assert.match(alertsRoute, /alerts-screen-v4/);
});

test('Home uses the shared seven-day network lifecycle pulse', () => {
  assert.match(home, /fetchNetworkPulse\(7\)/);
  assert.match(signalService, /\/api\/signal-health\?days=/);
  for (const state of ['whisper', 'echo', 'manifested', 'vanished']) {
    assert.match(signalService, new RegExp(state));
  }
  assert.match(home, /Last 7 days/);
});

test('normal root browsing keeps the FateDrop five-button shell visible', () => {
  assert.match(rootLayout, /PersistentBottomNav/);
  assert.match(dock, /Home/);
  assert.match(dock, /Alerts/);
  assert.match(dock, /fatedrop-center-emblem\.png/);
  assert.match(dock, /Network/);
  assert.match(dock, /Profile/);
  assert.match(dock, /\/encounters/);
  assert.match(dock, /\/local-radar/);
  assert.match(dock, /\/fatefind/);
});

test('mobile account and canonical alert services default to the current FateDrop domain', () => {
  assert.match(idService, /https:\/\/fatedrop\.co\.uk/);
  assert.match(alertService, /https:\/\/fatedrop\.co\.uk/);
  assert.match(signalService, /https:\/\/fatedrop\.co\.uk/);
  assert.doesNotMatch(idService, /https:\/\/fate-drop\.com/);
  assert.doesNotMatch(alertService, /https:\/\/fate-drop\.com/);
});

test('legacy Wishlist migration remains passive', () => {
  assert.match(wishlistService, /alertsEnabled: false/);
  assert.doesNotMatch(wishlistService, /alertsEnabled:true/);
});
