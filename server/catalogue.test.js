const test = require('node:test');
const assert = require('node:assert/strict');
const { categoryOf, queryCatalogue } = require('./catalogue');

test('classifies conservative product categories', () => {
  assert.equal(categoryOf('Destined Rivals Elite Trainer Box'), 'SEALED');
  assert.equal(categoryOf('#123 Mewtwo Near Mint'), 'SINGLE');
  assert.equal(categoryOf('Charizard PSA 10'), 'GRADED');
  assert.equal(categoryOf('Premium Binder'), 'ACCESSORY');
});
test('paginates and filters catalogue without exposing full records', () => {
  const database = {
    a: { sku: 'a', title: 'Alpha Booster Box', retailerKey: 'one', availability: 'IN_STOCK', isCurrentlyListed: true, firstSeen: 'secret' },
    b: { sku: 'b', title: 'Beta Binder', retailerKey: 'two', availability: 'OUT_OF_STOCK', isCurrentlyListed: true },
  };
  const result = queryCatalogue(database, { inStock: 'true', limit: '1' });
  assert.equal(result.total, 1);
  assert.equal(result.products[0].sku, 'a');
  assert.equal(result.products[0].firstSeen, undefined);
});
test('filters structured condition, set and price and sorts by price',()=>{const database={a:{sku:'a',title:'Mewtwo Near Mint',setName:'Destined Rivals',price:20,availability:'IN_STOCK'},b:{sku:'b',title:'Mewtwo Near Mint',setName:'Destined Rivals',price:10,availability:'IN_STOCK'},c:{sku:'c',title:'Mewtwo Lightly Played',setName:'Destined Rivals',price:5,availability:'IN_STOCK'}};const result=queryCatalogue(database,{condition:'NEAR_MINT',set:'rivals',minPrice:'8',maxPrice:'25',sort:'price'});assert.deepEqual(result.products.map(item=>item.sku),['b','a']);assert.equal(result.products[0].cardNumber,null);});
