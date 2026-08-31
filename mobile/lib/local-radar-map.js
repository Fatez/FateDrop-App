function normalizedGroup(value) {
  const group = String(value || '').trim().toLowerCase();
  if (group === 'supermarkets') return 'supermarket';
  if (group === 'large_retailers') return 'large';
  if (group === 'independents') return 'independent';
  return 'unclassified';
}

export function retailerCategory(shop) {
  return normalizedGroup(shop?.retailerGroup);
}

export function filterShopsByCategory(shops, category = 'all') {
  const rows = Array.isArray(shops) ? shops : [];
  if (category === 'all') return rows;
  return rows.filter((shop) => retailerCategory(shop) === category);
}

function validNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function visibleShops(shops, region) {
  const rows = (Array.isArray(shops) ? shops : []).filter((shop) => validNumber(shop?.latitude) && validNumber(shop?.longitude));
  if (!region || !validNumber(region.latitude) || !validNumber(region.longitude) || !validNumber(region.latitudeDelta) || !validNumber(region.longitudeDelta)) {
    return rows;
  }
  const latPad = Math.max(0.01, region.latitudeDelta * 0.08);
  const lonPad = Math.max(0.01, region.longitudeDelta * 0.08);
  const minLat = region.latitude - region.latitudeDelta / 2 - latPad;
  const maxLat = region.latitude + region.latitudeDelta / 2 + latPad;
  const minLon = region.longitude - region.longitudeDelta / 2 - lonPad;
  const maxLon = region.longitude + region.longitudeDelta / 2 + lonPad;
  return rows.filter((shop) => shop.latitude >= minLat && shop.latitude <= maxLat && shop.longitude >= minLon && shop.longitude <= maxLon);
}

function shopPoint(shop) {
  return {
    kind: 'shop',
    id: `shop:${shop.id}`,
    latitude: Number(shop.latitude),
    longitude: Number(shop.longitude),
    count: 1,
    shop,
  };
}

export function clusterShops(shops, region, { maxMarkers = 36, maxIndividualMarkers = 24 } = {}) {
  // iOS react-native-maps is substantially more stable when dense cluster expansion
  // cannot replace one cluster with dozens of native Marker views in a single render.
  const markerBudget = Math.max(8, Math.min(36, Number(maxMarkers) || 36));
  const individualMarkerLimit = Math.max(4, Math.min(24, Number(maxIndividualMarkers) || 24));
  const visible = visibleShops(shops, region);
  if (visible.length <= individualMarkerLimit) return visible.map(shopPoint);

  const gridSize = Math.max(3, Math.floor(Math.sqrt(markerBudget)));
  const latDelta = Math.max(0.0001, Number(region?.latitudeDelta) || 1);
  const lonDelta = Math.max(0.0001, Number(region?.longitudeDelta) || 1);
  const minLat = (Number(region?.latitude) || 0) - latDelta / 2;
  const minLon = (Number(region?.longitude) || 0) - lonDelta / 2;
  const buckets = new Map();

  for (const shop of visible) {
    const rawRow = Math.floor(((Number(shop.latitude) - minLat) / latDelta) * gridSize);
    const rawCol = Math.floor(((Number(shop.longitude) - minLon) / lonDelta) * gridSize);
    const row = Math.max(0, Math.min(gridSize - 1, rawRow));
    const col = Math.max(0, Math.min(gridSize - 1, rawCol));
    const bucketKey = `${row}:${col}`;
    const bucket = buckets.get(bucketKey) || [];
    bucket.push(shop);
    buckets.set(bucketKey, bucket);
  }

  const points = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      points.push(shopPoint(bucket[0]));
      continue;
    }
    points.push({
      kind: 'cluster',
      // Anchor the key to a member shop rather than the cluster count so small
      // viewport changes do not remount every cluster marker unnecessarily.
      id: `cluster:${bucket[0].id}`,
      latitude: bucket.reduce((sum, shop) => sum + Number(shop.latitude), 0) / bucket.length,
      longitude: bucket.reduce((sum, shop) => sum + Number(shop.longitude), 0) / bucket.length,
      count: bucket.length,
      shopIds: bucket.map((shop) => shop.id),
    });
  }
  return points;
}

export function clusterZoomRegion(point, region) {
  return {
    latitude: Number(point?.latitude) || Number(region?.latitude) || 52.7,
    longitude: Number(point?.longitude) || Number(region?.longitude) || -1.5,
    // Progressive expansion avoids a single tap exploding a dense cluster into
    // a large native-marker set. Repeated taps keep narrowing the viewport.
    latitudeDelta: Math.max(0.015, (Number(region?.latitudeDelta) || 0.28) * 0.6),
    longitudeDelta: Math.max(0.015, (Number(region?.longitudeDelta) || 0.28) * 0.6),
  };
}
