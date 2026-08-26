import { SIGNAL_ENGINE_URL } from '@/constants/api';

export type NetworkRetailerClass = 'independent' | 'specialist' | 'regional' | 'national' | 'event_vendor' | string;

export type NetworkRetailerLocation = {
  id: string;
  retailerId: string;
  name: string;
  address: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
  websiteUrl: string | null;
  phone: string | null;
  verification: string;
};

export type NetworkRetailer = {
  id: string;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  retailerClass: NetworkRetailerClass;
  verification: string;
  tcgs: string[];
  online: boolean;
  physicalStores: boolean | null;
  physicalLocations: number | null;
  locations?: NetworkRetailerLocation[];
  monitoring: {
    configured: boolean;
    healthy: boolean;
    stale: boolean;
    baselineCompleted: boolean;
    productsSeen: number | null;
    lastScanAt: number | null;
    lastSuccessAt: number | null;
  };
};

type DirectoryResponse = {
  success?: boolean;
  retailers?: unknown[];
  disclaimer?: string;
};

type ProfileResponse = {
  success?: boolean;
  retailer?: unknown;
  disclaimer?: string;
};

function textOrNull(value: unknown) {
  const valueText = typeof value === 'string' ? value.trim() : '';
  return valueText || null;
}

function finiteOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function retailerLocation(raw: unknown): NetworkRetailerLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const id = textOrNull(value.id);
  const retailerId = textOrNull(value.retailerId);
  const name = textOrNull(value.name);
  const latitude = finiteOrNull(value.latitude);
  const longitude = finiteOrNull(value.longitude);
  if (!id || !retailerId || !name || latitude === null || longitude === null) return null;
  return {
    id,
    retailerId,
    name,
    address: textOrNull(value.address),
    postcode: textOrNull(value.postcode),
    latitude,
    longitude,
    websiteUrl: textOrNull(value.websiteUrl),
    phone: textOrNull(value.phone),
    verification: textOrNull(value.verification) || 'unknown',
  };
}

function retailerRecord(raw: unknown): NetworkRetailer | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const id = textOrNull(value.id);
  const name = textOrNull(value.name);
  if (!id || !name) return null;
  const monitoringRaw = value.monitoring && typeof value.monitoring === 'object'
    ? value.monitoring as Record<string, unknown>
    : {};
  const locations = Array.isArray(value.locations)
    ? value.locations.map(retailerLocation).filter((item): item is NetworkRetailerLocation => Boolean(item))
    : undefined;
  return {
    id,
    name,
    websiteUrl: textOrNull(value.websiteUrl),
    logoUrl: textOrNull(value.logoUrl),
    description: textOrNull(value.description),
    retailerClass: textOrNull(value.retailerClass) || 'independent',
    verification: textOrNull(value.verification) || 'unverified',
    tcgs: Array.isArray(value.tcgs) ? value.tcgs.map((item) => textOrNull(item)).filter((item): item is string => Boolean(item)) : [],
    online: value.online === true,
    physicalStores: typeof value.physicalStores === 'boolean' ? value.physicalStores : null,
    physicalLocations: finiteOrNull(value.physicalLocations),
    ...(locations ? { locations } : {}),
    monitoring: {
      configured: monitoringRaw.configured === true,
      healthy: monitoringRaw.healthy === true,
      stale: monitoringRaw.stale === true,
      baselineCompleted: monitoringRaw.baselineCompleted === true,
      productsSeen: finiteOrNull(monitoringRaw.productsSeen),
      lastScanAt: finiteOrNull(monitoringRaw.lastScanAt),
      lastSuccessAt: finiteOrNull(monitoringRaw.lastSuccessAt),
    },
  };
}

export async function fetchRetailerDirectory(): Promise<{ retailers: NetworkRetailer[]; disclaimer: string | null }> {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/retailers`, { headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as DirectoryResponse | null;
  if (!response.ok) throw new Error(`Retailer directory HTTP ${response.status}`);
  return {
    retailers: Array.isArray(payload?.retailers)
      ? payload.retailers.map(retailerRecord).filter((item): item is NetworkRetailer => Boolean(item))
      : [],
    disclaimer: payload?.disclaimer || null,
  };
}

export async function fetchRetailerProfile(retailerId: string): Promise<{ retailer: NetworkRetailer; disclaimer: string | null }> {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/retailers/${encodeURIComponent(retailerId)}`, { headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as ProfileResponse | null;
  if (!response.ok) throw new Error(`Retailer profile HTTP ${response.status}`);
  const retailer = retailerRecord(payload?.retailer);
  if (!retailer) throw new Error('Retailer profile is unavailable.');
  return { retailer, disclaimer: payload?.disclaimer || null };
}