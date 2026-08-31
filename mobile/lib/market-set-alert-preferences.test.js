const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const identity = read('services/fatedrop-id.ts');
const facets = read('services/alert-facets.ts');
const preferences = read('app/notification-preferences.tsx');
const alerts = read('services/canonical-alerts.ts');
const alertScreen = read('screens/alerts-screen-v4.tsx');

test('App shares the complete Web product, language and set preference contract', () => {
  for (const key of [
    'sealedTcg', 'singleCards', 'accessories', 'merchandise', 'unknownProducts',
    'english', 'japanese', 'korean', 'simplifiedChinese', 'traditionalChinese',
    'otherLanguages', 'unknownLanguage', 'allSets', 'selectedSetKeys', 'unknownSets',
  ]) assert.match(identity, new RegExp(`${key}:`));
  assert.match(identity, /sealedTcg:true,singleCards:true,accessories:false,merchandise:false,unknownProducts:true/);
  assert.match(identity, /allSets:true,selectedSetKeys:\[\],unknownSets:true/);
  assert.match(identity, /normalizeSelectedSetKeys/);
  assert.match(identity, /setKeyPattern/);
  assert.match(identity, /\.slice\(0,200\)/);
});

test('App consumes the versioned Cloud language, market and set registry', () => {
  assert.match(facets, /SIGNAL_ENGINE_URL\}\/api\/alert-facets/);
  assert.match(facets, /contractVersion !== 1/);
  assert.match(facets, /source !== 'FATEDROP_CLOUD'/);
  assert.match(facets, /AlertMarketGroup/);
  assert.match(facets, /FALLBACK_ALERT_MARKETS/);
  assert.match(facets, /markets:/);
  assert.match(facets, /simplified_chinese/);
  assert.match(facets, /traditional_chinese/);
  assert.doesNotMatch(facets, /FATEDROP_WEB_URL/);
});

test('App exposes collector-facing product, language and precise set controls without inventing market truth', () => {
  assert.match(preferences, /SMART PRODUCT FILTER/);
  assert.match(preferences, /COLLECTOR MARKET \/ LANGUAGE/);
  assert.match(preferences, /All recognised sets/);
  assert.match(preferences, /Unknown sets/);
  assert.match(preferences, /Search recognised sets/);
  assert.match(preferences, /toggleSet/);
});

test('canonical mobile alerts carry canonical market metadata additively into alert cards', () => {
  assert.match(alerts, /deliveryPolicy:/);
  assert.match(alerts, /interruptEligible:/);
  assert.match(alerts, /facets: CanonicalAlertFacets/);
  assert.match(alerts, /marketGroup\?:/);
  assert.match(alerts, /marketStatus\?:/);
  assert.match(alertScreen, /alert\.facets\?\.languageLabel/);
  assert.match(alertScreen, /alert\.facets\?\.setName/);
});
