const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services', 'fate-trader.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'screens', 'fate-trader-screen.tsx'), 'utf8');

test('mobile Fate Trader consumes the authenticated Finder gateway', () => {
  assert.match(service, /export function fetchTraderFinder\(limit = 50\)/);
  assert.match(service, /finder\?limit=\$\{safeLimit\}/);
  assert.match(screen, /fetchTraderFinder\(50\)/);
  assert.doesNotMatch(screen, /live matching route is not exposed yet/i);
});

test('Trade Network publication remains explicit and private by default', () => {
  assert.match(screen, /const \[shareToNetwork, setShareToNetwork\] = useState\(false\);/);
  assert.match(screen, /visibility: shareToNetwork \? 'network' : 'private'/);
  assert.match(screen, /Share to Trade Network/);
  assert.match(screen, /Network sharing is optional and off by default/);
});

test('Finder UI does not consume collector identity or private-note fields', () => {
  assert.doesNotMatch(service, /candidateUserId/);
  assert.doesNotMatch(service, /certificationNumber/);
  const finderCardStart = screen.indexOf('function FinderOpportunityCard');
  const noticeStart = screen.indexOf('function Notice', finderCardStart);
  const finderCard = screen.slice(finderCardStart, noticeStart);
  assert.doesNotMatch(finderCard, /userId|notes|certification/i);
});
