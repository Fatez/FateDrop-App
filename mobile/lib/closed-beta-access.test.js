const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, '../services/fatedrop-id.ts'), 'utf8');
const boundary = fs.readFileSync(path.join(__dirname, '../components/closed-beta-boundary.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');

test('mobile identity contract consumes canonical beta approval separately from membership', () => {
  assert.match(service, /BetaAccessStatus = 'pending'\|'approved'\|'revoked'/);
  assert.match(service, /accessAllowed:boolean/);
  assert.match(service, /betaAccess:FateDropBetaAccess/);
  assert.match(service, /snapshot\.accessAllowed===true&&betaAccess\.approved/);
  assert.match(service, /capabilities:\[\]/);
});

test('pending sessions remain signed in only to check approval and do not call full sync', () => {
  const sessionCheck = service.indexOf("fetchSessionState(token)");
  const pendingReturn = service.indexOf("session.accessAllowed!==true||session.betaAccess?.approved!==true");
  const fullSync = service.indexOf("/api/mobile/sync");
  assert.ok(sessionCheck >= 0 && pendingReturn > sessionCheck, 'session status must be checked first');
  assert.ok(fullSync > pendingReturn, 'full sync must happen only after approval');
});

test('capability checks fail closed when beta is not approved', () => {
  assert.match(service, /snapshot\?\.accessAllowed&&snapshot\.betaAccess\?\.approved&&snapshot\.entitlement\?\.active/);
});

test('root layout blocks the normal FateDrop shell behind one closed beta boundary', () => {
  assert.match(layout, /<FateDropIdProvider>/);
  assert.match(layout, /<ClosedBetaBoundary>/);
  assert.ok(layout.indexOf('<ClosedBetaBoundary>') < layout.indexOf('<FateDropShell />'));
});

test('fresh installs fail closed and may enter only the account sign-in route', () => {
  assert.doesNotMatch(boundary, /loading \|\| !snapshot\?\.user \|\| snapshot\.accessAllowed/);
  assert.match(boundary, /if \(loading\)/);
  assert.match(boundary, /snapshot\?\.user && snapshot\.accessAllowed/);
  assert.match(boundary, /!snapshot\?\.user && pathname === '\/account'/);
  assert.match(boundary, /Closed beta access required/);
  assert.match(boundary, /router\.push\('\/account'\)/);
  assert.match(boundary, /FATEDROP_WEB_URL.*\/account\/register/);
  assert.match(boundary, /REQUEST BETA ACCESS ON WEBSITE/);
  assert.match(boundary, /Registration creates your closed-beta request in Pending status/);
  assert.match(boundary, /Installing FateDrop or receiving a TestFlight link does not grant beta access/);
});

test('pending App surface explains approval and supports refresh and sign out', () => {
  assert.match(boundary, /FATEDROP · CLOSED BETA/);
  assert.match(boundary, /Your beta request is pending/);
  assert.match(boundary, /TestFlight install or paid membership does not bypass this approval gate/);
  assert.match(boundary, /CHECK APPROVAL/);
  assert.match(boundary, /void refresh\(\)/);
  assert.match(boundary, /void signOut\(\)/);
});