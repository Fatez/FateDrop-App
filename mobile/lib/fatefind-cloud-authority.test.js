const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '..', 'screens', 'fatefind-live-screen.tsx'), 'utf8');
const helper = fs.readFileSync(path.join(__dirname, 'value-compare.js'), 'utf8');

test('mobile FateFind requests the canonical FateDrop Cloud verdict through the shared gateway', () => {
  assert.match(screen, /FATEDROP_WEB_URL/);
  assert.match(screen, /\/api\/fatefind\/verdict/);
  assert.match(screen, /FATEDROP_CLOUD/);
  assert.match(screen, /pairVerdict/);
  assert.match(screen, /Compare two items/);
});

test('mobile FateFind does not contain an independent authoritative winner calculator', () => {
  assert.doesNotMatch(screen, /compareValueGroups|function\s+bestOffer|function\s+valuePosition|function\s+rankGroups/);
  assert.doesNotMatch(helper, /compareValueGroups|function\s+bestOffer|function\s+valuePosition|rrpPercent\s*=/);
});