const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

const boundaryStart = source.indexOf('export function ErrorBoundary');
const boundaryEnd = source.indexOf('export default function RootLayout');
const boundary = source.slice(boundaryStart, boundaryEnd);

test('production error boundary never renders raw exception detail', () => {
  assert.ok(boundaryStart >= 0 && boundaryEnd > boundaryStart, 'ErrorBoundary source must be present');
  assert.doesNotMatch(boundary, /error\.message|String\(error\)|\{error\}/);
  assert.match(boundary, /FateDrop could not load this page\. Try again, or return home\./);
});

test('safe recovery controls remain available after redaction', () => {
  assert.match(boundary, /onPress=\{retry\}/);
  assert.match(boundary, /router\.replace\('\/'\)/);
  assert.match(boundary, />Try again</);
  assert.match(boundary, />Return home</);
});
