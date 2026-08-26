const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const sessionSource = fs.readFileSync(path.join(root, 'services', 'fatedrop-id.ts'), 'utf8');
const layoutSource = fs.readFileSync(path.join(root, 'app', '_layout.tsx'), 'utf8');
const urlSource = fs.readFileSync(path.join(__dirname, 'safe-external-url.ts'), 'utf8');

test('mobile bearer tokens remain in SecureStore and failed logout revocations are retried', () => {
  assert.match(sessionSource, /SecureStore\.setItemAsync\(TOKEN_KEY,token\)/);
  assert.doesNotMatch(sessionSource, /AsyncStorage\.setItem\(TOKEN_KEY/);
  assert.match(sessionSource, /PENDING_REVOKE_KEY/);
  assert.match(sessionSource, /SecureStore\.setItemAsync\(PENDING_REVOKE_KEY,token\)/);
  assert.match(sessionSource, /retryPendingSessionRevocation\(\)/);
});

test('notification external links are HTTPS-only and validated before opening', () => {
  assert.match(urlSource, /url\.protocol !== 'https:'/);
  assert.match(urlSource, /url\.username \|\| url\.password/);
  assert.match(urlSource, /localhost/);
  assert.match(urlSource, /IPV4_LITERAL/);
  assert.match(layoutSource, /safeExternalHttpsUrl\(response\.notification\.request\.content\.data\?\.productUrl\)/);
  assert.match(layoutSource, /if \(productUrl\) void Linking\.openURL\(productUrl\)/);
  assert.doesNotMatch(layoutSource, /\^https\?:\\\/\\\//);
});

test('production error boundary does not display raw exception messages', () => {
  assert.match(layoutSource, /__DEV__ && error\.message/);
  assert.match(layoutSource, /FateDrop could not load this page\./);
});
