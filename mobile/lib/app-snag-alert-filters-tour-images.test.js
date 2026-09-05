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
const profileWallpaperArt = read('mobile/components/profile-wallpaper-art.tsx');

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
  assert.match(home, /OrbitalCommandPortal/);
  assert.match(home, /Explore upcoming shows, trade nights and tournaments/);
  assert.match(home, /router\.push\('\/encounters'\)/);
  assert.doesNotMatch(home, /<Action title="True Price"/);
});

test('profile wallpaper picker uses the full high-quality supplied wallpaper library and keeps one Koru wallpaper as default', () => {
  assert.match(profileCustomisationService, /PROFILE_WALLPAPER_IDS = \[[^\]]*'koruHome'[^\]]*'fatedrop1'[^\]]*'fatedrop7'/);
  assert.doesNotMatch(profileCustomisationService, /\n\s*'koru',/);
  assert.match(profileCustomisationService, /wallpaperId: 'koruHome'/);

  assert.match(profileCustomisation, /const koruHome = require\('\.\.\/assets\/images\/home-koru-hero\.png\.png'\)/);
  assert.match(profileCustomisation, /default: koruHome/);
  assert.match(profileCustomisation, /oru: koruHome/);
  assert.match(profileCustomisation, /fenn: koruHome/);
  assert.match(profileCustomisation, /nyxen: koruHome/);
  assert.match(profileCustomisation, /koruHome: \{ name: 'Koru'/);
  assert.doesNotMatch(profileCustomisation, /\n\s*koru: require\('\.\.\/assets\/images\/home-koru-hero\.png\.png'\)/);

  for (let index = 1; index <= 7; index += 1) {
    assert.match(profileCustomisation, new RegExp(`const wallpaper${index} = require\\('\\.\\.\\/assets\\/images\\/wallpapers\\/wallpaper-${index}\\.png'\\)`));
    assert.match(profileCustomisation, new RegExp(`const wallpaper${index}Thumbnail = require\\('\\.\\.\\/assets\\/images\\/wallpaper-thumbnails\\/wallpaper-${index}\\.webp'\\)`));
    assert.match(profileCustomisation, new RegExp(`fatedrop${index}: wallpaper${index}`));
    assert.match(profileCustomisation, new RegExp(`fatedrop${index}: wallpaper${index}Thumbnail`));
  }

  assert.doesNotMatch(profileCustomisation, /profileWallpaperSources[\s\S]*alert-oru-hero-final\.webp/);
  assert.doesNotMatch(profileCustomisation, /profileWallpaperSources[\s\S]*alert-fenn-hero-final\.webp/);
  assert.doesNotMatch(profileCustomisation, /profileWallpaperSources[\s\S]*alert-koru-hero-final\.webp/);
  assert.doesNotMatch(profileCustomisation, /profileWallpaperSources[\s\S]*alert-nyxen-hero-final\.webp/);
});

test('wallpaper artwork remains centered outside Home and uses a top focal point on Home', () => {
  assert.match(profileWallpaperArt, /style=\{StyleSheet\.absoluteFill\}/);
  assert.match(profileWallpaperArt, /contentPosition=\{home \? 'top center' : 'center'\}/);
  assert.doesNotMatch(profileWallpaperArt, /profileWallpaperTransforms|translateX|translateY|scale: 1\.1/);
});

test('selected profile wallpaper also drives the active Home hero', () => {
  assert.match(home, /loadProfileCustomisation\(identity\)/);
  assert.match(home, /setHomeWallpaperId\(customisation\.wallpaperId\)/);
  assert.match(home, /<ProfileWallpaperArt wallpaperId=\{homeWallpaperId\} home \/>/);
  assert.doesNotMatch(home, /source=\{require\('\.\.\/assets\/images\/home-koru-hero\.webp'\)\}/);
});

test('Stories intro keeps the label but removes the redundant non-transparent wordmark', () => {
  assert.match(stories, /FATEDROP STORIES/);
  assert.match(stories, /How FateDrop works\./);
  assert.doesNotMatch(stories, /fatedrop-wordmark\.png/);
  assert.doesNotMatch(stories, /introWordmark/);
});
