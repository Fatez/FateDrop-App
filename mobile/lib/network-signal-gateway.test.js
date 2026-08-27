const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../services/network-signals.ts'), 'utf8');

test('Home lifecycle pulse reads the versioned public Cloud summary directly', () => {
  assert.match(source, /SIGNAL_ENGINE_URL\}\/api\/signal-summary/);
  assert.match(source, /PUBLIC_SIGNAL_CONTRACT_VERSION = 1/);
  assert.doesNotMatch(source, /\/api\/mobile\/signal-health/);
  assert.doesNotMatch(source, /\/api\/signal-health/);
});

test('public raw signal feed remains a direct versioned Cloud contract', () => {
  assert.match(source, /SIGNAL_ENGINE_URL\}\/api\/signals/);
  assert.match(source, /Unsupported FateDrop signal contract/);
});

test('signed-in personal alert history remains on the authenticated Web gateway', () => {
  assert.match(source, /FATEDROP_WEB_URL\}\/api\/mobile\/alerts/);
});
