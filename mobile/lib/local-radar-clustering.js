'use strict';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mappedShops(shops) {
  return (Array.isArray(shops) ? shops : []).filter((shop) => Number.isFinite(Number(shop?.latitude)) && Number.isFinite(Number(shop?.longitude)));
}

function singleton(shop) {
  return {
    id: `shop:${shop.id}`,
    latitude: Number(shop.latitude),
    longitude: Number(shop.longitude),
    shops: [shop],
  };
}

function clusterRadarShops(shops, region = {}) {
  const mapped = mappedShops(shops);
  const latitudeDelta = Math.max(0.001, Math.abs(finite(region.latitudeDelta, 1)));
  const longitudeDelta = Math.max(0.001, Math.abs(finite(region.longitudeDelta, 1)));

  // Once the user is close enough, preserve exact branch pins instead of forcing clusters.
  if (latitudeDelta <= 0.06 && longitudeDelta <= 0.06) return mapped.map(singleton);

  const latitudeCell = Math.max(0.008, latitudeDelta / 7);
  const longitudeCell = Math.max(0.008, longitudeDelta / 6);
  const buckets = new Map();

  for (const shop of mapped) {
    const latitude = Number(shop.latitude);
    const longitude = Number(shop.longitude);
    const key = `${Math.floor(latitude / latitudeCell)}:${Math.floor(longitude / longitudeCell)}`;
    const bucket = buckets.get(key) || [];
    bucket.push(shop);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()].map(([key, bucket]) => ({
    id: bucket.length === 1 ? `shop:${bucket[0].id}` : `cluster:${key}:${bucket.length}`,
    latitude: bucket.reduce((sum, shop) => sum + Number(shop.latitude), 0) / bucket.length,
    longitude: bucket.reduce((sum, shop) => sum + Number(shop.longitude), 0) / bucket.length,
    shops: bucket,
  }));
}

function regionForRadarCluster(cluster, currentRegion = {}) {
  const shops = mappedShops(cluster?.shops);
  if (!shops.length) return currentRegion;
  const latitudes = shops.map((shop) => Number(shop.latitude));
  const longitudes = shops.map((shop) => Number(shop.longitude));
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const currentLatitudeDelta = Math.max(0.03, Math.abs(finite(currentRegion.latitudeDelta, 0.28)));
  const currentLongitudeDelta = Math.max(0.03, Math.abs(finite(currentRegion.longitudeDelta, 0.28)));

  return {
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    latitudeDelta: Math.max(0.025, Math.min(currentLatitudeDelta * 0.48, Math.max(0.025, latitudeSpan * 3.2))),
    longitudeDelta: Math.max(0.025, Math.min(currentLongitudeDelta * 0.48, Math.max(0.025, longitudeSpan * 3.2))),
  };
}

module.exports = { clusterRadarShops, regionForRadarCluster };
