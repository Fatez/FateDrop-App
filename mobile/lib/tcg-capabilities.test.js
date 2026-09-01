const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  fallbackTcgCapabilities,
  normalizeTcgCapabilityResponse,
  tcgCapabilityLabel,
} = require('./tcg-capabilities');

const definitions = [
  { code: 'pokemon', live: true },
  { code: 'one-piece', live: false },
  { code: 'lorcana', live: false },
];

const mobileRoot = path.join(__dirname, '..');
const readMobile = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

function cloudEntry(code, activationPhase, overrides = {}) {
  const phaseRank = ['foundation', 'catalogue_shadow', 'browse_only', 'monitoring_shadow', 'alerts_enabled'].indexOf(activationPhase);
  return {
    code,
    activationPhase,
    interestSelectable: true,
    catalogueIngestionEnabled: phaseRank >= 1,
    browseEnabled: phaseRank >= 2,
    retailerMonitoringEnabled: phaseRank >= 3,
    lifecycleAlertsEnabled: phaseRank >= 4,
    ...overrides,
  };
}

test('offline fallback preserves Pokemon and keeps One Piece operational paths off', () => {
  const capabilities = fallbackTcgCapabilities(definitions);
  assert.equal(capabilities.pokemon.lifecycleAlertsEnabled, true);
  assert.equal(capabilities['one-piece'].interestSelectable, true);
  assert.equal(capabilities['one-piece'].catalogueIngestionEnabled, false);
  assert.equal(capabilities['one-piece'].browseEnabled, false);
  assert.equal(capabilities['one-piece'].retailerMonitoringEnabled, false);
  assert.equal(capabilities['one-piece'].lifecycleAlertsEnabled, false);
});

test('valid Cloud phases advance only their declared monotonic capability gates', () => {
  const result = normalizeTcgCapabilityResponse({
    success: true,
    contractVersion: 1,
    source: 'FATEDROP_CLOUD',
    tcgs: [
      cloudEntry('pokemon', 'alerts_enabled'),
      cloudEntry('one-piece', 'browse_only'),
      cloudEntry('lorcana', 'foundation'),
    ],
  }, definitions);
  assert.equal(result.source, 'cloud');
  assert.equal(result.capabilities['one-piece'].browseEnabled, true);
  assert.equal(result.capabilities['one-piece'].retailerMonitoringEnabled, false);
  assert.equal(result.capabilities['one-piece'].lifecycleAlertsEnabled, false);
  assert.equal(tcgCapabilityLabel(result.capabilities['one-piece']), 'BROWSE READY · ALERTS OFF');
});

test('contradictory Cloud phase and booleans fail closed instead of activating One Piece', () => {
  const result = normalizeTcgCapabilityResponse({
    success: true,
    contractVersion: 1,
    source: 'FATEDROP_CLOUD',
    tcgs: [
      cloudEntry('pokemon', 'alerts_enabled'),
      cloudEntry('one-piece', 'foundation', {
        catalogueIngestionEnabled: true,
        browseEnabled: true,
        retailerMonitoringEnabled: true,
        lifecycleAlertsEnabled: true,
      }),
    ],
  }, definitions);
  assert.equal(result.source, 'fallback');
  assert.equal(result.capabilities['one-piece'].lifecycleAlertsEnabled, false);
});

test('missing future TCG entries never inherit an active local capability', () => {
  const result = normalizeTcgCapabilityResponse({
    success: true,
    contractVersion: 1,
    source: 'FATEDROP_CLOUD',
    tcgs: [cloudEntry('pokemon', 'alerts_enabled')],
  }, definitions);
  assert.equal(result.source, 'cloud');
  assert.equal(result.capabilities['one-piece'].activationPhase, 'foundation');
  assert.equal(result.capabilities['one-piece'].lifecycleAlertsEnabled, false);
  assert.equal(result.capabilities.lorcana.lifecycleAlertsEnabled, false);
});

test('duplicate known TCG entries invalidate the whole Cloud snapshot', () => {
  const pokemon = cloudEntry('pokemon', 'alerts_enabled');
  const result = normalizeTcgCapabilityResponse({
    success: true,
    contractVersion: 1,
    source: 'FATEDROP_CLOUD',
    tcgs: [pokemon, pokemon],
  }, definitions);
  assert.equal(result.source, 'fallback');
  assert.equal(result.capabilities['one-piece'].lifecycleAlertsEnabled, false);
});

test('App activation state comes from the versioned Cloud capability route', () => {
  const service = readMobile('services', 'tcg-capabilities.ts');
  const layout = readMobile('app', '_layout.tsx');
  assert.match(service, /\/api\/tcgs/);
  assert.match(service, /result\.source !== 'cloud'/);
  assert.match(layout, /<TcgCapabilitiesProvider>/);
});

test('One Piece local filters are shared by canonical signals and FateMatches', () => {
  const alerts = readMobile('screens', 'alerts-screen-v4.tsx');
  assert.match(alerts, /<Matches signedIn=\{signedIn\} snapshot=\{snapshot\} tcgFilter=\{tcgFilter\}/);
  assert.match(alerts, /filter\(\(match\) => includesTcg\(match\.tcgCode\)\)/);
  assert.match(alerts, /tcgLabel\(match\.tcgCode\)/);
});

test('unknown canonical TCG identity is displayed honestly and never rewritten to Pokemon', () => {
  const identity = readMobile('services', 'fatedrop-id.ts');
  const fateMatch = readMobile('screens', 'fatematch-screen-v2.tsx');
  assert.match(identity, /isTcgCode\(match\.tcgCode\)\?match\.tcgCode:'unknown'/);
  assert.doesNotMatch(identity, /isTcgCode\(match\.tcgCode\)\?match\.tcgCode:'pokemon'/);
  assert.match(fateMatch, /'Unknown TCG'/);
});
