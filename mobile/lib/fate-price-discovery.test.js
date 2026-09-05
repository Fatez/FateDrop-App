import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFatePriceDiscovery, fatePriceVariantLabel } from './fate-price-discovery.js';

function card(overrides = {}) {
  return {
    id: 'identity-standard-en',
    fateCardId: 'identity-standard-en',
    tcgCode: 'pokemon',
    seriesId: 'series-sv',
    seriesName: 'Scarlet & Violet',
    setId: 'set-151',
    setName: '151',
    printingId: 'printing-charizard-006',
    name: 'Charizard ex',
    collectorNumber: '006',
    rarity: 'Double Rare',
    supertype: 'Pokémon',
    variantCode: 'standard',
    languageCode: 'en',
    verificationStatus: 'verified',
    verifiedAt: 1,
    ...overrides,
  };
}

const cards = [
  card(),
  card({ id: 'identity-holo-en', fateCardId: 'identity-holo-en', variantCode: 'holo' }),
  card({ id: 'identity-standard-jp', fateCardId: 'identity-standard-jp', languageCode: 'ja' }),
  card({ id: 'identity-blastoise', fateCardId: 'identity-blastoise', printingId: 'printing-blastoise-009', name: 'Blastoise ex', collectorNumber: '009' }),
  card({ id: 'identity-charizard-obsidian', fateCardId: 'identity-charizard-obsidian', setId: 'set-obf', setName: 'Obsidian Flames', printingId: 'printing-charizard-125', collectorNumber: '125' }),
  card({ id: 'identity-one-piece', fateCardId: 'identity-one-piece', tcgCode: 'one-piece', seriesId: 'series-op', seriesName: 'One Piece', setId: 'set-op01', setName: 'Romance Dawn', printingId: 'printing-luffy', name: 'Monkey.D.Luffy', collectorNumber: '001' }),
  card({ id: 'held-card', verificationStatus: 'held' }),
];

test('discovery starts with verified games only and reveals later steps progressively', () => {
  const root = buildFatePriceDiscovery(cards);
  assert.equal(root.exactIdentityCount, 6);
  assert.deepEqual(root.games.map((item) => item.code), ['one-piece', 'pokemon']);
  assert.deepEqual(root.sets, []);
  assert.deepEqual(root.cards, []);
  assert.deepEqual(root.variants, []);

  const pokemon = buildFatePriceDiscovery(cards, { tcgCode: 'pokemon' });
  assert.deepEqual(pokemon.sets.map((item) => item.id), ['set-151', 'set-obf']);
  assert.deepEqual(pokemon.cards, []);
});

test('card step groups exact identities by printing, never by fateCardId', () => {
  const model = buildFatePriceDiscovery(cards, { tcgCode: 'pokemon', setId: 'set-151' });
  assert.equal(model.cards.length, 2);
  const charizard = model.cards.find((item) => item.printingId === 'printing-charizard-006');
  assert.ok(charizard);
  assert.equal(charizard.identityCount, 3);
  assert.deepEqual(charizard.variantCodes, ['holo', 'standard']);
  assert.deepEqual(charizard.languageCodes, ['en', 'ja']);
});

test('variant step preserves every exact canonical identity', () => {
  const model = buildFatePriceDiscovery(cards, {
    tcgCode: 'pokemon',
    setId: 'set-151',
    printingId: 'printing-charizard-006',
  });
  assert.deepEqual(model.variants.map((item) => item.id), [
    'identity-holo-en',
    'identity-standard-en',
    'identity-standard-jp',
  ]);
  assert.equal(fatePriceVariantLabel(model.variants[0]), 'holo · EN · Double Rare');
});
