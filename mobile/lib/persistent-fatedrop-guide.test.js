const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');

const home = read('screens/home-screen-v3.tsx');
const guide = read('app/demo.tsx');
const onboarding = read('app/onboarding.tsx');
const more = read('screens/more-screen-v2.tsx');

test('Orbital Home keeps the approved direct actions while the permanent guide remains in More', () => {
  assert.match(home, /title="Search"/);
  assert.match(home, /title="FateFind"/);
  assert.match(home, /title="Events"/);
  assert.doesNotMatch(home, /FATEDROP GUIDE/);
  assert.match(more, /title: 'App Guide'/);
});

test('persistent guide can replay the full guided tour', () => {
  assert.match(guide, /REPLAY FULL GUIDED TOUR/);
  assert.match(guide, /router\.push\('\/onboarding'\)/);
  assert.match(onboarding, /APP GUIDE/);
});

test('persistent guide explains and links the core collector features', () => {
  for (const label of ['Search', 'Wishlist', 'FateFind', 'FateMatch', 'True Price', 'Alerts', 'Local Radar', 'Fate Network']) {
    assert.match(guide, new RegExp(`title: '${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.match(guide, /Whisper/);
  assert.match(guide, /Echo/);
  assert.match(guide, /Manifested/);
  assert.match(guide, /Vanished/);
});

test('More retains a second replay entry so the guide is never one-shot only', () => {
  assert.match(more, /title: 'App Guide'/);
  assert.match(more, /path: '\/onboarding'/);
});
