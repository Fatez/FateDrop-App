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

test('Home keeps exactly one permanent FateDrop Guide entry at the bottom of Quick Actions', () => {
  assert.doesNotMatch(home, /FATEDROP GUIDE/);
  assert.doesNotMatch(home, /How FateDrop works — whenever you need it\./);
  assert.match(home, /<Text style=\{styles\.sectionEyebrow\}>QUICK ACTIONS<\/Text>[\s\S]*<Action title="Search"[\s\S]*<Action title="FateFind"[\s\S]*<Action title="How FateDrop works" detail="FateDrop Guide · tour and feature explainers" icon="book-outline" onPress=\{\(\) => router\.push\('\/demo'\)\} \/>/);
  assert.equal((home.match(/router\.push\('\/demo'\)/g) ?? []).length, 1);
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

test('More retains a replay entry so the guide is never one-shot only', () => {
  assert.match(more, /title: 'App Guide'/);
  assert.match(more, /path: '\/onboarding'/);
});
