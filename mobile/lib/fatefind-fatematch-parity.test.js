const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const fateFind = readFileSync(join(root, 'screens', 'fatefind-screen-v2.tsx'), 'utf8');
const fateMatch = readFileSync(join(root, 'screens', 'fatematch-screen-v1.tsx'), 'utf8');
const search = readFileSync(join(root, 'screens', 'search-screen-v2.tsx'), 'utf8');
const more = readFileSync(join(root, 'screens', 'more-screen-v2.tsx'), 'utf8');
const liveClient = readFileSync(join(root, 'services', 'fatefind-live.ts'), 'utf8');
const identity = readFileSync(join(root, 'services', 'fatedrop-id.ts'), 'utf8');

test('FateFind is the live best-value finder and consumes the shared Cloud contract', () => {
  assert.match(liveClient, /\/api\/fatefind\?q=/);
  assert.match(fateFind, /Find the best value available now/);
  assert.match(fateFind, /fetchLiveFateFind/);
  assert.match(fateFind, /BEST VALUE NOW/);
  assert.doesNotMatch(fateFind, /saveRemoteFateFind/);
});

test('FateMatch owns stock monitoring and companion assignment', () => {
  assert.match(fateMatch, /Let your companion watch it/);
  assert.match(fateMatch, /let me know when this is in stock/i);
  assert.match(fateMatch, /saveRemoteFateMatch/);
  assert.match(fateMatch, /companionId: companion/);
  assert.match(fateMatch, /FATEMATCH — LIVE NOW/);
  assert.match(identity, /saveRemoteFateMatch/);
});

test('Search and More expose FateFind and FateMatch as separate jobs', () => {
  assert.match(search, /pathname: '\/fatefind'/);
  assert.match(search, /pathname: '\/fatematch'/);
  assert.match(search, />FATEFIND</);
  assert.match(search, />WATCH STOCK</);
  assert.match(more, /title: 'FateFind'/);
  assert.match(more, /title: 'FateMatch'/);
  assert.match(more, /strongest-value live buying option now/);
  assert.match(more, /watch for stock and alert you/);
});
