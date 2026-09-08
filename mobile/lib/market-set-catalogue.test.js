const test = require('node:test');
const assert = require('node:assert/strict');
const { exactMarketCatalogueSet } = require('./fate-price-discovery');
const set = { id:'canonical-151',code:'sv03.5',tcgCode:'pokemon',name:'151',verificationStatus:'verified' };
test('market set code resolves to the catalogue ID only within the same game', () => {
  assert.equal(exactMarketCatalogueSet([set], 'pokemon', 'sv03.5'), set);
  assert.equal(exactMarketCatalogueSet([set], 'one-piece', 'sv03.5'), null);
});
test('same names, missing codes and unverified sets never substitute for exact identity', () => {
  assert.equal(exactMarketCatalogueSet([set], 'pokemon', '151'), null);
  assert.equal(exactMarketCatalogueSet([{...set,code:null}], 'pokemon', 'sv03.5'), null);
  assert.equal(exactMarketCatalogueSet([{...set,verificationStatus:'held'}], 'pokemon', 'sv03.5'), null);
});
test('ambiguous catalogue codes fail closed', () => {
  assert.equal(exactMarketCatalogueSet([set,{...set,id:'another-set'}], 'pokemon', 'sv03.5'), null);
});
