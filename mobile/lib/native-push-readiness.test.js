const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const notifications = fs.readFileSync(path.join(root, 'lib/notifications.ts'), 'utf8');

test('FateDrop has stable native application identifiers', () => {
  assert.equal(app.expo.name, 'FateDrop');
  assert.equal(app.expo.slug, 'fatedrop');
  assert.equal(app.expo.scheme, 'fatedrop');
  assert.equal(app.expo.ios.bundleIdentifier, 'uk.co.fatedrop');
  assert.equal(app.expo.android.package, 'uk.co.fatedrop');
});

test('EAS has explicit internal beta and production build profiles', () => {
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.production.autoIncrement, true);
});

test('current App is linked to the canonical FateDrop EAS project without changing native identity', () => {
  assert.equal(app.expo.owner, 'fatesdrops-team');
  assert.equal(app.expo.extra?.eas?.projectId, '13f37e5b-31b2-4eae-b523-dad02a8986d0');
  assert.match(notifications, /EXPO_PUBLIC_EAS_PROJECT_ID/);
  assert.match(notifications, /Constants\.expoConfig\?\.extra\?\.eas\?\.projectId/);
  assert.match(notifications, /Constants\.easConfig\?\.projectId/);
  assert.match(notifications, /reason: 'eas-project-id-required'/);
  assert.match(notifications, /getExpoPushTokenAsync\(\{ projectId \}\)/);
});
