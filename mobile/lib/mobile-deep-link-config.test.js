const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));

test('production app uses the FateDrop-specific URL scheme', () => {
  assert.equal(appConfig.expo?.scheme, 'fatedrop');
  assert.notEqual(appConfig.expo?.scheme, 'mobile');
});
