import assert from 'node:assert/strict';
import test from 'node:test';

import { clusterShops, clusterZoomRegion, filterShopsByCategory, retailerCategory } from './local-radar-map.js';

test('classifies grocery chains, large retailers and unknown specialist stores', () => {
  assert.equal(retailerCategory({ retailerId: 'tesco-uk' }), 'supermarket');
  assert.equal(retailerCategory({ retailerId: 'bm-stores-uk' }), 'large');
  assert.equal(retailerCategory({ retailerId: 'local-card-shop-123' }), 'independent');
  assert.equal(retailerCategory({ retailerId: 'tesco-uk', retailerCategory: 'independent' }), 'independent');
});

test('filters store categories without changing the source array', () => {
  const shops = [
    { id: '1', retailerId: 'tesco-uk' },
    { id: '2', retailerId: 'smyths-uk' },
    { id: '3', retailerId: 'my-lgs' },
  ];
  assert.deepEqual(filterShopsByCategory(shops, 'supermarket').map((shop) => shop.id), ['1']);
  assert.deepEqual(filterShopsByCategory(shops, 'large').map((shop) => shop.id), ['2']);
  assert.deepEqual(filterShopsByCategory(shops, 'independent').map((shop) => shop.id), ['3']);
  assert.equal(filterShopsByCategory(shops, 'all'), shops);
});

test('clusters a dense visible map into a bounded number of markers', () => {
  const shops = Array.from({ length: 500 }, (_, index) => ({
    id: String(index),
    retailerId: 'tesco-uk',
    latitude: 51 + (index % 25) * 0.01,
    longitude: -0.4 + Math.floor(index / 25) * 0.01,
  }));
  const region = { latitude: 51.15, longitude: -0.3, latitudeDelta: 0.6, longitudeDelta: 0.6 };
  const points = clusterShops(shops, region, { maxMarkers: 72 });
  assert.ok(points.length <= 64);
  assert.ok(points.some((point) => point.kind === 'cluster' && point.count > 1));
});

test('returns individual shops once the visible density is already safe', () => {
  const shops = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    latitude: 51.5 + index * 0.001,
    longitude: -0.1 + index * 0.001,
  }));
  const region = { latitude: 51.5, longitude: -0.1, latitudeDelta: 0.2, longitudeDelta: 0.2 };
  const points = clusterShops(shops, region, { maxMarkers: 72 });
  assert.equal(points.length, 12);
  assert.ok(points.every((point) => point.kind === 'shop'));
});

test('cluster tap target zooms in while respecting a safe minimum delta', () => {
  const next = clusterZoomRegion({ latitude: 51.5, longitude: -0.1 }, { latitude: 52, longitude: 0, latitudeDelta: 2, longitudeDelta: 2 });
  assert.equal(next.latitude, 51.5);
  assert.equal(next.longitude, -0.1);
  assert.ok(next.latitudeDelta < 2);
  assert.ok(next.longitudeDelta < 2);
});
