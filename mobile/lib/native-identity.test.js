const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

const app = JSON.parse(readFileSync(new URL('../app.json', `file://${__dirname}/`), 'utf8'));
const eas = JSON.parse(readFileSync(new URL('../eas.json', `file://${__dirname}/`), 'utf8'));

test('FateDrop has stable native application identifiers', () => {
  assert.equal(app.expo.name, 'FateDrop');
  assert.equal(app.expo.slug, 'fatedrop');
  assert.equal(app.expo.scheme, 'fatedrop');
  assert.equal(app.expo.ios.bundleIdentifier, 'uk.co.fatedrop');
  assert.equal(app.expo.android.package, 'uk.co.fatedrop');
});

test('EAS has explicit internal beta and production build profiles', () => {
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.production.autoIncrement, true);
});
