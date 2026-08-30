const SUPERMARKET_RETAILER_IDS = new Set([
  'aldi-uk',
  'asda-uk',
  'costco-uk',
  'iceland-uk',
  'lidl-uk',
  'morrisons-uk',
  'sainsburys-uk',
  'sainsburys',
  'tesco-uk',
]);

const LARGE_RETAILER_IDS = new Set([
  'argos-uk',
  'bm-uk',
  'bm-stores-uk',
  'currys-uk',
  'entertainer-uk',
  'forbidden-planet-uk',
  'frasers-uk',
  'game-uk',
  'hamleys-uk',
  'hmv-uk',
  'hobbycraft-uk',
  'home-bargains-uk',
  'john-lewis-uk',
  'menkind-uk',
  'miniso-uk',
  'original-factory-shop-uk',
  'poundland-uk',
  'ryman-uk',
  'selfridges-uk',
  'smyths-uk',
  'sports-direct-uk',
  'tgjones-uk',
  'the-works-uk',
  'waterstones-uk',
  'whsmith-travel-uk',
]);

const SUPERMARKET_NAME_RE = /\b(aldi|asda|costco|iceland|lidl|morrisons|sainsbury'?s|tesco)\b/i;
const LARGE_RETAILER_NAME_RE = /\b(argos|b&m|currys|the entertainer|entertainer|forbidden planet|frasers|game|hamleys|hmv|hobbycraft|home bargains|john lewis|menkind|miniso|original factory shop|poundland|ryman|selfridges|smyths|sports direct|tgjones|the works|waterstones|whsmith)\b/i;

function normalizedCategory(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'supermarket' || text === 'supermarkets') return 'supermarket';
  if (text === 'large' || text === 'large_retailer' || text === 'large-retailer' || text === 'chain') return 'large';
  if (text === 'independent' || text === 'specialist' || text === 'lgs') return 'independent';
  return null;
}

export function retailerCategory(shop) {
  const explicit = normalizedCategory(shop?.retailerCategory ?? shop?.retailerSegment ?? shop?.storeCategory);
  if (explicit) return explicit;

  const retailerId = String(shop?.retailerId || '').trim().toLowerCase();
  if (SUPERMARKET_RETAILER_IDS.has(retailerId)) return 'supermarket';
  if (LARGE_RETAILER_IDS.has(retailerId)) return 'large';

  const identity = `${shop?.retailerName || ''} ${shop?.name || ''}`.trim();
  if (SUPERMARKET_NAME_RE.test(identity)) return 'supermarket';
  if (LARGE_RETAILER_NAME_RE.test(identity)) return 'large';
  return 'independent';
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

export function clusterShops(shops, region, { maxMarkers = 72 } = {}) {
  const visible = visibleShops(shops, region);
  if (visible.length <= maxMarkers) return visible.map(shopPoint);

  const gridSize = Math.max(4, Math.floor(Math.sqrt(Math.max(16, maxMarkers))));
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
  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.length === 1) {
      points.push(shopPoint(bucket[0]));
      continue;
    }
    const latitude = bucket.reduce((sum, shop) => sum + Number(shop.latitude), 0) / bucket.length;
    const longitude = bucket.reduce((sum, shop) => sum + Number(shop.longitude), 0) / bucket.length;
    points.push({
      kind: 'cluster',
      id: `cluster:${bucketKey}:${bucket.length}`,
      latitude,
      longitude,
      count: bucket.length,
      shopIds: bucket.map((shop) => shop.id),
    });
  }
  return points;
}

export function clusterZoomRegion(point, region) {
  const latitudeDelta = Math.max(0.015, (Number(region?.latitudeDelta) || 0.28) * 0.42);
  const longitudeDelta = Math.max(0.015, (Number(region?.longitudeDelta) || 0.28) * 0.42);
  return {
    latitude: Number(point?.latitude) || Number(region?.latitude) || 52.7,
    longitude: Number(point?.longitude) || Number(region?.longitude) || -1.5,
    latitudeDelta,
    longitudeDelta,
  };
}
