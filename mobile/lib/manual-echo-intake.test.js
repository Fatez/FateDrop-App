const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, '../services/manual-echo-intake.ts'), 'utf8');
const screen = fs.readFileSync(path.join(__dirname, '../app/manual-echo-intake.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v4.tsx'), 'utf8');

test('manual operator intake always creates Echo and never claims verified stock', () => {
  assert.match(service, /kind: 'echo'/);
  assert.match(service, /physicalEvidenceState.*'expected'.*'reported'/s);
  assert.doesNotMatch(service, /kind: 'manifested'|availabilityVerified: true/);
  assert.match(service, /issues\/new\?title=/);
});

test('operator control prepares a simple real global Echo with human text and a link', () => {
  assert.match(service, /buildManualGlobalEchoIntake/);
  assert.match(service, /scope: 'online_retailer_readiness'/);
  assert.match(service, /sourceType: 'operator_manual'/);
  assert.match(service, /retailerId: 'fatedrop-intelligence'/);
  assert.match(service, /tcgCode: 'pokemon'/);
  assert.match(screen, /AUTHORISED OPERATOR · GLOBAL ECHO/);
  assert.match(screen, /Headline/);
  assert.match(screen, /Short message/);
  assert.match(screen, /Link customers should check \(HTTPS\)/);
  assert.match(screen, /Send a real global Echo\?/);
  assert.match(screen, /REVIEW & SEND GLOBAL ECHO/);
  assert.match(screen, /eligible Pokémon users with Echo alerts enabled/);
  assert.doesNotMatch(screen, /\bTEST\b/i);
  assert.match(tools, /Send Global Echo/);
  assert.match(alerts, /alert\.signalKind === 'operator_readiness'/);
  assert.match(alerts, /BIG FATE SIGNAL · ECHO/);
  assert.match(alerts, /alert\.operatorIntelligence\?\.expectedLabel/);
  assert.match(alerts, /READINESS · NOT CONFIRMED STOCK/);
  assert.match(alerts, /CHECK LINK/);
  assert.match(alerts, /placement: 'global-operator-echo'/);
});
