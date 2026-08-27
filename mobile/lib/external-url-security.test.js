const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const helper = fs.readFileSync(path.join(__dirname, 'external-url-security.ts'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

test('notification navigation is HTTPS-only and rejects unsafe hosts', () => {
  assert.match(helper, /url\.protocol !== 'https:'/);
  assert.match(helper, /url\.username \|\| url\.password/);
  assert.match(helper, /host === 'localhost'/);
  assert.match(helper, /a === 10/);
  assert.match(helper, /a === 172 && b >= 16 && b <= 31/);
  assert.match(helper, /a === 192 && b === 168/);
  assert.match(helper, /a === 169 && b === 254/);
});

test('notification taps must pass the URL through the security helper before Linking.openURL', () => {
  assert.match(layout, /safeExternalHttpsUrl\(response\.notification\.request\.content\.data\?\.productUrl\)/);
  assert.match(layout, /if \(safeProductUrl\) void Linking\.openURL\(safeProductUrl\)/);
  assert.doesNotMatch(layout, /\^https\?:\\\/\\\//);
});
