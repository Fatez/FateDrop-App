const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (path) => fs.readFileSync(path, 'utf8');
const alerts = read('mobile/screens/alerts-screen-v4.tsx');
const onboarding = read('mobile/app/onboarding.tsx');
const home = read('mobile/screens/home-screen-v3.tsx');
const stories = read('mobile/app/stories.tsx');
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

test('profile wallpaper picker includes the full supplied FateDrop library and keeps Koru as default', () => {
  assert.match(profileCustomisationService, /PROFILE_WALLPAPER_IDS = \[[^\]]*'koruHome'[^\]]*'fatedrop1'[^\]]*'fatedrop2'[^\]]*'fatedrop3'[^\]]*'fatedrop4'[^\]]*'fatedrop5'[^\]]*'fatedrop6'/);
  assert.match(profileCustomisationService, /wallpaperId: 'koruHome'/);
  assert.match(profileCustomisation, /koruHome: require\('\.\.\/assets\/images\/home-koru-hero\.webp'\)/);
  assert.match(profileCustomisation, /koruHome: \{ name: 'Koru · Network'/);
  assert.match(profileCustomisation, /fatedrop1: require\('\.\.\/assets\/images\/fatedrop-app-wallpaper1\.png'\)/);
  for (let index = 2; index <= 6; index += 1) {
    assert.match(profileCustomisation, new RegExp(`fatedrop${index}: require\\('\\.\\.\\/assets\\/images\\/fdwallpaper${index}\\.png'\\)`));
  }
});

test('selected profile wallpaper also drives the active Home hero', () => {
  assert.match(home, /loadProfileCustomisation\(identity\)/);
  assert.match(home, /setHomeWallpaperId\(customisation\.wallpaperId\)/);
  assert.match(home, /<ProfileWallpaperArt wallpaperId=\{homeWallpaperId\} \/>/);
  assert.doesNotMatch(home, /source=\{require\('\.\.\/assets\/images\/home-koru-hero\.webp'\)\}/);
});

test('Stories intro keeps the label but removes the redundant non-transparent wordmark', () => {
  assert.match(stories, /FATEDROP STORIES/);
  assert.match(stories, /How FateDrop works\./);
  assert.doesNotMatch(stories, /fatedrop-wordmark\.png/);
  assert.doesNotMatch(stories, /introWordmark/);
});
