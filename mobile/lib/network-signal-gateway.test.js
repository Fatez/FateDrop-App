const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../services/network-signals.ts'), 'utf8');

test('Home lifecycle pulse uses the stable Web gateway', () => {
  assert.match(source, /webBaseUrl\(\)\}\/api\/mobile\/signal-health/);
  assert.doesNotMatch(source, /SIGNAL_ENGINE_URL\}\/api\/signal-health/);
});

test('public raw signal feed remains a separate Cloud contract', () => {
  assert.match(source, /SIGNAL_ENGINE_URL\}\/api\/signals/);
});
