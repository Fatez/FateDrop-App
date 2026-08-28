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

test('mobile logout keeps the bearer token until server revocation succeeds', () => {
  const start = service.indexOf('export async function signOutFateDropId()');
  const end = service.indexOf('export async function syncFateDropId', start);
  const signOut = service.slice(start, end);
  assert.ok(start >= 0 && end > start, 'signOutFateDropId source not found');
  assert.match(signOut, /method:'DELETE'/);
  assert.match(signOut, /if\(!response\.ok\)/);
  assert.match(signOut, /could not securely sign you out/);
  assert.ok(signOut.indexOf('if(!response.ok)') < signOut.lastIndexOf('await clearStoredSession()'), 'local token must only clear after a successful revocation response');
  assert.doesNotMatch(signOut, /\.catch\(\(\)=>null\)/);
});

test('logout failure preserves signed-in state so revocation can be retried', () => {
  const start = context.indexOf('const signOut = useCallback');
  const end = context.indexOf('const value = useMemo', start);
  const signOut = context.slice(start, end);
  assert.ok(start >= 0 && end > start, 'signOut context source not found');
  assert.doesNotMatch(signOut, /clearStoredSession/);
  assert.match(signOut, /catch \(cause\)/);
  assert.match(signOut, /throw cause/);
  assert.ok(signOut.indexOf('await signOutFateDropId()') < signOut.indexOf('setSnapshot(null)'), 'signed-in state must clear only after remote revocation succeeds');
});
