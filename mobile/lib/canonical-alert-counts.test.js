const assert = require('node:assert/strict');
const test = require('node:test');

const { countCanonicalAlertBasisByStage } = require('./canonical-alert-counts');

const basis = [
  { id: 'w-pokemon-1', tcgCode: 'pokemon', fateStage: 'WHISPER', detectedAt: '2026-09-02T08:00:00Z' },
  { id: 'w-pokemon-2', tcgCode: 'pokemon', fateStage: 'WHISPER', detectedAt: '2026-09-02T08:01:00Z' },
  { id: 'w-one-piece', tcgCode: 'one-piece', fateStage: 'WHISPER', detectedAt: '2026-09-02T08:02:00Z' },
  { id: 'e-pokemon', tcgCode: 'pokemon', fateStage: 'ECHO', detectedAt: '2026-09-02T08:03:00Z' },
  { id: 'm-pokemon', tcgCode: 'pokemon', fateStage: 'MANIFESTED', detectedAt: '2026-09-02T08:04:00Z' },
  { id: 'v-one-piece', tcgCode: 'one-piece', fateStage: 'VANISHED', detectedAt: '2026-09-02T08:05:00Z' },
];

test('lifecycle totals are derived from the complete read basis rather than the rendered page', () => {
  assert.deepEqual(countCanonicalAlertBasisByStage(basis), {
    WHISPER: 3,
    ECHO: 1,
    MANIFESTED: 1,
    VANISHED: 1,
  });
});

test('lifecycle totals preserve the active TCG filter without changing canonical stages', () => {
  assert.deepEqual(countCanonicalAlertBasisByStage(basis, 'pokemon'), {
    WHISPER: 2,
    ECHO: 1,
    MANIFESTED: 1,
    VANISHED: 0,
  });
  assert.deepEqual(countCanonicalAlertBasisByStage(basis, 'one-piece'), {
    WHISPER: 1,
    ECHO: 0,
    MANIFESTED: 0,
    VANISHED: 1,
  });
});
