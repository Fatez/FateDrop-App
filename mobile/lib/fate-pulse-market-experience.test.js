const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const screen = read('screens/fate-market-screen-v2.tsx');
const service = read('services/fate-market.ts');
const marketTheme = path.join(root, 'assets/images/fate-market-orbital-theme.webp');

test('FatePulse direction is Cloud-owned and describes qualifying tracked set baskets', () => {
  assert.match(service, /schemaVersion: 'market-pulse-direction:1'/);
  assert.match(service, /method: 'median_qualifying_set_basket_return'/);
  assert.match(screen, /TRACKED SET DIRECTION/);
  assert.match(screen, /median return of qualifying set baskets/);
  assert.match(screen, /tracked sets qualify/);
});

test('FatePulse supports evidence-backed period and mover exploration', () => {
  assert.match(screen, /\{ key: 'd1', label: '1D' \}/);
  assert.match(screen, /\{ key: 'd7', label: '7D' \}/);
  assert.match(screen, /\{ key: 'd30', label: '30D' \}/);
  assert.match(screen, /label="SETS"/);
  assert.match(screen, /label="CARDS"/);
  assert.match(screen, /label="RISERS"/);
  assert.match(screen, /label="FALLERS"/);
  assert.match(screen, /const TOP_MOVER_LIMIT = 3/);
  assert.match(screen, /useState<RankingScope>\('cards'\)/);
  assert.match(screen, /GLOBAL CARD MOVERS/);
  assert.match(screen, /Top three across eligible exact cards/);
  assert.match(screen, /risers\.slice\(0, TOP_MOVER_LIMIT\)/);
  assert.match(screen, /decliners\.slice\(0, TOP_MOVER_LIMIT\)/);
  assert.match(screen, /SELECTED EVIDENCE/);
  assert.match(screen, /READ EXACT FATEPRICE/);
  assert.match(screen, /cardId: item\.cardIdentityId/);
});

test('FatePrice and Collectors are explicitly interlinked without routing through FateFind', () => {
  assert.match(screen, /OPEN FATEPRICE/);
  assert.match(screen, /Find missing cards from .* in FatePrice/);
  assert.match(screen, /pathname: '\/fate-price'/);
  assert.doesNotMatch(screen, /CHOOSE AN EXACT CARD IN FATEFIND/);
});

test('Fate Market uses one decode-light orbital theme and selectable TCG scope', () => {
  assert.equal(fs.existsSync(marketTheme), true);
  assert.ok(fs.statSync(marketTheme).size < 200_000, 'market theme must remain decode-friendly');
  assert.match(screen, /fate-market-orbital-theme\.webp/);
  assert.match(screen, /fetchFatePulse\(tcgCode, \{ force \}\)/);
  assert.match(screen, /loadedPulseScope === selectedScope/);
});

test('unavailable derived intelligence remains explicitly unscored', () => {
  assert.match(screen, /label="MARKET HEAT"/);
  assert.match(screen, /label="VOLATILITY"/);
  assert.match(screen, />NOT SCORED</);
  assert.doesNotMatch(screen, /Math\.random|mock|demo/i);
});
