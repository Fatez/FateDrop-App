const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const identity = readFileSync(join(root, 'services', 'fatedrop-id.ts'), 'utf8');
const settings = readFileSync(join(root, 'app', 'notification-preferences.tsx'), 'utf8');
const alerts = readFileSync(join(root, 'screens', 'alerts-screen-v3.tsx'), 'utf8');
const canonical = readFileSync(join(root, 'services', 'canonical-alerts.ts'), 'utf8');

test('mobile FateDrop ID carries all precision alert preferences', () => {
  for (const key of ['sealedTcg','singleCards','accessories','merchandise','unknownProducts']) {
    assert.match(identity, new RegExp(key));
  }
  assert.match(identity, /sealedTcg:true/);
  assert.match(identity, /singleCards:true/);
  assert.match(identity, /accessories:false/);
  assert.match(identity, /merchandise:false/);
  assert.match(identity, /unknownProducts:true/);
});

test('Optimise Alerts exposes collector-facing product controls', () => {
  assert.match(settings, /Optimise alerts/);
  assert.match(settings, /SMART PRODUCT FILTER/);
  assert.match(settings, /Sealed TCG & decks/);
  assert.match(settings, /Single & promo cards/);
  assert.match(settings, /Accessories/);
  assert.match(settings, /Merchandise/);
  assert.match(settings, /Unknown products/);
  assert.match(settings, /MONITOR EVERYTHING · INTERRUPT SELECTIVELY/);
});

test('canonical mobile alert contract includes classification and observed duration', () => {
  assert.match(canonical, /ProductAlertCategory/);
  assert.match(canonical, /productIntelligence/);
  assert.match(canonical, /observedDurationSeconds/);
  assert.match(canonical, /productType/);
});

test('mobile cards show observed duration only for Vanished', () => {
  assert.match(alerts, /alert\.fateStage === 'VANISHED'/);
  assert.match(alerts, /alert\.observedDurationSeconds/);
  assert.match(alerts, /OBSERVED LIVE/);
  assert.match(alerts, /categoryLabel/);
});
