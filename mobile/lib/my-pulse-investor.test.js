import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('mobile/app/fate-pulse/my-pulse.tsx', 'utf8');
const screen = fs.readFileSync('mobile/screens/my-pulse-investor-screen.tsx', 'utf8');

test('My Pulse routes to the dedicated investor dashboard', () => {
  assert.match(route, /MyPulseInvestorScreen/);
});

test('My Pulse uses exact canonical thumbnails and verified FatePrice history', () => {
  assert.match(screen, /CanonicalThumbnail/);
  assert.match(screen, /setId=\{follow\.setId\}/);
  assert.match(screen, /collectorNumber=\{follow\.collectorNumber\}/);
  assert.match(screen, /fetchFatePrice\(/);
  assert.match(screen, /fetchFatePriceHistory\(/);
  assert.match(screen, /days: 90/);
  assert.match(screen, /MoveMetric label="7D"/);
  assert.match(screen, /MoveMetric label="30D"/);
  assert.match(screen, /MoveMetric label="90D"/);
  assert.match(screen, /stored market days only/i);
  assert.doesNotMatch(screen, /interpolat(e|ed).*point/i);
});
