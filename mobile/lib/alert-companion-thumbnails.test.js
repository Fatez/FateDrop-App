const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'screens', 'alerts-screen-v3.tsx'), 'utf8');

test('mobile Alerts maps each canonical lifecycle to the correct companion thumbnail', () => {
  assert.match(screen, /WHISPER: .*companion: 'Oru'.*alert-oru\.webp/);
  assert.match(screen, /ECHO: .*companion: 'Fenn'.*alert-fenn\.webp/);
  assert.match(screen, /MANIFESTED: .*companion: 'Koru'.*alert-koru\.webp/);
  assert.match(screen, /VANISHED: .*companion: 'Nyxen'.*alert-nyxen\.webp/);
});

test('companion thumbnails are app-only presentation, not alert semantics', () => {
  assert.match(screen, /fetchCanonicalAlerts\(50\)/);
  assert.match(screen, /alert\.fateStage === filter/);
  assert.match(screen, /meta\.companion\.toUpperCase\(\).*meta\.label\.toUpperCase\(\)/s);
});
