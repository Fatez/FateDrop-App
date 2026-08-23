const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../services/network-signals.ts'), 'utf8');

test('signed-in Alerts use the canonical web alert inbox', () => {
  assert.match(source, /getStoredSessionToken/);
  assert.match(source, /\/api\/mobile\/alerts\?limit=/);
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.match(source, /if \(canonicalAlerts\) return canonicalAlerts/);
});

test('canonical inbox failures do not silently fall back to raw detections for signed-in users', () => {
  assert.match(source, /if \(!response\.ok\) throw new Error/);
  assert.match(source, /Signed-in Alerts must use the canonical alert inbox/);
});
