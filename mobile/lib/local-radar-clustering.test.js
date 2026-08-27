const test = require('node:test');
const assert = require('node:assert/strict');

const { clusterRadarShops, regionForRadarCluster } = require('./local-radar-clustering');

const londonShops = [
  { id: 'a', latitude: 51.5074, longitude: -0.1278 },
  { id: 'b', latitude: 51.5090, longitude: -0.1250 },
  { id: 'c', latitude: 51.5140, longitude: -0.1180 },
];

test('Local Radar clusters dense nearby pins while zoomed out', () => {
  const clusters = clusterRadarShops(londonShops, {
    latitude: 51.51,
    longitude: -0.12,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8,
  });
  assert.ok(clusters.length < londonShops.length);
  assert.equal(clusters.reduce((sum, cluster) => sum + cluster.shops.length, 0), londonShops.length);
});

test('Local Radar restores exact store pins once sufficiently zoomed in', () => {
  const clusters = clusterRadarShops(londonShops, {
    latitude: 51.51,
    longitude: -0.12,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  });
  assert.equal(clusters.length, londonShops.length);
  assert.ok(clusters.every((cluster) => cluster.shops.length === 1));
});

test('tapping a cluster produces a tighter region without changing store data', () => {
  const [cluster] = clusterRadarShops(londonShops, {
    latitude: 51.51,
    longitude: -0.12,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8,
  });
  const next = regionForRadarCluster(cluster, {
    latitude: 51.51,
    longitude: -0.12,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8,
  });
  assert.ok(next.latitudeDelta < 0.8);
  assert.ok(next.longitudeDelta < 0.8);
  assert.equal(cluster.shops.length, londonShops.length);
});
