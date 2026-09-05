const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
const identity = read('contexts/fatedrop-id-context.tsx');
const home = read('screens/home-screen-v3.tsx');
const dashboard = read('screens/dashboard-screen-v1.tsx');
const customisation = read('screens/profile-customisation-screen.tsx');
const wallpaperArt = read('components/profile-wallpaper-art.tsx');
const wallpaperConstants = read('constants/profile-customisation.ts');

test('identity refreshes are single-flight, freshness-bounded, and foreground-aware', () => {
  assert.match(identity, /IDENTITY_REFRESH_FRESHNESS_MS = 30_000/);
  assert.match(identity, /if \(refreshFlight\.current\) return refreshFlight\.current/);
  assert.match(identity, /Date\.now\(\) - lastRefreshAt\.current < IDENTITY_REFRESH_FRESHNESS_MS/);
  assert.match(identity, /AppState\.addEventListener\('change'/);
  assert.match(identity, /state === 'active'\) void refreshIfStale\(\)/);
  assert.match(home, /signedIn \? refreshIfStale\(\)/);
  assert.match(dashboard, /forceIdentity \? refresh\(\) : refreshIfStale\(\)/);
  assert.match(dashboard, /onRefresh=\{\(\) => void load\(true\)\}/);
});

test('wallpaper picker uses virtualised small WebP previews while preserving full artwork sources', () => {
  assert.match(customisation, /<FlatList/);
  assert.match(customisation, /initialNumToRender=\{6\}/);
  assert.match(customisation, /maxToRenderPerBatch=\{6\}/);
  assert.match(customisation, /windowSize=\{3\}/);
  assert.match(customisation, /<ProfileWallpaperArt wallpaperId=\{draft\.wallpaperId\} \/>/);
  assert.match(customisation, /<ProfileWallpaperArt wallpaperId=\{id\} thumbnail \/>/);
  assert.match(wallpaperArt, /profileWallpaperThumbnailSources\[wallpaperId\]/);
  assert.match(wallpaperArt, /cachePolicy="disk"/);
  assert.match(wallpaperArt, /enforceEarlyResizing/);
  assert.match(wallpaperConstants, /export const profileWallpaperSources/);

  const relativeAssets = [...wallpaperConstants.matchAll(/const (?:koruHome|wallpaper[1-7])Thumbnail = require\('([^']+\.webp)'\)/g)].map((match) => match[1]);
  assert.equal(relativeAssets.length, 8);
  for (const relativeAsset of relativeAssets) {
    const absoluteAsset = path.resolve(__dirname, '..', 'constants', relativeAsset);
    assert.ok(fs.existsSync(absoluteAsset), `missing wallpaper thumbnail: ${relativeAsset}`);
    assert.ok(fs.statSync(absoluteAsset).size < 60_000, `wallpaper thumbnail is unexpectedly large: ${relativeAsset}`);
  }
});
