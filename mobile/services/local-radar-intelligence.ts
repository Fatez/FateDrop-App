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

export type RadarStockProduct = {
  productIdentityId?: string | null;
  title?: string | null;
  lifecycleState?: string | null;
  status?: string | null;
  confidence?: number | null;
  freshnessAgeMinutes?: number | null;
  contradictionCount?: number | null;
  value?: RadarValue | null;
  expectedStockWindow?: RadarExpectedWindow | null;
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
  localStockStatus?: string | null;
  localStockEvidence?: {
    lifecycleState?: string | null;
    confidence?: number | null;
    freshnessAgeMinutes?: number | null;
    verifiedBranchStock?: boolean | null;
    evidenceLevel?: string | null;
    sourceType?: string | null;
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

export async function fetchLocalRadar(area: UserArea, radiusMiles = 25, types: RadarTypes = 'shops,events') {
  const params = new URLSearchParams({ types, radiusMiles: String(radiusMiles) });
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
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'Freshness unknown';
  if (minutes < 1) return 'Observed just now';
  if (minutes < 60) return `Observed ${Math.round(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return `Observed ${hours} hr${hours === 1 ? '' : 's'} ago`;
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

export function shopSignal(shop: RadarShop) {
  const lifecycle = String(shop.localStockEvidence?.lifecycleState || '').toLowerCase();
  if (shop.localStockEvidence?.verifiedBranchStock && lifecycle === 'manifested') return 'LOCAL MANIFESTED';
  if (lifecycle === 'echo') return 'LOCAL ECHO';
  if (lifecycle === 'whisper') return 'LOCAL WHISPER';
  if (lifecycle === 'vanished') return 'LOCAL VANISHED';
  return shop.networkStatus === 'live_connected' ? 'LIVE CONNECTED' : 'LOCAL DISCOVERY';
}

export function expectedWindowLabel(product?: RadarStockProduct | null) {
  const window = product?.expectedStockWindow;
  if (!window) return null;
  if (window.label) return window.label;
  const from = window.from ? new Date(window.from) : null;
  const to = window.to ? new Date(window.to) : null;
  const validFrom = from && !Number.isNaN(from.valueOf()) ? from : null;
  const validTo = to && !Number.isNaN(to.valueOf()) ? to : null;
  if (validFrom && validTo) {
    return `${validFrom.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} – ${validTo.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  }
  if (validFrom) return `From ${validFrom.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`;
  return null;
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
