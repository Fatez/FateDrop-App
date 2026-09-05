const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'screens', 'alerts-screen-v4.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app', '(tabs)', 'alerts.tsx'), 'utf8');

test('mobile Alerts maps each canonical lifecycle to the correct companion hero artwork', () => {
  assert.match(route, /alerts-screen-v4/);
  assert.match(screen, /WHISPER:[\s\S]*companion: 'Oru'[\s\S]*orualertscreen-whisper\.png/);
  assert.match(screen, /ECHO:[\s\S]*companion: 'Fenn'[\s\S]*Fennalertscreen-echo\.png/);
  assert.match(screen, /MANIFESTED:[\s\S]*companion: 'Koru'[\s\S]*korumanifestalertscreen\.png/);
  assert.match(screen, /VANISHED:[\s\S]*companion: 'Nyxen'[\s\S]*nyxenalertscreen-vanish\.png/);
  assert.doesNotMatch(screen, /alert-(?:oru|fenn|koru|nyxen)(?:-hero-final)?\.webp/);
});

test('companion artwork remains presentation over canonical lifecycle alerts', () => {
  assert.match(screen, /queryCanonicalAlertPage/);
  assert.match(screen, /const item = meta\[alert\.fateStage\]/);
  assert.match(screen, /active\.companion\.toUpperCase\(\).*active\.label\.toUpperCase\(\)/s);
  assert.doesNotMatch(screen, /fetchCanonicalAlerts\(100\)/);
});

test('active Alerts explains FateFind and FateMatch as hunt and successful result', () => {
  assert.match(screen, /FATEFIND → FATEMATCH/);
  assert.match(screen, /A FateFind stays active while it searches/);
  assert.match(screen, /successful result becomes a FateMatch/);
  assert.match(screen, /NEW FATEFIND/);
  assert.match(screen, /FATEMATCH — LIVE NOW/);
  assert.doesNotMatch(screen, /FateMatch watches/);
  assert.doesNotMatch(screen, /NEW FATEMATCH/);
});