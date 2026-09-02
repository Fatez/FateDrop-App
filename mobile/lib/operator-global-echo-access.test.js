const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const identity = fs.readFileSync(path.join(__dirname, '../services/fatedrop-id.ts'), 'utf8');
const access = fs.readFileSync(path.join(__dirname, '../services/operator-access.ts'), 'utf8');
const composer = fs.readFileSync(path.join(__dirname, '../app/manual-echo-intake.tsx'), 'utf8');
const preferences = fs.readFileSync(path.join(__dirname, '../app/notification-preferences.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');

test('operator capability is consumed from the authoritative identity snapshot and fails closed', () => {
  assert.match(identity, /operatorCapabilities:FateDropOperatorCapabilities/);
  assert.match(identity, /canSendGlobalEcho:accessAllowed&&input\?\.canSendGlobalEcho===true/);
  assert.match(identity, /snapshot\?\.accessAllowed&&snapshot\.betaAccess\?\.approved&&snapshot\.operatorCapabilities\?\.canSendGlobalEcho===true/);
  assert.doesNotMatch(access, /email|fateId|AsyncStorage|SecureStore/i);
});

test('Global Echo controls never render while authority is unresolved or errored', () => {
  assert.match(access, /if \(input\.loading \|\| input\.syncing\) return 'loading'/);
  assert.match(access, /if \(input\.error\) return 'denied'/);
  assert.match(access, /if \(!input\.signedIn\) return 'denied'/);
  assert.match(preferences, /globalEchoAccess === 'authorized' \? <Pressable[\s\S]*SEND GLOBAL ECHO ALERT[\s\S]*<\/Pressable> : null/);
  assert.match(tools, /globalEchoAccess === 'authorized' \? <Tool[\s\S]*title="Send Global Echo"[\s\S]*: null/);
});

test('direct composer navigation is guarded before the owner UI can render', () => {
  assert.match(composer, /globalEchoAccessState\(\{ snapshot, signedIn, loading, syncing, error \}\)/);
  assert.match(composer, /if \(operatorAccess === 'denied'\) router\.replace\('\/notification-preferences'\)/);
  assert.match(composer, /if \(operatorAccess !== 'authorized'\)[\s\S]*return <SafeAreaView/);
  assert.ok(composer.indexOf("if (operatorAccess !== 'authorized')") < composer.indexOf('AUTHORISED OPERATOR · GLOBAL ECHO'));
});

test('capability revocation is snapshot-driven and does not create a client-owned grant path', () => {
  assert.match(access, /canSendGlobalEcho\(input\.snapshot\)/);
  assert.doesNotMatch(identity, /updateRemote.*canSendGlobalEcho|PATCH[\s\S]{0,100}canSendGlobalEcho/);
  assert.doesNotMatch(preferences, /setCanSendGlobalEcho|canSendGlobalEcho\s*=\s*true/);
  assert.doesNotMatch(tools, /setCanSendGlobalEcho|canSendGlobalEcho\s*=\s*true/);
});