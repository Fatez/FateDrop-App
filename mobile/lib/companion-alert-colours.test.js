const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const theme = fs.readFileSync(path.join(__dirname, '..', 'constants', 'theme.ts'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '..', 'screens', 'alerts-screen-v4.tsx'), 'utf8');

test('lifecycle colours stay tied to their assigned companions', () => {
  assert.match(theme, /whisper: '#D2B66F'.*Oru/);
  assert.match(theme, /echo: '#D9CDBB'.*Fenn/);
  assert.match(theme, /manifested: '#7C6EFF'.*Koru/);
  assert.match(theme, /vanished: '#EF4D5A'.*Nyxen/);
});

test('active Alerts screen consumes shared lifecycle tokens rather than local colours', () => {
  assert.match(alerts, /WHISPER: \{ label: 'Whisper', companion: 'Oru', color: FateDropColors\.whisper/);
  assert.match(alerts, /ECHO: \{ label: 'Echo', companion: 'Fenn', color: FateDropColors\.echo/);
  assert.match(alerts, /MANIFESTED: \{ label: 'Manifested', companion: 'Koru', color: FateDropColors\.manifested/);
  assert.match(alerts, /VANISHED: \{ label: 'Vanished', companion: 'Nyxen', color: FateDropColors\.vanished/);
});
