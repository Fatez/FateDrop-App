const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const notifications = fs.readFileSync(path.join(root, 'lib/notifications.ts'), 'utf8');
const preferences = fs.readFileSync(path.join(root, 'app/notification-preferences.tsx'), 'utf8');

test('paid app does not ship a local Vanished notification shortcut', () => {
  assert.doesNotMatch(notifications, /sendVanishedPresentationTest/);
  assert.doesNotMatch(notifications, /\[TEST\] FateDrop · Vanished/);
  assert.doesNotMatch(preferences, /TEST VANISHED ALERT/);
  assert.doesNotMatch(preferences, /sendVanishedPresentationTest/);
});
