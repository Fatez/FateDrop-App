const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const screenPath = path.join(__dirname, '..', 'screens', 'fatematch-screen-v2.tsx');
const source = fs.readFileSync(screenPath, 'utf8');

test('successful FateMatch results render before active FateFind hunts', () => {
  const successfulResultsIndex = source.indexOf('Successful results');
  const activeFateFindsIndex = source.indexOf('Active FateFinds');

  assert.notEqual(successfulResultsIndex, -1, 'Successful results section should exist');
  assert.notEqual(activeFateFindsIndex, -1, 'Active FateFinds section should exist');
  assert.ok(
    successfulResultsIndex < activeFateFindsIndex,
    'Successful FateMatch results must be rendered before active FateFind hunts',
  );
});

test('successful FateMatch section exposes live result count and remains canonical-result driven', () => {
  assert.match(source, /FATEMATCH — LIVE NOW/);
  assert.match(source, /\{recentMatches\.length\}/);
  assert.match(source, /snapshot\?\.fateMatches/);
});
