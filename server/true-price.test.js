const test = require('node:test');
const assert = require('node:assert/strict');
const { truePriceGroups, queryMatchScore } = require('./true-price');

function product(retailerKey, overrides = {}) {
  return {
    sku: retailerKey,
    title: 'Destined Rivals 4 Pack Bundle',
    retailerKey,
    retailer: retailerKey.toUpperCase(),
    availability: 'IN_STOCK',
    price: 60,
    shippingGbp: 5,
    isCurrentlyListed: true,
    identityKey: 'destined-rivals-4-pack',
    valueFamilyKey: 'destined-rivals-booster-packs',
    unitCount: 4,
    unitKind: 'booster_pack',
    unitRrpGbp: 4.29,
    rrpKind: 'pack_reference',
    rrpSource: 'official-pack-reference',
    ...overrides,
  };
}

test('groups exact identities and labels only known delivered totals', () => {
  const data = {
    a: product('a', { price: 50, shippingGbp: 4 }),
    b: product('b', { price: 49, shippingGbp: undefined }),
    c: {
      ...product('c', { title: 'Destined Rivals Booster Box', price: 45 }),
      identityKey: 'destined-rivals-booster-box',
      valueFamilyKey: 'destined-rivals-booster-boxes',
    },
  };
  const groups = truePriceGroups(data, 'Destined Rivals');
  const bundle = groups.find((group) => group.title.includes('4 Pack'));
  assert.equal(bundle.retailerCount, 2);
  assert.equal(bundle.offers.find((offer) => offer.retailerId === 'a').isLowestKnownDelivered, true);
  assert.equal(bundle.offers.find((offer) => offer.retailerId === 'b').isLowestKnownDelivered, false);
  assert.equal(bundle.offers.find((offer) => offer.retailerId === 'b').deliveryKnown, false);
  assert.equal(bundle.offers.find((offer) => offer.retailerId === 'b').totalDeliveredGbp, undefined);
});

test('preserves explicit canonical identity, RRP and unit evidence for the Cloud verdict engine', () => {
  const [group] = truePriceGroups({ a: product('a') }, 'Destined Rivals 4 Pack');
  assert.equal(group.identityKey, 'destined-rivals-4-pack');
  assert.equal(group.valueFamilyKey, 'destined-rivals-booster-packs');
  assert.equal(group.unitCount, 4);
  assert.equal(group.unitKind, 'booster_pack');
  assert.equal(group.unitRrpGbp, 4.29);
  assert.equal(group.rrpKind, 'pack_reference');
  assert.equal(group.rrpSource, 'official-pack-reference');
});

test('drops conflicting canonical evidence rather than guessing which retailer is right', () => {
  const groups = truePriceGroups({
    a: product('a'),
    b: product('b', { unitRrpGbp: 4.99 }),
  }, 'Destined Rivals 4 Pack');
  assert.equal(groups[0].unitRrpGbp, undefined);
  assert.equal(groups[0].valueFamilyKey, 'destined-rivals-booster-packs');
});

test('does not expose unverified or internally conflicting RRP evidence to clients', () => {
  const noSource = product('a');
  delete noSource.rrpSource;
  const [unverified] = truePriceGroups({ a: noSource }, 'Destined Rivals 4 Pack');
  assert.equal(unverified.rrpKind, undefined);
  assert.equal(unverified.unitRrpGbp, undefined);
  assert.equal(unverified.unitCount, 4);
  assert.equal(unverified.unitKind, 'booster_pack');

  const conflicting = product('b', { rrpGbp: 99 });
  const [invalid] = truePriceGroups({ b: conflicting }, 'Destined Rivals 4 Pack');
  assert.equal(invalid.rrpGbp, undefined);
  assert.equal(invalid.unitRrpGbp, undefined);
  assert.equal(invalid.rrpSource, undefined);
});

test('broad FateFind query understands common TCG aliases without weakening identity evidence', () => {
  const data = {
    a: product('a', {
      title: 'Pokémon Destined Rivals Elite Trainer Box',
      identityKey: 'destined-rivals-etb',
      valueFamilyKey: 'destined-rivals-etb',
      unitCount: 1,
      unitKind: 'elite_trainer_box',
      unitRrpGbp: 49.99,
    }),
  };
  const groups = truePriceGroups(data, 'Destined Rivals ETB');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].identityKey, 'destined-rivals-etb');
  assert.ok(groups[0].matchingConfidence >= 0.9);
});

test('broad query tolerates reordered natural terms but rejects a one-word false family', () => {
  assert.ok(queryMatchScore('Pokémon Destined Rivals Elite Trainer Box', 'Rivals Destined ETB') > 0);
  assert.equal(queryMatchScore('Journey Together Booster Box', 'Destined Rivals ETB'), 0);
});

test('canonical identity consolidates retailer title variants into one result family', () => {
  const common = {
    identityKey: 'destined-rivals-etb',
    valueFamilyKey: 'destined-rivals-etb',
    unitCount: 1,
    unitKind: 'elite_trainer_box',
    unitRrpGbp: 49.99,
  };
  const groups = truePriceGroups({
    a: product('a', { ...common, title: 'Destined Rivals Elite Trainer Box' }),
    b: product('b', { ...common, title: 'Pokémon TCG: Destined Rivals ETB' }),
  }, 'Destined Rivals ETB');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].retailerCount, 2);
});
