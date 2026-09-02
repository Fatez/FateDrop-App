const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const notifications = fs.readFileSync(path.join(root, 'lib/notifications.ts'), 'utf8');
const rootLayout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
const pushBoundary = fs.readFileSync(path.join(root, 'components/push-registration-boundary.tsx'), 'utf8');
const notificationPreferences = fs.readFileSync(path.join(root, 'app/notification-preferences.tsx'), 'utf8');

test('FateDrop has stable native application identifiers', () => {
  assert.equal(app.expo.name, 'FateDrop');
  assert.equal(app.expo.slug, 'fatedrop');
  assert.equal(app.expo.scheme, 'fatedrop');
  assert.equal(app.expo.ios.bundleIdentifier, 'uk.co.fatedrop');
  assert.equal(app.expo.android.package, 'uk.co.fatedrop');
});

test('EAS has explicit internal beta and production build profiles', () => {
  assert.equal(eas.cli.appVersionSource, 'remote');
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

test('foreground push presentation is installed when the app shell boots', () => {
  assert.match(rootLayout, /import ['"]@\/lib\/notifications['"];/);
  assert.match(notifications, /Notifications\.setNotificationHandler/);
  assert.match(notifications, /shouldShowBanner:\s*true/);
  assert.match(notifications, /shouldShowList:\s*true/);
  assert.match(notifications, /shouldPlaySound:\s*true/);
});

test('signed-in devices force self-heal on boot, app activation and token roll', () => {
  assert.match(rootLayout, /PushRegistrationBoundary/);
  assert.match(notifications, /refreshStockAlertRegistration/);
  assert.match(notifications, /getPermissionsAsync\(\)/);
  assert.match(notifications, /acquireAndPersistExpoPushToken/);
  assert.match(notifications, /Register the replacement before retiring the old endpoint/);
  assert.match(pushBoundary, /AppState\.addEventListener\('change'/);
  assert.match(pushBoundary, /Notifications\.addPushTokenListener/);
  assert.match(pushBoundary, /refreshStockAlertRegistration\(\{ force \}\)/);
  assert.match(pushBoundary, /refresh\(true\);\s*const appStateSubscription/);
  assert.match(pushBoundary, /if \(state === 'active'\) refresh\(true\);/);
});

test('iOS push permission follows the native authorization status', () => {
  assert.match(notifications, /permission\.ios\?\.status/);
  assert.match(notifications, /IosAuthorizationStatus\.AUTHORIZED/);
  assert.match(notifications, /IosAuthorizationStatus\.PROVISIONAL/);
  assert.match(notifications, /IosAuthorizationStatus\.EPHEMERAL/);
  assert.match(notifications, /notificationPermissionGranted\(permission\)/);
});

test('the device toggle reflects local registration as well as account preference', () => {
  assert.match(notifications, /registeredOnDevice: Boolean\(storedToken\)/);
  assert.match(notificationPreferences, /const devicePushEnabled = Boolean\(preferences\?\.push && registeredOnDevice\)/);
  assert.match(notificationPreferences, /devicePushEnabled \? await unregisterStockAlerts\(\) : await registerForStockAlerts\(\)/);
  assert.doesNotMatch(notificationPreferences, /preferences\.push \? await unregisterStockAlerts\(\)/);
  assert.match(notificationPreferences, /AppState\.addEventListener\('change'/);
});

test('disabling push fails closed before removing this installation token', () => {
  const preferenceWrite = notifications.indexOf("updateRemoteNotificationPreferences({ push: false })");
  const localRemoval = notifications.indexOf('AsyncStorage.removeItem(PUSH_TOKEN_KEY)', preferenceWrite);
  assert.ok(preferenceWrite > 0);
  assert.ok(localRemoval > preferenceWrite);
  assert.doesNotMatch(notifications, /updateRemoteNotificationPreferences\(\{ push: false \}\)\.catch/);
});
