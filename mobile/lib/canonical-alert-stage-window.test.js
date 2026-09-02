const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const query = fs.readFileSync(path.join(__dirname, '../services/canonical-alert-query.ts'), 'utf8');
const screen = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v4.tsx'), 'utf8');

test('active Alerts view requests one independent canonical lifecycle window', () => {
  assert.match(query, /stateByStage/);
  assert.match(query, /state: stateByStage\[query\.stage\]/);
  assert.match(query, /\/api\/mobile\/alerts\?\$\{params\.toString\(\)\}/);
  assert.match(screen, /queryCanonicalAlertPage\(pageQuery/);
  assert.doesNotMatch(screen, /fetchCanonicalAlerts\(100\)/);
  assert.doesNotMatch(screen, /Promise\.all\([\s\S]{0,160}WHISPER[\s\S]{0,160}ECHO[\s\S]{0,160}MANIFESTED[\s\S]{0,160}VANISHED/);
});

test('mobile fails the selected lifecycle read rather than accepting cross-stage or malformed data', () => {
  assert.match(query, /alert\.fateStage !== query\.stage/);
  assert.match(query, /returned invalid lifecycle data/);
});

test('bounded lifecycle windows keep Manifested at 100 and the other initial feeds at 20', () => {
  assert.match(query, /WHISPER: 20/);
  assert.match(query, /ECHO: 20/);
  assert.match(query, /MANIFESTED: 100/);
  assert.match(query, /VANISHED: 20/);
});