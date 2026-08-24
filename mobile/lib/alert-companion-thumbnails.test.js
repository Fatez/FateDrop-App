const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'screens', 'alerts-screen-v3.tsx'), 'utf8');

test('mobile Alerts maps each canonical lifecycle to the correct companion artwork', () => {
  assert.match(screen, /WHISPER:[\s\S]*companion: 'Oru'[\s\S]*alert-oru\.webp/);
  assert.match(screen, /ECHO:[\s\S]*companion: 'Fenn'[\s\S]*alert-fenn\.webp/);
  assert.match(screen, /MANIFESTED:[\s\S]*companion: 'Koru'[\s\S]*alert-koru\.webp/);
  assert.match(screen, /VANISHED:[\s\S]*companion: 'Nyxen'[\s\S]*alert-nyxen\.webp/);
});

test('companion artwork remains presentation over the canonical alert lifecycle', () => {
  assert.match(screen, /fetchCanonicalAlerts\(100\)/);
  assert.match(screen, /alert\.fateStage === stage/);
  assert.match(screen, /meta\.companion\.toUpperCase\(\).*meta\.label\.toUpperCase\(\)/s);
});
