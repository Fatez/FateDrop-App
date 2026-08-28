'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobile = path.join(__dirname, '..');
const profile = fs.readFileSync(path.join(mobile, 'screens', 'profile-screen-v2.tsx'), 'utf8');
const identity = fs.readFileSync(path.join(mobile, 'services', 'fatedrop-id.ts'), 'utf8');

test('Profile exposes the existing secure FateDrop ID sign-out path', () => {
  assert.match(profile, /snapshot, signedIn, signOut, syncing/);
  assert.match(profile, /accessibilityLabel="Sign out of FateDrop"/);
  assert.match(profile, /onPress=\{requestSignOut\}/);
  assert.match(profile, /void signOut\(\)\.catch/);
  assert.match(profile, /End this FateDrop ID session on this device\./);
});

test('mobile fallback keeps all four canonical lifecycle deliveries enabled', () => {
  assert.match(identity, /whisper:true,echo:true,manifested:true,vanished:true/);
  assert.doesNotMatch(identity, /manifested:true,vanished:false/);
});
