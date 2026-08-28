'use strict';

function mappedShops(shops) {
  return (Array.isArray(shops) ? shops : []).filter((shop) =>
    Number.isFinite(Number(shop?.latitude)) && Number.isFinite(Number(shop?.longitude))
  );
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
  const latitudeDelta = Math.max(0.001, Math.abs(Number(region.latitudeDelta) || 1));
  const longitudeDelta = Math.max(0.001, Math.abs(Number(region.longitudeDelta) || 1));

  if (mapped.length < 3 || (latitudeDelta <= 0.075 && longitudeDelta <= 0.075)) {
    return mapped.map(singleton);
  }

  const latitudeCell = Math.max(0.006, latitudeDelta / 9);
  const longitudeCell = Math.max(0.006, longitudeDelta / 7);
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
    id: bucket.length === 1 ? `shop:${bucket[0].id}` : `cluster:${key}:${bucket.map((shop) => shop.id).sort().join(',')}`,
    latitude: bucket.reduce((sum, shop) => sum + Number(shop.latitude), 0) / bucket.length,
    longitude: bucket.reduce((sum, shop) => sum + Number(shop.longitude), 0) / bucket.length,
    shops: bucket,
  }));
}

module.exports = { clusterRadarShops };
