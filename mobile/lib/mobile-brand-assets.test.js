const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const sharedBarrel = read('components/fatedrop-ui.tsx');
const sharedLegacy = read('components/fatedrop-ui-legacy.tsx');
const brandHeader = read('components/fatedrop-brand-header.tsx');
const navEmblem = read('components/fatedrop-nav-emblem.tsx');
const home = read('screens/home-screen-v3.tsx');
const profile = read('screens/profile-screen-v2.tsx');
const alerts = read('screens/alerts-screen-v4.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const profileCustomisation = read('constants/profile-customisation.ts');
const profileCustomisationService = read('services/profile-customisation.ts');
const wordmarkData = read('constants/brand-wordmark-data.ts');
const emblemData = read('constants/brand-emblem-data.ts');
const appConfig = JSON.parse(read('app.json'));
const easConfig = JSON.parse(read('eas.json'));

test('final cosmic artwork is the shared FateDrop app background', () => {
  assert.match(sharedLegacy, /app-background-cosmic\.webp/);
  assert.doesNotMatch(sharedLegacy, /fatedrop-portal-hero\.png/);
});

test('shared functional header is title-first and does not repeat the full wordmark', () => {
  assert.match(sharedBarrel, /FateDropBrandHeader as FateDropHeader/);
  assert.match(brandHeader, /Text style=\{styles\.title\}/);
  assert.doesNotMatch(brandHeader, /fatedrop-wordmark/);
  assert.doesNotMatch(brandHeader, /FATEDROP_WORDMARK_URI/);
});

test('Profile retains the full wordmark while the compact Orbital Home does not repeat it', () => {
  assert.doesNotMatch(home, /FATEDROP_WORDMARK_URI/);
  assert.match(profile, /FATEDROP_WORDMARK_URI/);
  assert.doesNotMatch(alerts, /fatedrop-wordmark/);
  assert.doesNotMatch(alerts, /styles\.pageTitle/);
  assert.doesNotMatch(alerts, />Alerts<\/Text>/);
  assert.match(wordmarkData, /data:image\/webp;base64,/);
  assert.ok(wordmarkData.length > 10000, `FateDrop wordmark data unexpectedly small: ${wordmarkData.length} chars`);
});

test('active Home keeps one Koru wallpaper as the approved default hero while allowing the selected wallpaper', () => {
  assert.match(home, /ProfileWallpaperArt wallpaperId=\{homeWallpaperId\}/);
  assert.match(home, /useState<ProfileWallpaperId>\('koruHome'\)/);
  assert.match(profileCustomisationService, /wallpaperId: 'koruHome'/);
  assert.doesNotMatch(profileCustomisationService, /\n\s*'koru',/);
  assert.match(profileCustomisation, /koruHome: require\('\.\.\/assets\/images\/home-koru-hero\.png\.png'\)/);
  assert.match(profileCustomisation, /koruHome: \{ name: 'Koru'/);
  assert.doesNotMatch(profileCustomisation, /\n\s*koru: require\('\.\.\/assets\/images\/home-koru-hero\.png\.png'\)/);
  assert.match(home, /fetchNetworkPulse\(7\)/);
  assert.match(home, /HomePersonalBriefing[\s\S]*?embedded/);
  assert.match(home, /heroBriefing/);
});

test('Home keeps monitor health out of the welcome experience', () => {
  assert.doesNotMatch(home, /MONITORS HEALTHY/);
  assert.doesNotMatch(home, /NETWORK HEALTH/);
  assert.doesNotMatch(home, /label="NETWORK"/);
  assert.doesNotMatch(home, /\/api\/status/);
});

test('center tool launcher uses the canonical shared FateDrop medallion at the approved Tesco dock size', () => {
  assert.match(tabs, /FateDropNavEmblem size=\{48\}/);
  assert.match(tabs, /width: 74, height: 68, marginTop: -18/);
  assert.match(navEmblem, /FATEDROP_CENTER_EMBLEM_URI/);
  assert.match(navEmblem, /styles\.innerAccent/);
  assert.match(navEmblem, /shadowColor: '#D8C17A'/);
  assert.match(emblemData, /data:image\/webp;base64,/);
  assert.ok(emblemData.length > 4000, `FateDrop emblem data unexpectedly small: ${emblemData.length} chars`);
  assert.doesNotMatch(navEmblem, /styles\.ring|styles\.diamond|styles\.vertical|styles\.horizontal/);
});

test('native platform branding uses the final FateDrop home-screen icon path', () => {
  assert.equal(appConfig.expo.icon, './assets/images/fatedrop-app-icon-final.png');
  assert.equal(appConfig.expo.ios?.icon, './assets/images/fatedrop-app-icon-final.png');
  assert.equal(fs.existsSync(path.join(root, 'assets/images/fatedrop-app-icon-final.png')), true);
  assert.equal(appConfig.expo.android.adaptiveIcon.backgroundImage, './assets/images/android-icon-background.png');
  assert.equal(appConfig.expo.android.adaptiveIcon.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(appConfig.expo.android.adaptiveIcon.monochromeImage, './assets/images/android-icon-monochrome.png');

  const notifications = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications');
  const splash = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');

  assert.equal(notifications?.[1]?.icon, './assets/images/android-icon-monochrome.png', 'notifications must use the canonical monochrome Android icon');
  assert.equal(splash?.[1]?.image, undefined, 'splash must not reference the corrupt legacy image');
  assert.equal(fs.existsSync(path.join(root, 'assets/images/icon.png')), false);
  assert.equal(fs.existsSync(path.join(root, 'assets/images/fatedrop-logo.png')), false);
  assert.equal(fs.existsSync(path.join(root, 'assets/images/splash-icon.png')), false);
});

test('EAS refuses dirty source so native branding is built from committed config', () => {
  assert.equal(easConfig.cli?.requireCommit, true);
});

test('all primary bottom navigation icons and labels use one FateDrop gold', () => {
  assert.match(tabs, /const NAV_GOLD = FateDropColors\.goldBright/);
  assert.match(tabs, /tabBarActiveTintColor: NAV_GOLD/);
  assert.match(tabs, /tabBarInactiveTintColor: NAV_GOLD/);
});

test('legacy Male Female Droid Companion Lab is fully retired from the app', () => {
  assert.equal(fs.existsSync(path.join(root, 'app/companion.tsx')), false);
  assert.equal(fs.existsSync(path.join(root, 'components/companion-stage.tsx')), false);
  assert.doesNotMatch(profile, /COMPANION LAB/);
  assert.doesNotMatch(profile, /router\.push\('\/companion'\)/);
  assert.doesNotMatch(profile, /\bMale\b|\bFemale\b|\bDroid\b/);
});

function walkTsx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

test('every rendered mobile page keeps the shared FateDrop background', () => {
  const files = [
    ...walkTsx(path.join(root, 'screens')),
    ...walkTsx(path.join(root, 'app')),
  ];

  const missing = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('SafeAreaView')) continue;
    if (!source.includes('FateDropBackground') && !source.includes('ScreenBackground')) {
      missing.push(path.relative(root, file));
    }
  }

  assert.deepEqual(missing, [], `Pages missing FateDropBackground:\n${missing.join('\n')}`);
});

test('final Home hero remains the high-quality production artwork, not a compressed placeholder', () => {
  const hero = fs.statSync(path.join(root, 'assets/images/home-koru-hero.png.png'));
  assert.ok(hero.size > 500000, `Koru hero unexpectedly small: ${hero.size} bytes`);
});
