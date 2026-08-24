import { SIGNAL_ENGINE_URL } from '@/constants/api';

export type NetworkRetailerClass = 'independent' | 'specialist' | 'regional' | 'national' | 'event_vendor' | string;

export type NetworkRetailer = {
  id: string;
  name: string;
  websiteUrl: string | null;
  retailerClass: NetworkRetailerClass;
  verification: string;
  tcgs: string[];
  online: boolean;
  physicalStores: boolean | null;
  physicalLocations: number | null;
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
  retailers?: NetworkRetailer[];
  disclaimer?: string;
};

export async function fetchRetailerDirectory(): Promise<{ retailers: NetworkRetailer[]; disclaimer: string | null }> {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/retailers`, { headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as DirectoryResponse | null;
  if (!response.ok) throw new Error(`Retailer directory HTTP ${response.status}`);
  return {
    retailers: Array.isArray(payload?.retailers) ? payload.retailers : [],
    disclaimer: payload?.disclaimer || null,
  };
}
