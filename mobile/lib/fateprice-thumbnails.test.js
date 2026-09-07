import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'mobile/screens/fate-price-discovery-screen.tsx',
  'mobile/screens/fate-price-set-screen.tsx',
  'mobile/screens/fate-price-variants-screen.tsx',
  'mobile/screens/fate-price-screen.tsx',
  'mobile/screens/fate-price-buy-screen.tsx',
];

test('FatePrice journey uses the shared canonical thumbnail boundary', () => {
  for (const path of files) {
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /CanonicalThumbnail/);
  }
});

test('FatePrice never introduces retailer or fuzzy image matching', () => {
  const source = files.map((path) => fs.readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(source, /google images|fuzzy.*image|retailer.*imageUrl/i);
  assert.match(source, /kind=\"card\"/);
  assert.match(source, /kind=\"set\"/);
});
