const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, '../services/manual-echo-intake.ts'), 'utf8');
const screen = fs.readFileSync(path.join(__dirname, '../app/manual-echo-intake.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');
const profile = fs.readFileSync(path.join(__dirname, '../screens/profile-screen-v2.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
const alerts = fs.readFileSync(path.join(__dirname, '../screens/alerts-screen-v4.tsx'), 'utf8');

test('manual operator intake always creates Echo and never claims verified stock', () => {
  assert.match(service, /kind: 'echo'/);
  assert.match(service, /physicalEvidenceState.*'expected'.*'reported'/s);
  assert.doesNotMatch(service, /kind: 'manifested'|availabilityVerified: true/);
  assert.match(service, /issues\/new\?title=/);
  assert.match(service, /operation: 'publish'/);
  assert.match(service, /operatorConfirmation: 'SEND_GLOBAL_ECHO'/);
});

test('operator control prepares a simple real global Echo with human text and a link', () => {
  assert.match(service, /buildManualGlobalEchoIntake/);
  assert.match(service, /scope: 'online_retailer_readiness'/);
  assert.match(service, /sourceType: 'operator_manual'/);
  assert.match(service, /retailerId: 'fatedrop-intelligence'/);
  assert.match(service, /tcgCode: 'pokemon'/);
  assert.match(screen, /OWNER ONLY · OPERATOR ECHOES/);
  assert.match(screen, /Headline/);
  assert.match(screen, /Short message/);
  assert.match(screen, /Link customers should check \(HTTPS\)/);
  assert.match(screen, /Send a real global Echo\?/);
  assert.match(screen, /REVIEW & SEND GLOBAL ECHO/);
  assert.match(screen, /eligible Pokémon users with Echo alerts enabled/);
  assert.doesNotMatch(screen, /\bTEST\b/i);
  assert.match(profile, /Operator Echoes/);
  assert.doesNotMatch(tools, /Send Global Echo/);
  assert.match(alerts, /alert\.signalKind === 'operator_readiness'/);
  assert.match(alerts, /BIG FATE SIGNAL · ECHO/);
  assert.match(alerts, /alert\.operatorIntelligence\?\.expectedLabel/);
  assert.match(alerts, /READINESS · NOT CONFIRMED STOCK/);
  assert.match(alerts, /CHECK LINK/);
  assert.match(alerts, /placement: 'global-operator-echo'/);
});

test('owner console retracts only a selected manual Echo through an audited issue', () => {
  assert.match(service, /buildManualGlobalEchoRetraction/);
  assert.match(service, /operation: 'retract'/);
  assert.match(service, /operatorConfirmation: 'RETRACT_GLOBAL_ECHO'/);
  assert.match(service, /\[FATEDROP ECHO RETRACTION\]/);
  assert.match(screen, /listActiveManualOperatorEchoes/);
  assert.match(screen, /ACTIVE MANUAL ECHOES/);
  assert.match(screen, /REVIEW & RETRACT ECHO/);
  assert.match(screen, /does not create Vanished/);
  assert.match(layout, /handleOperatorEchoRetraction/);
  assert.match(layout, /if \(handleOperatorEchoRetraction\(data\)\) return/);
});
