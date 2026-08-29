const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

test('iOS release declares exempt encryption status explicitly', () => {
  assert.equal(appConfig.expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption, false);
});

test('Android location permissions stay explicit for Local Radar', () => {
  const permissions = appConfig.expo.android?.permissions ?? [];
  assert.ok(permissions.includes('android.permission.ACCESS_COARSE_LOCATION'));
  assert.ok(permissions.includes('android.permission.ACCESS_FINE_LOCATION'));
});
