const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const home = fs.readFileSync('screens/home-screen-v3.tsx', 'utf8');
const guide = fs.readFileSync('app/demo.tsx', 'utf8');
const onboarding = fs.readFileSync('app/onboarding.tsx', 'utf8');
const more = fs.readFileSync('screens/more-screen-v2.tsx', 'utf8');

test('Home keeps a prominent permanent FateDrop Guide entry', () => {
  assert.match(home, /FATEDROP GUIDE/);
  assert.match(home, /Not sure what a feature or signal means\?/);
  assert.match(home, /router\.push\('\/demo'\)/);
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
