const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const helperPath = path.join(__dirname, 'local-radar-map.js');
const source = fs.readFileSync(helperPath, 'utf8');
const load = () => import(pathToFileURL(helperPath).href);

test('store filters consume Cloud retailerGroup and never classify by client retailer IDs or names', async () => {
  const { retailerCategory, filterShopsByCategory } = await load();
  const shops = [
    { id: 'a', name: 'Misleading supermarket name', retailerId: 'tesco-uk', retailerGroup: 'independents' },
    { id: 'b', retailerGroup: 'supermarkets' },
    { id: 'c', retailerGroup: 'large_retailers' },
    { id: 'd' },
  ];
  assert.equal(retailerCategory(shops[0]), 'independent');
  assert.deepEqual(filterShopsByCategory(shops, 'supermarket').map((shop) => shop.id), ['b']);
  assert.equal(retailerCategory(shops[3]), 'unclassified');
  assert.doesNotMatch(source, /SUPERMARKET_RETAILER_IDS|LARGE_RETAILER_IDS|NAME_RE/);
});

test('dense UK-scale datasets stay beneath the bounded native marker budget', async () => {
  const { clusterShops } = await load();
  const shops = Array.from({ length: 4373 }, (_, index) => ({
    id: `shop-${index}`,
    latitude: 50 + (index % 97) * 0.1,
    longitude: -7 + (index % 71) * 0.1,
  }));
  const points = clusterShops(shops, { latitude: 54, longitude: -2, latitudeDelta: 12, longitudeDelta: 12 }, { maxMarkers: 72 });
  assert.ok(points.length <= 72, `expected no more than 72 markers, got ${points.length}`);
  assert.equal(points.reduce((sum, point) => sum + point.count, 0), shops.length);
});

test('zoomed viewport renders individual stores only after density falls below budget', async () => {
  const { clusterShops } = await load();
  const inside = Array.from({ length: 12 }, (_, index) => ({ id: `inside-${index}`, latitude: 51.5 + index * 0.001, longitude: -0.1 }));
  const outside = Array.from({ length: 200 }, (_, index) => ({ id: `outside-${index}`, latitude: 55 + index * 0.001, longitude: -3 }));
  const points = clusterShops([...inside, ...outside], { latitude: 51.505, longitude: -0.1, latitudeDelta: 0.1, longitudeDelta: 0.1 }, { maxMarkers: 72 });
  assert.equal(points.length, inside.length);
  assert.ok(points.every((point) => point.kind === 'shop'));
});

test('server marker budgets are clamped defensively', async () => {
  const { clusterShops } = await load();
  const shops = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), latitude: 51 + (index % 50) * 0.01, longitude: -1 + (index % 50) * 0.01 }));
  const points = clusterShops(shops, { latitude: 51.25, longitude: -0.75, latitudeDelta: 1, longitudeDelta: 1 }, { maxMarkers: 10000 });
  assert.ok(points.length <= 100);
});
