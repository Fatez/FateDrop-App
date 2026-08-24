const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const sharedBarrel = read('components/fatedrop-ui.tsx');
const sharedLegacy = read('components/fatedrop-ui-legacy.tsx');
const brandHeader = read('components/fatedrop-brand-header.tsx');
const home = read('screens/home-screen-v2.tsx');
const profile = read('screens/profile-screen-v2.tsx');
const tabs = read('app/(tabs)/_layout.tsx');

test('final cosmic artwork is the shared FateDrop app background', () => {
  assert.match(sharedLegacy, /app-background-cosmic\.webp/);
  assert.doesNotMatch(sharedLegacy, /fatedrop-portal-hero\.png/);
});

test('shared app header is wordmark-only with no legacy emblem box', () => {
  assert.match(sharedBarrel, /FateDropBrandHeader as FateDropHeader/);
  assert.match(brandHeader, /fatedrop-wordmark\.png/);
  assert.doesNotMatch(brandHeader, /fatedrop-emblem\.webp/);
  assert.doesNotMatch(brandHeader, /headerLogoShell/);
});

test('Home uses the final Koru hero and canonical FateDrop ID identity greeting', () => {
  assert.match(home, /home-koru-hero\.webp/);
  assert.match(home, /snapshot\?\.user\.displayName\?\.trim\(\)/);
  assert.match(home, /snapshot\?\.user\.handle\?\.trim\(\)/);
  assert.match(home, /Welcome, \$\{identityName\}/);
  assert.match(home, /fatedrop-wordmark\.png/);
});

test('Home keeps monitor health out of the welcome experience', () => {
  assert.doesNotMatch(home, /MONITORS HEALTHY/);
  assert.doesNotMatch(home, /NETWORK HEALTH/);
  assert.doesNotMatch(home, /label="NETWORK"/);
  assert.doesNotMatch(home, /\/api\/status/);
});

test('center tool launcher uses the clean transparent FateDrop PNG emblem', () => {
  assert.match(tabs, /fatedrop-center-emblem\.png/);
  const launcher = tabs.slice(tabs.indexOf('name="tools"'), tabs.indexOf('name="network"'));
  assert.doesNotMatch(launcher, /fatedrop-emblem\.webp/);
  assert.doesNotMatch(launcher, /emblemHalo/);
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

test('final Home art assets are real production images, not tiny placeholders', () => {
  const hero = fs.statSync(path.join(root, 'assets/images/home-koru-hero.webp'));
  const wordmark = fs.statSync(path.join(root, 'assets/images/fatedrop-wordmark.png'));

  assert.ok(hero.size > 10000, `Koru hero unexpectedly small: ${hero.size} bytes`);
  assert.ok(wordmark.size > 10000, `FateDrop wordmark unexpectedly small: ${wordmark.size} bytes`);
});
