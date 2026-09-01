const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, '../services/manual-echo-intake.ts'), 'utf8');
const screen = fs.readFileSync(path.join(__dirname, '../app/manual-echo-intake.tsx'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../app/tools.tsx'), 'utf8');

test('manual operator intake always creates Echo and never claims verified stock', () => {
  assert.match(service, /kind: 'echo'/);
  assert.match(service, /physicalEvidenceState.*'expected'.*'reported'/s);
  assert.doesNotMatch(service, /kind: 'manifested'|availabilityVerified: true/);
  assert.match(service, /issues\/new\?title=/);
});

test('manual intake supports online readiness and exact physical branches', () => {
  assert.match(screen, /online_retailer_readiness/);
  assert.match(screen, /physical_branch/);
  assert.match(screen, /Pokémon Centre traffic/);
  assert.match(screen, /Influencer \/ manual/);
  assert.match(screen, /Official retailer/);
  assert.match(screen, /OPEN AUTHORISED ECHO ISSUE/);
  assert.match(screen, /SHARE INTAKE PACKET/);
  assert.match(tools, /Manual Echo intake/);
});
