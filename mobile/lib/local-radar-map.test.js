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

test('dense UK-scale datasets stay inside a fixed 36-slot native marker pool', async () => {
  const { clusterShops } = await load();
  const shops = Array.from({ length: 4373 }, (_, index) => ({
    id: `shop-${index}`,
    latitude: 50 + (index % 97) * 0.1,
    longitude: -7 + (index % 71) * 0.1,
  }));
  const points = clusterShops(shops, { latitude: 54, longitude: -2, latitudeDelta: 12, longitudeDelta: 12 }, { maxMarkers: 72 });
  assert.equal(points.length, 36);
  assert.equal(points.reduce((sum, point) => sum + point.count, 0), shops.length);
});

test('dense zoomed view stays clustered until individual marker count is safe', async () => {
  const { clusterShops } = await load();
  const shops = Array.from({ length: 30 }, (_, index) => ({
    id: `dense-${index}`,
    latitude: 51.5 + (index % 10) * 0.001,
    longitude: -0.1 + Math.floor(index / 10) * 0.001,
  }));
  const points = clusterShops(shops, { latitude: 51.505, longitude: -0.099, latitudeDelta: 0.05, longitudeDelta: 0.05 }, { maxMarkers: 72 });
  assert.ok(points.some((point) => point.kind === 'cluster' && point.count > 1), 'expected dense viewport to remain clustered');
  assert.equal(points.length, 36);
});

test('zoomed viewport renders individual stores only after density is safe', async () => {
  const { clusterShops } = await load();
  const inside = Array.from({ length: 12 }, (_, index) => ({ id: `inside-${index}`, latitude: 51.5 + index * 0.001, longitude: -0.1 }));
  const outside = Array.from({ length: 200 }, (_, index) => ({ id: `outside-${index}`, latitude: 55 + index * 0.001, longitude: -3 }));
  const points = clusterShops([...inside, ...outside], { latitude: 51.505, longitude: -0.1, latitudeDelta: 0.1, longitudeDelta: 0.1 }, { maxMarkers: 72 });
  const activePoints = points.filter((point) => point.count > 0);
  assert.equal(points.length, 36);
  assert.equal(activePoints.length, inside.length);
  assert.ok(activePoints.every((point) => point.kind === 'shop'));
});

test('server marker budgets cannot override the iOS safety ceiling', async () => {
  const { clusterShops } = await load();
  const shops = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), latitude: 51 + (index % 50) * 0.01, longitude: -1 + (index % 50) * 0.01 }));
  const points = clusterShops(shops, { latitude: 51.25, longitude: -0.75, latitudeDelta: 1, longitudeDelta: 1 }, { maxMarkers: 10000, maxIndividualMarkers: 10000 });
  assert.equal(points.length, 36);
  assert.ok(points.some((point) => point.kind === 'cluster' && point.count > 1));
});

test('marker slot identities remain stable across cluster expansion density changes', async () => {
  const { clusterShops } = await load();
  const shops = Array.from({ length: 80 }, (_, index) => ({
    id: `stable-${index}`,
    latitude: 51.45 + (index % 20) * 0.005,
    longitude: -0.2 + Math.floor(index / 20) * 0.01,
  }));
  const wide = clusterShops(shops, { latitude: 51.5, longitude: -0.18, latitudeDelta: 0.5, longitudeDelta: 0.5 });
  const tight = clusterShops(shops, { latitude: 51.5, longitude: -0.18, latitudeDelta: 0.08, longitudeDelta: 0.08 });
  assert.deepEqual(wide.map((point) => point.id), tight.map((point) => point.id));
  assert.equal(new Set(wide.map((point) => point.id)).size, 36);
  assert.deepEqual(wide.map((point) => point.id), Array.from({ length: 36 }, (_, index) => `slot:${index}`));
});

test('cluster expansion is progressive rather than an aggressive one-tap burst', async () => {
  const { clusterZoomRegion } = await load();
  const next = clusterZoomRegion(
    { latitude: 51.5, longitude: -0.1 },
    { latitude: 52, longitude: -1, latitudeDelta: 1, longitudeDelta: 0.8 },
  );
  assert.equal(next.latitude, 51.5);
  assert.equal(next.longitude, -0.1);
  assert.equal(next.latitudeDelta, 0.6);
  assert.equal(next.longitudeDelta, 0.48);
});
