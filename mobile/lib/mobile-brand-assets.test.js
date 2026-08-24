const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const shared = read('components/fatedrop-ui.tsx');
const home = read('screens/home-screen-v2.tsx');
const tabs = read('app/(tabs)/_layout.tsx');

test('final cosmic artwork is the shared FateDrop app background', () => {
  assert.match(shared, /app-background-cosmic\.webp/);
  assert.doesNotMatch(shared, /fatedrop-portal-hero\.png/);
});

test('shared brand header uses the supplied FateDrop wordmark and emblem', () => {
  assert.match(shared, /fatedrop-wordmark\.webp/);
  assert.match(shared, /fatedrop-emblem\.webp/);
  assert.doesNotMatch(shared, /brandTextAccent/);
});

test('Home uses the final Koru hero and greets the FateDrop ID display name', () => {
  assert.match(home, /home-koru-hero\.webp/);
  assert.match(home, /snapshot\?\.user\.displayName\?\.trim\(\)/);
  assert.match(home, /Welcome, \$\{displayName\}/);
  assert.match(home, /fatedrop-wordmark\.webp/);
});

test('center tool launcher uses the final compact FateDrop emblem', () => {
  assert.match(tabs, /fatedrop-emblem\.webp/);
  assert.doesNotMatch(tabs, /fatedrop-center-emblem\.png/);
});


function walkTsx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

test('every rendered mobile page keeps the shared FateDrop background', () => {
  const files = [
    ...walkTsx(path.join(root, 'screens')),
    ...walkTsx(path.join(root, 'app')),
  ];

  const missing = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('SafeAreaView')) continue;
    if (!source.includes('FateDropBackground') && !source.includes('ScreenBackground')) {
      missing.push(path.relative(root, file));
    }
  }

  assert.deepEqual(missing, [], `Pages missing FateDropBackground:\n${missing.join('\n')}`);
});
