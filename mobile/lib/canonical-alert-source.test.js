const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../services/network-signals.ts'), 'utf8');

test('signed-in Alerts use the canonical authenticated Web alert inbox', () => {
  assert.match(source, /getStoredSessionToken/);
  assert.match(source, /fetchCanonicalAlerts\(limit\)/);
  assert.match(source, /if \(canonicalAlerts\) return canonicalAlerts/);
  assert.doesNotMatch(source, /api\/mobile\/alerts\?limit=/);
});

test('canonical inbox failures do not silently fall back to raw detections for signed-in users', () => {
  assert.match(source, /Do not\s+\/\/ replace a failed personal contract with raw detections/);
  assert.doesNotMatch(source, /fetchSignedInCanonicalAlerts\([^)]*\)\.catch/);
});
