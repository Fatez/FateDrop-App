'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { clusterRadarShops } = require('./local-radar-clustering-v3');

const root = path.resolve(__dirname, '..');
const radarSource = fs.readFileSync(path.join(root, 'app', 'local-radar.tsx'), 'utf8');

const shops = [
  { id: 'a', latitude: 51.50, longitude: -0.12 },
  { id: 'b', latitude: 51.505, longitude: -0.115 },
  { id: 'c', latitude: 51.70, longitude: -0.30 },
];

test('wide Local Radar view groups nearby branches', () => {
  const clusters = clusterRadarShops(shops, { latitudeDelta: 1, longitudeDelta: 1 });
  assert.ok(clusters.some((cluster) => cluster.shops.length > 1));
});

test('close Local Radar view preserves exact branch markers', () => {
  const clusters = clusterRadarShops(shops, { latitudeDelta: 0.04, longitudeDelta: 0.04 });
  assert.equal(clusters.length, shops.length);
  assert.ok(clusters.every((cluster) => cluster.shops.length === 1));
});

test('Local Radar clustering cannot feed zoom completion back into a controlled MapView', () => {
  assert.match(radarSource, /initialRegion=\{mapRegion\}/);
  assert.match(radarSource, /onRegionChangeComplete=\{setViewportRegion\}/);
  assert.doesNotMatch(radarSource, /<MapView[^>]*\sregion=\{(?:region|viewportRegion|mapRegion)\}/s);
});

test('cluster presentation uses numbered custom bubbles rather than default cluster pins', () => {
  assert.match(radarSource, /cluster\.shops\.length/);
  assert.match(radarSource, /styles\.clusterBubble/);
  assert.match(radarSource, /tracksViewChanges=\{false\}/);
});
