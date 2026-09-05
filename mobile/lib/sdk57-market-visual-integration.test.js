const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const home = read('screens/home-screen-v3.tsx');
const market = read('screens/fate-market-screen.tsx');
const wallpaperArt = read('components/profile-wallpaper-art.tsx');

test('Home uses one selected wallpaper as the continuous orbital theme', () => {
  assert.match(home, /homeWallpaperId === 'koruHome'/);
  assert.match(home, /ProfileWallpaperArt wallpaperId=\{homeWallpaperId\} home/);
  assert.match(home, /profileWallpaperMeta\[homeWallpaperId\]\.accent/);
  assert.match(wallpaperArt, /contentPosition=\{home \? 'top center' : 'center'\}/);
  assert.match(home, /styles\.lowerAtmosphere/);
  assert.doesNotMatch(home, /ArtworkEdgeBlend/);
});

test('Home previews the approved Pulse and Collections snapshots without inventing figures', () => {
  assert.match(home, /params: \{ area: 'pulse' \}/);
  assert.match(home, /params: \{ area: 'collectors' \}/);
  assert.match(home, /FatePulse/);
  assert.match(home, /FATE COLLECTIONS/);
  assert.match(home, /period\.status !== 'available'/);
  assert.match(home, /period\.condition === 'insufficient_evidence'/);
  assert.match(home, /collection\.pricedUnits > 0/);
  assert.doesNotMatch(home, /area="trader"/);
});

test('FatePulse and Collectors fail visibly closed while evidence gates are incomplete', () => {
  assert.match(market, /'HISTORY BUILDING'/);
  assert.match(market, /'PRIVATE PREVIEW'/);
  assert.match(market, /MarketMetric label="MARKET HEAT" value="—"/);
  assert.match(market, /KNOWN COLLECTION VALUE/);
  assert.match(market, /collection\.pricedUnits === 0\) return '—'/);
  assert.match(market, /Price coverage/);
  assert.match(market, /Missing evidence stays unknown/);
  assert.doesNotMatch(market, /useMemo\([^)]*(?:heat|volatility|value)/i);
});

test('FatePrice has a dedicated page while Cloud remains the calculation authority', () => {
  const truePrice = read('app/true-price.tsx');
  const fatePrice = read('screens/fate-price-screen.tsx');
  assert.match(truePrice, /pathname: '\/fate-price'/);
  assert.match(fatePrice, /fetchFatePrice/);
  assert.match(fatePrice, /lowest listing is shown only as context/i);
  assert.doesNotMatch(fatePrice, /function\s+(?:calculate|score).*(?:price|value|heat)/i);
  assert.doesNotMatch(market, /function\s+(?:calculate|score).*(?:price|value|heat)/i);
});
