const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (path) => fs.readFileSync(path, 'utf8');
const alerts = read('mobile/screens/alerts-screen-v4.tsx');
const onboarding = read('mobile/app/onboarding.tsx');
const home = read('mobile/screens/home-screen-v3.tsx');
const profileCustomisation = read('mobile/constants/profile-customisation.ts');
const profileCustomisationService = read('mobile/services/profile-customisation.ts');

test('lifecycle market controls live between stage tabs and companion watch heading', () => {
  assert.match(alerts, /stagePreferenceKey:[\s\S]*WHISPER: 'whisper'[\s\S]*ECHO: 'echo'[\s\S]*MANIFESTED: 'manifested'[\s\S]*VANISHED: 'vanished'/);
  assert.match(alerts, /nextLifecycleMarketSelection\(marketSelection, option\)/);
  assert.match(alerts, /updateRemoteNotificationPreferences\(\{ lifecycleMarkets: \{ \[activePreferenceStage\]: nextSelection \} \}\)/);
  assert.match(alerts, /<View style=\{styles\.tabs\}>[\s\S]*<LifecycleMarketFilter[\s\S]*IS WATCHING/);
  assert.match(alerts, /CARD MARKET · \{label\.toUpperCase\(\)\}/);
});

test('app guide uses the approved welcome and Local Radar artwork', () => {
  assert.match(onboarding, /WELCOME TO FATEDROP[\s\S]*app-guide-welcome\.png/);
  assert.match(onboarding, /LOCAL RADAR[\s\S]*app-guide-local-radar\.png/);
  assert.doesNotMatch(onboarding, /WELCOME TO FATEDROP[\s\S]{0,500}FDAlerts\.png/);
});

test('active Home promotes Fate Encounters with the supplied event artwork', () => {
  assert.match(home, /event-signup\.png\.png/);
  assert.match(home, /FATE ENCOUNTERS/);
  assert.match(home, /Find your next encounter\./);
  assert.match(home, /router\.push\('\/encounters'\)/);
  assert.doesNotMatch(home, /<Action title="True Price"/);
});

test('profile wallpaper picker includes the supplied FateDrop wallpaper', () => {
  assert.match(profileCustomisationService, /PROFILE_WALLPAPER_IDS = \[[^\]]*'fatedrop1'/);
  assert.match(profileCustomisation, /fatedrop1: require\('\.\.\/assets\/images\/fatedrop-app-wallpaper1\.png'\)/);
  assert.match(profileCustomisation, /fatedrop1: \{ name: 'FateDrop'/);
});
