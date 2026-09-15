/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(readFileSync(require('node:path').join(__dirname, 'card-scan.ts'), 'utf8')).replaceAll('export function', 'function');
const { cardScanHints, scanCandidateMatches } = new Function(source + ';return {cardScanHints,scanCandidateMatches}')();
test('OCR hints preserve numbered prefixes and never infer a finish', () => {
  assert.deepEqual(cardScanHints('BASIC\nCharizard ex\nHP 330\n199/165'), { name: 'Charizard ex', number: '199' });
  assert.equal(cardScanHints('Pikachu\nTG05/TG30').number, 'TG05');
  assert.deepEqual(cardScanHints(''), { name: '', number: '' });
});
test('Only verified English Pokemon candidates with the requested number survive', () => {
  const card = { tcgCode: 'pokemon', languageCode: 'en', collectorNumber: '005', verificationStatus: 'verified' };
  assert.equal(scanCandidateMatches(card, '5'), true);
  assert.equal(scanCandidateMatches(card, '6'), false);
  assert.equal(scanCandidateMatches({ ...card, languageCode: 'ja' }, '5'), false);
  assert.equal(scanCandidateMatches({ ...card, tcgCode: 'one-piece' }, '5'), false);
  assert.equal(scanCandidateMatches({ ...card, verificationStatus: 'pending' }, '5'), false);
  assert.equal(scanCandidateMatches({ ...card, collectorNumber: 'TG05' }, '5'), false);
});
