'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { clusterRadarShops } = require('./local-radar-safe-clustering');

const shops = [
  { id: 'a', latitude: 51.5000, longitude: -0.1200 },
  { id: 'b', latitude: 51.5010, longitude: -0.1210 },
  { id: 'c', latitude: 51.5200, longitude: -0.1400 },
  { id: 'd', latitude: 51.5210, longitude: -0.1410 },
];

test('wide Local Radar regions aggregate nearby markers', () => {
  const clusters = clusterRadarShops(shops, { latitude: 51.51, longitude: -0.13, latitudeDelta: 0.3, longitudeDelta: 0.3 });
  assert.ok(clusters.length < shops.length);
  assert.equal(clusters.reduce((count, cluster) => count + cluster.shops.length, 0), shops.length);
});

test('close Local Radar regions preserve exact branch markers', () => {
  const clusters = clusterRadarShops(shops, { latitude: 51.51, longitude: -0.13, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  assert.equal(clusters.length, shops.length);
  assert.ok(clusters.every((cluster) => cluster.shops.length === 1));
});

test('Local Radar clustering stays passive and never programmatically drives the native map', () => {
  const radar = fs.readFileSync(path.join(__dirname, '..', 'app', 'local-radar.tsx'), 'utf8');
  assert.match(radar, /clusterRadarShops\(mappedShops, region\)/);
  assert.match(radar, /onRegionChangeComplete=\{setRegion\}/);
  assert.doesNotMatch(radar, /regionForRadarCluster|animateToRegion|fitToCoordinates/);
  assert.match(radar, /Zoom in to separate stores/);
});
