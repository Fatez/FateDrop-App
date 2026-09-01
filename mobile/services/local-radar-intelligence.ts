import { SIGNAL_ENGINE_URL } from '@/constants/api';
import type { UserArea } from '@/services/location';

export type RadarValue = {
  priceKnown?: boolean;
  itemPricePence?: number | null;
  rrp?: { known?: boolean; pence?: number | null; source?: string | null } | null;
  itemVsRrp?: { deltaPercent?: number | null } | null;
};

export type RadarExpectedWindow = {
  from?: string | null;
  to?: string | null;
  label?: string | null;
  confidence?: number | null;
  evidenceBasis?: string[] | null;
};

export type RadarLocalState = 'expected' | 'confirmed' | 'unknown';
export type RadarPhysicalEvidenceState = 'verified' | 'expected' | 'reported' | 'expired' | 'unknown';

export type RadarStockProduct = {
  productIdentityId?: string | null;
  title?: string | null;
  localState?: RadarLocalState | string | null;
  physicalEvidenceState?: RadarPhysicalEvidenceState | string | null;
  expectedLabel?: string | null;
  lifecycleState?: string | null;
  status?: string | null;
  confidence?: number | null;
  freshnessAgeMinutes?: number | null;
  contradictionCount?: number | null;
  orphanVanished?: boolean | null;
  evidenceLevel?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  advisory?: boolean | null;
  scope?: string | null;
  expectedFrom?: string | null;
  expectedTo?: string | null;
  note?: string | null;
  value?: RadarValue | null;
  expectedStockWindow?: RadarExpectedWindow | null;
};

export type RadarLocalAvailability = {
  status?: RadarLocalState | string | null;
  expected?: {
    title?: string | null;
    productIdentityId?: string | null;
    expectedFrom?: string | null;
    expectedTo?: string | null;
    expectedLabel?: string | null;
    advisory?: boolean | null;
    sourceLabel?: string | null;
    sourceUrl?: string | null;
  } | null;
  confirmed?: {
    title?: string | null;
    productIdentityId?: string | null;
    observedAt?: string | null;
    sourceLabel?: string | null;
    sourceUrl?: string | null;
  } | null;
  disclaimer?: string | null;
};

export type RadarShop = {
  id: string;
  name: string;
  itemType?: 'shop';
  retailerId?: string | null;
  address?: string | null;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMiles?: number | null;
  networkStatus?: string | null;
  retailerCategory?: string | null;
  retailerGroup?: 'supermarkets' | 'large_retailers' | 'independents' | string | null;
  storeFormat?: string | null;
  operationalStatus?: string | null;
  locationEvidence?: {
    branchIdentity?: 'canonical' | 'provisional' | 'conflicted' | string | null;
    pokemonSeller?: 'verified' | 'likely' | 'candidate' | 'excluded' | 'conflicted' | string | null;
    confidence?: number | null;
    sourceCount?: number | null;
    lastVerifiedAt?: number | null;
    caveat?: string | null;
  } | null;
  localStockStatus?: string | null;
  localAvailability?: RadarLocalAvailability | null;
  localStockEvidence?: {
    lifecycleState?: string | null;
    physicalEvidenceState?: RadarPhysicalEvidenceState | string | null;
    availabilityScope?: string | null;
    confidence?: number | null;
    freshnessAgeMinutes?: number | null;
    verifiedBranchStock?: boolean | null;
    observedAt?: string | null;
    expiresAt?: string | null;
    evidenceLevel?: string | null;
    sourceType?: string | null;
    sourceUrl?: string | null;
    sourceLabel?: string | null;
    orphanVanished?: boolean | null;
    advisory?: boolean | null;
    scope?: string | null;
    expectedFrom?: string | null;
    expectedTo?: string | null;
    expectedLabel?: string | null;
    note?: string | null;
  } | null;
  localStockProducts?: RadarStockProduct[] | null;
};

export type RadarEvent = {
  id: string;
  name: string;
  itemType?: 'event';
  startDateTime?: string;
  venueName?: string;
  townCity?: string;
  postcode?: string;
  categories?: string[];
  organiserName?: string;
  distanceMiles?: number | null;
};

export type RadarResponse = {
  success?: boolean;
  error?: string;
  contractVersion?: number;
  mapPolicy?: { markerBudget?: number; clusteringRequired?: boolean } | null;
  filters?: { retailerGroups?: string[] } | null;
  locationResolution?: { status?: string; postcode?: string | null; reason?: string | null } | null;
  providers?: Record<string, { provider?: string; status?: string }>;
  shops?: RadarShop[];
  events?: RadarEvent[];
  counts?: {
    shops?: number;
    events?: number;
    localInStockBranches?: number;
    localLowStockBranches?: number;
    incomingWatchBranches?: number;
  };
  disclaimers?: string[];
};

export type RadarTypes = 'shops' | 'events' | 'shops,events';

export const EXPECTED_STOCK_DISCLAIMER = 'Expected stock information is indicative only and is not guaranteed. Availability, delivery timing and quantities may vary by store. We recommend checking with the retailer before travelling.';

export async function fetchLocalRadar(area: UserArea, radiusMiles = 25, types: RadarTypes = 'shops,events') {
  const params = new URLSearchParams({ types, radiusMiles: String(radiusMiles), tcg: 'pokemon' });
  if (area.source === 'DEVICE' && area.latitude !== undefined && area.longitude !== undefined) {
    params.set('lat', String(area.latitude));
    params.set('lng', String(area.longitude));
  } else if (area.postcode) {
    params.set('postcode', area.postcode);
  } else {
    throw new Error('LOCATION_UNRESOLVED');
  }

  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/local-radar?${params.toString()}`);
  const payload = await response.json() as RadarResponse;
  if (!response.ok || payload.success === false) throw new Error(payload.error || 'RADAR_UNAVAILABLE');
  if (payload.locationResolution?.status === 'invalid' || payload.locationResolution?.status === 'not_found') {
    throw new Error(payload.locationResolution.reason || 'INVALID_POSTCODE');
  }
  return payload;
}

export function money(pence?: number | null) {
  return typeof pence === 'number' && Number.isFinite(pence) ? `£${(pence / 100).toFixed(2)}` : null;
}

export function confidenceLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'UNKNOWN';
  if (value >= 0.85) return 'HIGH';
  if (value >= 0.6) return 'MEDIUM';
  return 'LOW';
}

export function ageLabel(minutes?: number | null) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'Last checked unknown';
  if (minutes < 1) return 'Checked just now';
  if (minutes < 60) return `Checked ${Math.round(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return `Checked ${hours} hr${hours === 1 ? '' : 's'} ago`;
}

export function valueLine(value?: RadarValue | null) {
  if (!value) return 'Price unknown · RRP unknown';
  const price = value.priceKnown ? money(value.itemPricePence) : null;
  const rrp = value.rrp?.known ? money(value.rrp.pence) : null;
  const delta = value.itemVsRrp?.deltaPercent;
  const parts = [price || 'Price unknown', rrp ? `RRP ${rrp}` : 'RRP unknown'];
  if (typeof delta === 'number' && Number.isFinite(delta)) {
    parts.push(Math.abs(delta) < 0.05 ? '0.0% · AT RRP' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% ${delta > 0 ? 'ABOVE' : 'BELOW'} RRP`);
  }
  return parts.join(' · ');
}

export function shopLocalState(shop: RadarShop): RadarLocalState {
  const evidenceState = shopPhysicalEvidenceState(shop);
  if (evidenceState === 'verified' && (shop.localStockEvidence?.verifiedBranchStock || shop.localAvailability?.status === 'confirmed')) return 'confirmed';
  if (evidenceState === 'expected' || evidenceState === 'reported') return 'expected';
  if (evidenceState === 'expired') return 'unknown';

  const projected = String(shop.localAvailability?.status || '').toLowerCase();
  if (projected === 'confirmed' || projected === 'expected' || projected === 'unknown') return projected;

  const productState = String(shop.localStockProducts?.[0]?.localState || '').toLowerCase();
  if (productState === 'confirmed' || productState === 'expected' || productState === 'unknown') return productState;

  // Backward-compatible fail-closed fallback while older Cloud payloads age out.
  const lifecycle = String(shop.localStockEvidence?.lifecycleState || '').toLowerCase();
  const status = String(shop.localStockStatus || '').toLowerCase();
  if (shop.localStockEvidence?.verifiedBranchStock && ['echo', 'manifested'].includes(lifecycle) && ['in_stock', 'low_stock'].includes(status)) return 'confirmed';
  if (['echo', 'whisper'].includes(lifecycle) && status === 'incoming_watch') return 'expected';
  return 'unknown';
}

function normalizePhysicalEvidenceState(value: unknown): RadarPhysicalEvidenceState | null {
  const state = String(value || '').trim().toLowerCase();
  if (state === 'verified' || state === 'expected' || state === 'reported' || state === 'expired') return state;
  return null;
}

export function shopPhysicalEvidenceState(shop: RadarShop): RadarPhysicalEvidenceState {
  const candidates = [
    shop.localStockEvidence?.physicalEvidenceState,
    ...(shop.localStockProducts || []).map(product => product.physicalEvidenceState),
  ];
  for (const candidate of candidates) {
    const state = normalizePhysicalEvidenceState(candidate);
    if (state) return state;
  }
  if (shop.localAvailability?.status === 'confirmed') return 'verified';
  if (shop.localAvailability?.status === 'expected') return 'expected';
  return 'unknown';
}

const PHYSICAL_EVIDENCE_PRIORITY: Record<RadarPhysicalEvidenceState, number> = {
  verified: 0,
  expected: 1,
  reported: 2,
  expired: 3,
  unknown: 4,
};

export function prioritizeRadarShops(shops: RadarShop[]) {
  return [...shops].sort((left, right) => {
    const truthDifference = PHYSICAL_EVIDENCE_PRIORITY[shopPhysicalEvidenceState(left)] - PHYSICAL_EVIDENCE_PRIORITY[shopPhysicalEvidenceState(right)];
    if (truthDifference) return truthDifference;
    const leftDistance = typeof left.distanceMiles === 'number' && Number.isFinite(left.distanceMiles) ? left.distanceMiles : Number.POSITIVE_INFINITY;
    const rightDistance = typeof right.distanceMiles === 'number' && Number.isFinite(right.distanceMiles) ? right.distanceMiles : Number.POSITIVE_INFINITY;
    const distanceDifference = leftDistance - rightDistance;
    if (Number.isFinite(distanceDifference) && distanceDifference) return distanceDifference;
    const nameDifference = left.name.localeCompare(right.name, 'en-GB', { sensitivity: 'base' });
    return nameDifference || left.id.localeCompare(right.id, 'en-GB', { sensitivity: 'base' });
  });
}

export function shopSignal(shop: RadarShop) {
  const state = shopPhysicalEvidenceState(shop);
  if (state === 'verified') return 'ECHO · IN-STORE CONFIRMED';
  if (state === 'expected') return 'ECHO · EXPECTED';
  if (state === 'reported') return 'ECHO · REPORTED';
  if (state === 'expired') return 'ECHO · NO LONGER CONFIRMED';
  return 'UNKNOWN';
}

export function expectedWindowLabel(product?: RadarStockProduct | null) {
  if (product?.expectedLabel) return product.expectedLabel;
  const window = product?.expectedStockWindow;
  if (window?.label) return window.label;
  const fromValue = window?.from || product?.expectedFrom;
  const toValue = window?.to || product?.expectedTo;
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;
  const validFrom = from && !Number.isNaN(from.valueOf()) ? from : null;
  const validTo = to && !Number.isNaN(to.valueOf()) ? to : null;
  if (validFrom && validTo) {
    const fromLabel = validFrom.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const toLabel = validTo.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return fromLabel === toLabel ? `Expected ${fromLabel}` : `Expected ${fromLabel} – ${toLabel}`;
  }
  if (validFrom) return `Expected from ${validFrom.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`;
  if (validTo) return `Expected by ${validTo.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`;
  return null;
}

export function expectedStockForShop(shop: RadarShop) {
  const projected = shop.localAvailability?.expected;
  if (projected) {
    return {
      title: projected.title || 'Pokémon stock',
      label: projected.expectedLabel || expectedWindowLabel({ expectedFrom: projected.expectedFrom, expectedTo: projected.expectedTo }),
      sourceLabel: projected.sourceLabel || null,
      sourceUrl: projected.sourceUrl || null,
      disclaimer: shop.localAvailability?.disclaimer || EXPECTED_STOCK_DISCLAIMER,
    };
  }
  const product = (shop.localStockProducts || []).find(item => String(item.localState || '').toLowerCase() === 'expected') || shop.localStockProducts?.[0];
  return product ? {
    title: product.title || 'Pokémon stock',
    label: expectedWindowLabel(product),
    sourceLabel: product.sourceLabel || null,
    sourceUrl: product.sourceUrl || null,
    disclaimer: EXPECTED_STOCK_DISCLAIMER,
  } : null;
}

export function areaParams(area: UserArea | undefined, radiusMiles: number) {
  if (!area) return { radiusMiles: String(radiusMiles) };
  return {
    radiusMiles: String(radiusMiles),
    source: area.source,
    ...(area.latitude !== undefined ? { lat: String(area.latitude) } : {}),
    ...(area.longitude !== undefined ? { lng: String(area.longitude) } : {}),
    ...(area.postcode ? { postcode: area.postcode } : {}),
  };
}

export function areaFromParams(params: Record<string, string | string[] | undefined>): UserArea | undefined {
  const source = params.source === 'POSTCODE' ? 'POSTCODE' : params.source === 'DEVICE' ? 'DEVICE' : null;
  if (!source) return undefined;
  if (source === 'POSTCODE' && typeof params.postcode === 'string') return { source, postcode: params.postcode };
  const latitude = typeof params.lat === 'string' ? Number(params.lat) : NaN;
  const longitude = typeof params.lng === 'string' ? Number(params.lng) : NaN;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { source, latitude, longitude };
  return undefined;
}
