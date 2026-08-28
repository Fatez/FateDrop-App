'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobile = path.join(__dirname, '..');
const identity = fs.readFileSync(path.join(mobile, 'services', 'fatedrop-id.ts'), 'utf8');

test('mobile normalizes all four canonical lifecycle preferences through one contract', () => {
  assert.match(identity, /function lifecyclePreference\(value:unknown\)\{return typeof value==='boolean'\?value:true;\}/);
  for (const stage of ['whisper', 'echo', 'manifested', 'vanished']) {
    assert.match(identity, new RegExp(`${stage}:lifecyclePreference\\(input\\?\\.${stage}\\)`));
  }
});

test('mobile default keeps Whisper, Echo, Manifested and Vanished enabled', () => {
  assert.match(identity, /whisper:true,echo:true,manifested:true,vanished:true/);
  assert.doesNotMatch(identity, /vanished:false/);
});
