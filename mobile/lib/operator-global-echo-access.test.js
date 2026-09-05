const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const identity = fs.readFileSync(path.join(__dirname, '../services/fatedrop-id.ts'), 'utf8');
const access = fs.readFileSync(path.join(__dirname, '../services/operator-access.ts'), 'utf8');
const composer = fs.readFileSync(path.join(__dirname, '../app/manual-echo-intake.tsx'), 'utf8');
const preferences = fs.readFileSync(path.join(__dirname, '../app/notification-preferences.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');
const profile = fs.readFileSync(path.join(__dirname, '../screens/profile-screen-v2.tsx'), 'utf8');

test('operator capability is consumed from the authoritative identity snapshot and fails closed', () => {
  assert.match(identity, /operatorCapabilities:FateDropOperatorCapabilities/);
  assert.match(identity, /canSendGlobalEcho:accessAllowed&&input\?\.canSendGlobalEcho===true/);
  assert.match(identity, /canRetractGlobalEcho:accessAllowed&&input\?\.canRetractGlobalEcho===true/);
  assert.match(identity, /snapshot\?\.accessAllowed&&snapshot\.betaAccess\?\.approved&&snapshot\.operatorCapabilities\?\.canSendGlobalEcho===true/);
  assert.match(identity, /snapshot\?\.accessAllowed&&snapshot\.betaAccess\?\.approved&&snapshot\.operatorCapabilities\?\.canRetractGlobalEcho===true/);
  assert.doesNotMatch(access, /email|fateId|AsyncStorage|SecureStore/i);
});

test('Global Echo controls never render while authority is unresolved or errored', () => {
  assert.match(access, /if \(input\.loading \|\| input\.syncing\) return 'loading'/);
  assert.match(access, /if \(input\.error\) return 'denied'/);
  assert.match(access, /if \(!input\.signedIn\) return 'denied'/);
  assert.match(profile, /operatorAccess === 'authorized' \? <>[\s\S]*OWNER OPERATOR[\s\S]*Operator Echoes[\s\S]*<\/\> : null/);
  assert.doesNotMatch(preferences, /SEND GLOBAL ECHO ALERT|manual-echo-intake/);
  assert.doesNotMatch(tools, /Send Global Echo|manual-echo-intake/);
});

test('direct composer navigation is guarded before the owner UI can render', () => {
  assert.match(composer, /const sendAccess = globalEchoAccessState\(accessInput\)/);
  assert.match(composer, /const retractAccess = globalEchoRetractionAccessState\(accessInput\)/);
  assert.match(composer, /operatorEchoConsoleAccessState\(accessInput\)/);
  assert.match(composer, /if \(consoleAccess === 'denied'\) router\.replace\('\/\(tabs\)\/profile'\)/);
  assert.match(composer, /if \(consoleAccess !== 'authorized'\)[\s\S]*return <SafeAreaView/);
  assert.ok(composer.indexOf("if (consoleAccess !== 'authorized')") < composer.indexOf('OWNER ONLY · OPERATOR ECHOES'));
});

test('capability revocation is snapshot-driven and does not create a client-owned grant path', () => {
  assert.match(access, /canSendGlobalEcho\(input\.snapshot\)/);
  assert.match(access, /canRetractGlobalEcho\(input\.snapshot\)/);
  assert.doesNotMatch(identity, /updateRemote.*canSendGlobalEcho|PATCH[\s\S]{0,100}canSendGlobalEcho/);
  assert.doesNotMatch(preferences, /setCanSendGlobalEcho|canSendGlobalEcho\s*=\s*true/);
  assert.doesNotMatch(tools, /setCanSendGlobalEcho|canSendGlobalEcho\s*=\s*true/);
});
