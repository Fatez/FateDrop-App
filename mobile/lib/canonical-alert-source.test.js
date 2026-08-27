const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../services/network-signals.ts'), 'utf8');

test('signed-in Alerts use the canonical authenticated Web alert inbox', () => {
  assert.match(source, /getStoredSessionToken/);
  assert.match(source, /FATEDROP_WEB_URL\}\/api\/mobile\/alerts\?limit=/);
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.match(source, /if \(canonicalAlerts\) return canonicalAlerts/);
});

test('canonical inbox failures do not silently fall back to raw detections for signed-in users', () => {
  assert.match(source, /if \(!response\.ok\) throw new Error/);
  assert.match(source, /Do not replace it with raw/);
  assert.doesNotMatch(source, /fetchSignedInCanonicalAlerts\([^)]*\)\.catch/);
});
