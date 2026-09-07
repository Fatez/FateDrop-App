const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobile = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(mobile, relative), 'utf8');

const policy = read('lib/canonical-thumbnails.ts');
const component = read('components/canonical-thumbnail.tsx');
const overview = read('screens/fate-pulse-overview-screen.tsx');
const pulse = read('screens/fate-pulse-screen.tsx');
const binders = read('screens/fate-binders-screen.tsx');
const collection = read('screens/fate-collection-browser-screen.tsx');
const graded = read('screens/fate-graded-collection-screen.tsx');

test('thumbnail pilot stays bounded to exact reviewed canonical set identities', () => {
  const ids = [
    'fdset_20b6a6dcfa52bbe0cc54b919',
    'fdset_15b58d7fe24f94690c51184b',
    'fdset_067d68020460e775d43ff0cb',
    'fdset_373e293fbb2882e43122afde',
  ];
  for (const id of ids) assert.match(policy, new RegExp(id));
  assert.match(policy, /1,024 live TCGdex card-source/);
  assert.match(policy, /1,024\/1,024 matched, 0 mismatches/);
  assert.match(policy, /padStart\(resolved\.set\.numericLocalIdWidth, '0'\)/);
});

test('shared thumbnail component is remote-only, contain-fit and fail-safe', () => {
  assert.match(component, /source=\{\{ uri: canonicalUrl! \}\}/);
  assert.match(component, /contentFit="contain"/);
  assert.match(component, /cachePolicy="memory-disk"/);
  assert.match(component, /onError=\{\(\) => setFailedUrl/);
  assert.doesNotMatch(component, /require\(/);
});

test('simple FatePulse Overview shows canonical card and set thumbnails', () => {
  assert.match(overview, /CanonicalThumbnail kind="card" setId=\{item\.setCode\} collectorNumber=\{item\.collectorNumber\}/);
  assert.match(overview, /CanonicalThumbnail kind="set" setId=\{item\.setCode\} width=\{44\}/);
});

test('routed FatePulse depth keeps canonical thumbnails for set and card rankings', () => {
  assert.match(pulse, /CanonicalThumbnail kind="set" setId=\{item\.setCode\} width=\{28\}/);
  assert.match(pulse, /CanonicalThumbnail kind="set" setId=\{item\.setCode\} width=\{38\}/);
  assert.match(pulse, /CanonicalThumbnail kind="card" setId=\{item\.setCode\} collectorNumber=\{item\.collectorNumber\}/);
});

test('Binders show canonical set art and missing-card thumbnails', () => {
  assert.match(binders, /CanonicalThumbnail kind="set" setId=\{closest\.setId\} width=\{104\}/);
  assert.match(binders, /CanonicalThumbnail kind="card" setId=\{card\.setId\} collectorNumber=\{card\.collectorNumber\}/);
});

test('Personal Collection and Graded use the same canonical thumbnail boundary', () => {
  assert.ok((collection.match(/CanonicalThumbnail kind="card"/g) || []).length >= 2);
  assert.match(collection, /CanonicalThumbnail kind="set" setId=\{set\.setId\}/);
  assert.match(graded, /CanonicalThumbnail kind="card" setId=\{card\?\.setId\} collectorNumber=\{card\?\.collectorNumber\}/);
});
