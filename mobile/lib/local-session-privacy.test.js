const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, '..', 'services', 'fatedrop-id.ts'), 'utf8');
const context = fs.readFileSync(path.join(__dirname, '..', 'contexts', 'fatedrop-id-context.tsx'), 'utf8');

test('bearer token remains in SecureStore while legacy plaintext tokens are migrated away', () => {
  assert.match(service, /SecureStore\.setItemAsync\(TOKEN_KEY,token\)/);
  assert.match(service, /SecureStore\.getItemAsync\(TOKEN_KEY\)/);
  assert.match(service, /AsyncStorage\.removeItem\(LEGACY_TOKEN_KEY\)/);
});

test('full identity and collector activity snapshot is no longer persisted in AsyncStorage', () => {
  assert.match(service, /AsyncStorage\.removeItem\(SNAPSHOT_KEY\)/);
  assert.doesNotMatch(service, /AsyncStorage\.setItem\(SNAPSHOT_KEY/);
  assert.match(service, /async function saveSnapshot\(snapshot:FateDropSyncSnapshot\)\{return normalizeSnapshot\(snapshot\);\}/);
});

test('app launch restores canonical identity from a SecureStore-backed server session', () => {
  assert.match(context, /Promise\.all\(\[loadCachedIdentitySnapshot\(\), getStoredSessionToken\(\)\]\)/);
  assert.match(context, /if \(token\) void refresh\(\)/);
  assert.match(service, /FATEDROP_WEB_URL/);
});
