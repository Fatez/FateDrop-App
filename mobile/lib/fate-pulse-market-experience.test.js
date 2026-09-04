const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const screen = read('screens/fate-market-screen-v2.tsx');
const service = read('services/fate-market.ts');

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
  assert.match(screen, /label="DECLINES"/);
});

test('unavailable derived intelligence remains explicitly unscored', () => {
  assert.match(screen, /label="MARKET HEAT"/);
  assert.match(screen, /label="VOLATILITY"/);
  assert.match(screen, />NOT SCORED</);
  assert.doesNotMatch(screen, /Math\.random|mock|demo/i);
});
