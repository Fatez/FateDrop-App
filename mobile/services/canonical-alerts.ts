import { getStoredSessionToken } from '@/services/fatedrop-id';

const DEFAULT_WEB_URL = 'https://fate-drop.com';

export type CanonicalAlertStage = 'WHISPER' | 'ECHO' | 'MANIFESTED' | 'VANISHED';
export type ProductAlertCategory = 'SEALED_TCG' | 'SINGLE_CARD' | 'ACCESSORY' | 'MERCHANDISE' | 'UNKNOWN';

export type CanonicalMobileAlert = {
  id: string;
  fateStage: CanonicalAlertStage;
  title: string;
  message: string;
  retailer: string;
  detectedAt: string;
  observedDurationSeconds: number | null;
  productIntelligence: {
    category: ProductAlertCategory;
    subcategory: string;
    confidence: number;
    evidence: string[];
  };
  confidence: number;
  productUrl: string;
  product: {
    title: string;
    productType: string | null;
    url: string;
    imageUrl: string | null;
    pricePence: number | null;
    rrpPence: number | null;
    deliveredPricePence: number | null;
  };
  priceIntelligence: {
    rrpPence: number | null;
    rrpDeltaPercent: number | null;
    verdict: 'LOWEST_KNOWN' | 'BETTER_OFFER_FOUND' | 'NO_FAIR_COMPARISON';
    lowestKnown: {
      retailer: string | null;
      comparisonPricePence: number | null;
      url: string | null;
    } | null;
  };
  delivery?: {
    discord?: {
      status: 'sent' | 'failed' | 'skipped';
      attemptedAt: string;
      issue: string | null;
    };
  };
};

type CanonicalAlertResponse = {
  success?: boolean;
  alerts?: CanonicalMobileAlert[];
  error?: string;
};

function baseUrl() {
  return (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, '');
}

export async function fetchCanonicalAlerts(limit = 30): Promise<CanonicalMobileAlert[]> {
  const token = await getStoredSessionToken();
  if (!token) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await fetch(`${baseUrl()}/api/mobile/alerts?limit=${safeLimit}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null) as CanonicalAlertResponse | null;
  if (!response.ok) throw new Error(data?.error || `Alert inbox HTTP ${response.status}`);
  if (!data?.success || !Array.isArray(data.alerts)) return [];
  return data.alerts.filter((alert) => Boolean(alert?.id && alert?.title && alert?.fateStage));
}
