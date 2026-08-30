const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../services/canonical-alerts.ts'), 'utf8');

test('mobile reads independent canonical windows for all four lifecycle stages', () => {
  assert.match(source, /CANONICAL_ALERT_QUERY_STATES/);
  assert.match(source, /'whisper', 'echo', 'manifested', 'vanished'/);
  assert.match(source, /api\/mobile\/alerts\?state=\$\{state\}&limit=\$\{limit\}/);
  assert.match(source, /Promise\.all/);
  assert.match(source, /Whisper burst must never make/);
});

test('mobile fails refresh rather than silently showing a false zero stage', () => {
  assert.match(source, /throw new Error\(`Canonical \$\{state\} alert inbox unavailable`\)/);
});
