'use strict';

const MAX_RADIUS_MILES = 50;
const MILES_PER_KM = 0.6213711922;
const DEFAULT_QUERIES = [
  'trading card shop',
  'TCG shop',
  'card shop',
  'hobby shop trading cards',
  'game store trading cards',
  'collectibles store trading cards',
];

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampRadiusMiles(value) {
  const number = finite(value);
  return Math.min(Math.max(number ?? 25, 1), MAX_RADIUS_MILES);
}

function radians(value) {
  return value * Math.PI / 180;
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const earthRadiusKm = 6371;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const lat1 = radians(aLat);
  const lat2 = radians(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function postcodeFromComponents(parts) {
  if (!Array.isArray(parts)) return null;
  const part = parts.find((entry) => Array.isArray(entry?.types) && entry.types.includes('postal_code'));
  return typeof part?.longText === 'string' && part.longText.trim() ? part.longText.trim() : null;
}

async function resolvePostcode(postcode) {
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const latitude = finite(data?.result?.latitude);
    const longitude = finite(data?.result?.longitude);
    if (latitude === null || longitude === null) return null;
    const cleanPostcode = typeof data?.result?.postcode === 'string' ? data.result.postcode : String(postcode).toUpperCase();
    return { latitude, longitude, postcode: cleanPostcode, label: cleanPostcode, source: 'postcode' };
  } catch {
    return null;
  }
}

async function resolveAddress(address, apiKey) {
  if (!apiKey) return null;
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.addressComponents',
      },
      body: JSON.stringify({ textQuery: `${address}, United Kingdom`, regionCode: 'GB', maxResultCount: 1 }),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const place = data?.places?.[0];
    const latitude = finite(place?.location?.latitude);
    const longitude = finite(place?.location?.longitude);
    if (latitude === null || longitude === null) return null;
    return {
      latitude,
      longitude,
      postcode: postcodeFromComponents(place?.addressComponents),
      label: typeof place?.formattedAddress === 'string' ? place.formattedAddress : address,
      source: 'address',
    };
  } catch {
    return null;
  }
}

async function resolveOrigin(query, apiKey) {
  const latitude = finite(query?.lat);
  const longitude = finite(query?.lng ?? query?.lon);
  const postcode = typeof query?.postcode === 'string' ? query.postcode.trim().slice(0, 12) : '';
  const address = typeof query?.address === 'string' ? query.address.trim().slice(0, 160) : '';

  if ((latitude === null) !== (longitude === null)) return { error: 'Both latitude and longitude are required when using device location.' };
  if (latitude !== null && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) return { error: 'Device coordinates are invalid.' };
  if (latitude !== null && longitude !== null) return { origin: { latitude, longitude, postcode: postcode || null, label: postcode || 'Device location', source: 'device' } };
  if (postcode) {
    const origin = await resolvePostcode(postcode);
    return origin ? { origin } : { error: 'That UK postcode could not be resolved.' };
  }
  if (address) {
    const origin = await resolveAddress(address, apiKey);
    return origin ? { origin } : { error: apiKey ? 'That address could not be resolved.' : 'Address search is not configured on FateDrop Cloud.' };
  }
  return { error: 'Use device location, enter a UK postcode or search an address.' };
}

function searchQueries(tcg) {
  const clean = typeof tcg === 'string' ? tcg.trim().slice(0, 40) : '';
  if (!clean) return DEFAULT_QUERIES;
  return [`${clean} trading card shop`, `${clean} card shop`, ...DEFAULT_QUERIES];
}

async function searchPlacesText(textQuery, origin, radiusKm, apiKey) {
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.types,places.addressComponents',
      },
      body: JSON.stringify({
        textQuery,
        regionCode: 'GB',
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: origin.latitude, longitude: origin.longitude },
            radius: Math.min(radiusKm * 1000, 50000),
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.places) ? data.places : [];
  } catch {
    return [];
  }
}

function placeToShop(place, origin, radiusKm) {
  const latitude = finite(place?.location?.latitude);
  const longitude = finite(place?.location?.longitude);
  const name = typeof place?.displayName?.text === 'string' ? place.displayName.text.trim() : '';
  if (latitude === null || longitude === null || !name) return null;
  const km = distanceKm(origin.latitude, origin.longitude, latitude, longitude);
  if (km > radiusKm) return null;
  return {
    id: typeof place?.id === 'string' && place.id ? `places:${place.id}` : `places:${latitude}:${longitude}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    providerId: typeof place?.id === 'string' ? place.id : null,
    name,
    address: typeof place?.formattedAddress === 'string' ? place.formattedAddress : null,
    postcode: postcodeFromComponents(place?.addressComponents),
    latitude,
    longitude,
    websiteUrl: typeof place?.websiteUri === 'string' && /^https:\/\//i.test(place.websiteUri) ? place.websiteUri : null,
    phone: typeof place?.nationalPhoneNumber === 'string' ? place.nationalPhoneNumber : null,
    distanceMiles: km * MILES_PER_KM,
    networkStatus: 'local_discovery',
    verification: 'external',
    retailerId: null,
    retailerCategory: null,
    onlineCatalogue: null,
    provider: 'google_places',
  };
}

async function discoverShops(origin, radiusMiles, tcg, apiKey) {
  if (!apiKey) return { shops: [], status: 'places_not_configured' };
  const radiusKm = radiusMiles / MILES_PER_KM;
  const batches = await Promise.all(searchQueries(tcg).map((query) => searchPlacesText(query, origin, radiusKm, apiKey)));
  const unique = new Map();
  for (const place of batches.flat()) {
    const shop = placeToShop(place, origin, radiusKm);
    if (!shop) continue;
    const key = shop.providerId || `${shop.name.toLowerCase()}|${shop.latitude.toFixed(4)}|${shop.longitude.toFixed(4)}`;
    const current = unique.get(key);
    if (!current || shop.distanceMiles < current.distanceMiles) unique.set(key, shop);
  }
  return { shops: [...unique.values()].sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name)), status: 'google_places_live' };
}

async function localRadar(query, options = {}) {
  const apiKey = options.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY || '';
  const radiusMiles = clampRadiusMiles(query?.radiusMiles);
  const types = String(query?.types || 'shops,events').split(',').map((value) => value.trim().toLowerCase());
  const wantsShops = types.includes('shops');
  const wantsEvents = types.includes('events');
  const resolution = await resolveOrigin(query || {}, apiKey);
  if (!resolution.origin) return { success: false, statusCode: 400, error: resolution.error || 'Location could not be resolved.' };
  const origin = resolution.origin;
  const discovered = wantsShops ? await discoverShops(origin, radiusMiles, query?.tcg, apiKey) : { shops: [], status: 'not_requested' };

  // Event discovery remains a separate canonical feed. Do not fabricate nearby
  // events until the event records themselves carry verified coordinates.
  const events = [];
  return {
    success: true,
    locationResolution: {
      status: 'resolved',
      postcode: origin.postcode,
      label: origin.label,
      latitude: origin.latitude,
      longitude: origin.longitude,
      source: origin.source,
    },
    radiusMiles,
    providers: {
      shops: { status: discovered.status },
      events: { status: wantsEvents ? 'coordinates_pending' : 'not_requested' },
    },
    shops: discovered.shops,
    events,
    counts: { shops: discovered.shops.length, events: events.length },
    disclaimer: 'External Local Radar discovery does not imply a FateDrop partnership or live branch stock. Connected retailers will be labelled separately when their network identity is verified.',
  };
}

module.exports = {
  clampRadiusMiles,
  distanceKm,
  localRadar,
  placeToShop,
  resolveOrigin,
};
