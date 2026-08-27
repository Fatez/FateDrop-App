const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  countUnreadCanonicalAlertsByStageFromState,
  createCanonicalAlertReadState,
  markCanonicalAlertStageSeenInState,
  normalizeCanonicalAlertReadState,
} = require('./canonical-alert-read-state');

const alerts = [
  { id: 'w1', fateStage: 'WHISPER', detectedAt: '2026-08-27T10:00:00Z' },
  { id: 'w2', fateStage: 'WHISPER', detectedAt: '2026-08-27T11:00:00Z' },
  { id: 'e1', fateStage: 'ECHO', detectedAt: '2026-08-27T12:00:00Z' },
  { id: 'm1', fateStage: 'MANIFESTED', detectedAt: '2026-08-27T13:00:00Z' },
  { id: 'v1', fateStage: 'VANISHED', detectedAt: '2026-08-27T14:00:00Z' },
];

const screen = fs.readFileSync(path.join(__dirname, '..', 'screens', 'alerts-screen-v4.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');

test('unseen canonical alerts are counted independently by lifecycle', () => {
  const counts = countUnreadCanonicalAlertsByStageFromState(alerts, createCanonicalAlertReadState('user-1'));
  assert.deepEqual(counts, { WHISPER: 2, ECHO: 1, MANIFESTED: 1, VANISHED: 1 });
});

test('reading Whisper clears only Whisper and preserves Echo, Manifested, and Vanished unread state', () => {
  const initial = createCanonicalAlertReadState('user-1');
  const next = markCanonicalAlertStageSeenInState(initial, 'user-1', 'WHISPER', alerts, 1);
  assert.deepEqual(countUnreadCanonicalAlertsByStageFromState(alerts, next), { WHISPER: 0, ECHO: 1, MANIFESTED: 1, VANISHED: 1 });
});

test('each lifecycle can be read without clearing another lifecycle', () => {
  let state = createCanonicalAlertReadState('user-1');
  state = markCanonicalAlertStageSeenInState(state, 'user-1', 'ECHO', alerts, 1);
  assert.deepEqual(countUnreadCanonicalAlertsByStageFromState(alerts, state), { WHISPER: 2, ECHO: 0, MANIFESTED: 1, VANISHED: 1 });
  state = markCanonicalAlertStageSeenInState(state, 'user-1', 'MANIFESTED', alerts, 2);
  assert.deepEqual(countUnreadCanonicalAlertsByStageFromState(alerts, state), { WHISPER: 2, ECHO: 0, MANIFESTED: 0, VANISHED: 1 });
  state = markCanonicalAlertStageSeenInState(state, 'user-1', 'VANISHED', alerts, 3);
  assert.deepEqual(countUnreadCanonicalAlertsByStageFromState(alerts, state), { WHISPER: 2, ECHO: 0, MANIFESTED: 0, VANISHED: 0 });
});

test('aggregate badge total is the sum of unread lifecycle counts', () => {
  const state = markCanonicalAlertStageSeenInState(createCanonicalAlertReadState('user-1'), 'user-1', 'WHISPER', alerts, 1);
  const counts = countUnreadCanonicalAlertsByStageFromState(alerts, state);
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 3);
});

test('legacy global read cursor migrates into stage-safe cursors without losing prior read history', () => {
  const migrated = normalizeCanonicalAlertReadState({
    version: 1,
    userId: 'user-1',
    seenAlertIds: ['e1'],
    seenThroughDetectedAt: '2026-08-27T12:30:00Z',
    updatedAt: 123,
  }, 'user-1');
  assert.ok(migrated);
  assert.deepEqual(countUnreadCanonicalAlertsByStageFromState(alerts, migrated), { WHISPER: 0, ECHO: 0, MANIFESTED: 1, VANISHED: 1 });
});

test('lifecycle unread dots use the shared lifecycle colour selected from FateDropColors', () => {
  assert.match(screen, /WHISPER: \{ label: 'Whisper', companion: 'Oru', color: FateDropColors\.whisper/);
  assert.match(screen, /ECHO: \{ label: 'Echo', companion: 'Fenn', color: FateDropColors\.echo/);
  assert.match(screen, /MANIFESTED: \{ label: 'Manifested', companion: 'Koru', color: FateDropColors\.manifested/);
  assert.match(screen, /VANISHED: \{ label: 'Vanished', companion: 'Nyxen', color: FateDropColors\.vanished/);
  assert.match(screen, /unreadCounts\[value\] > 0[\s\S]*backgroundColor: item\.color/);
});

test('opening the active lifecycle marks only that lifecycle seen', () => {
  assert.match(screen, /markCanonicalAlertStageSeen\(userId, stage, visibleAlerts\)/);
  assert.doesNotMatch(screen, /markCanonicalAlertsSeen\(userId, next\)/);
});

test('bottom Alerts badge recalculates aggregate unread after lifecycle read-state changes', () => {
  assert.match(layout, /changedUserId === userId\) void refreshAlertCount\(\)/);
  assert.doesNotMatch(layout, /changedUserId === userId\) setAlertCount\(0\)/);
});
