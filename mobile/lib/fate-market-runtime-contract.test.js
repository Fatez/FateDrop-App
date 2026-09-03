const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services/fate-market.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'screens/fate-market-screen.tsx'), 'utf8');

test('Fate Market consumes Cloud-owned Pulse and owner-authenticated Collectors contracts', () => {
  assert.match(service, /SIGNAL_ENGINE_URL/);
  assert.match(service, /\/v1\/market\/pulse/);
  assert.match(service, /\/v1\/collectors\/summary\?currency=EUR&language=en&variant=standard/);
  assert.match(service, /headers\.Authorization = `Bearer \$\{token\}`/);
});

test('Collectr integration is user-export preview only and never claims a completed write', () => {
  assert.match(service, /\/v1\/collectors\/import\/collectr\/preview/);
  assert.match(service, /mode: 'preview_only'/);
  assert.match(service, /writesPerformed: false/);
  assert.match(screen, /User-export preview only/);
  assert.match(screen, /No account automation, scraping or imported price claims/);
});

test('FatePulse and collection value remain blank when Cloud evidence is unavailable', () => {
  assert.match(screen, /MARKET HEAT" value="—"/);
  assert.match(screen, /VOLATILITY" value="—"/);
  assert.match(screen, /if \(!collection \|\| collection\.pricedUnits === 0\) return '—'/);
  assert.match(screen, /calibration gates pass/);
});
