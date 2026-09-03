const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const home = read('screens/home-screen-v3.tsx');
const market = read('screens/fate-market-screen.tsx');
const blend = read('components/artwork-edge-blend.tsx');

test('Home blends the selected wallpaper into the shell without another image allocation', () => {
  assert.match(home, /ProfileWallpaperArt wallpaperId=\{homeWallpaperId\}/);
  assert.match(home, /ArtworkEdgeBlend accentColor=\{wallpaperAccent\}/);
  assert.match(home, /profileWallpaperMeta\[homeWallpaperId\]\.accent/);
  assert.doesNotMatch(blend, /Image|BlurView|LinearGradient/);
  assert.match(blend, /lightweight colour bands/);
});

test('Home previews exactly the three Fate Market areas without inventing figures', () => {
  assert.match(home, /area="trader"/);
  assert.match(home, /area="pulse"/);
  assert.match(home, /area="collectors"/);
  assert.match(home, /Fate Trader/);
  assert.match(home, /FatePulse/);
  assert.match(home, /Fate Collectors/);
});

test('FatePulse and Collectors fail visibly closed while evidence gates are incomplete', () => {
  assert.match(market, /status="HISTORY BUILDING"/);
  assert.match(market, /status="PRIVATE PREVIEW"/);
  assert.match(market, /MarketMetric label="MARKET HEAT" value="—"/);
  assert.match(market, /KNOWN COLLECTION VALUE/);
  assert.match(market, /Price coverage —/);
  assert.match(market, /Missing evidence stays unknown/);
  assert.doesNotMatch(market, /useMemo\([^)]*(?:heat|volatility|value)/i);
});

test('True Price remains owned by FateFind rather than becoming a fourth market engine', () => {
  const truePrice = read('app/true-price.tsx');
  assert.match(truePrice, /pathname: '\/fatefind'/);
  assert.doesNotMatch(market, /function\s+(?:calculate|score).*(?:price|value|heat)/i);
});
