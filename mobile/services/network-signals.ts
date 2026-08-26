import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { getStoredSessionToken } from '@/services/fatedrop-id';

export type NetworkSignalState = 'whisper' | 'echo' | 'manifested' | 'vanished';

export interface NetworkSignal {
  id: string;
  state: NetworkSignalState;
  productId?: string | null;
  offerId?: string | null;
  retailerId?: string | null;
  retailerName?: string | null;
  title: string;
  productType?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  priceGbp?: number;
  rrpGbp?: number;
  markupPercent?: number;
  stockStatus?: string;
  confidence?: number;
  detectedAt?: string;
  reason?: string | null;
  target?: {
    type: 'product';
    productId?: string | null;
    offerId?: string | null;
    retailerId?: string | null;
    productUrl?: string | null;
    query?: string;
  };
}

export type NetworkPulse = Record<NetworkSignalState, number>;

interface NetworkSignalResponse {
  success: boolean;
  count: number;
  generatedAt?: string;
  signals?: NetworkSignal[];
}

type SignalHealthResponse = {
  available?: boolean;
  lifecycle?: Partial<Record<NetworkSignalState, { total?: number; today?: number }>>;
};

type CanonicalAlertWire = {
  id?: string;
  fateStage?: string;
  productId?: string | null;
  offerId?: string | null;
  retailerId?: string | null;
  retailer?: string | null;
  title?: string;
  message?: string | null;
  detectedAt?: string;
  confidence?: number;
  productUrl?: string | null;
  product?: {
    title?: string;
    url?: string | null;
    imageUrl?: string | null;
    pricePence?: number | null;
    rrpPence?: number | null;
  };
  priceIntelligence?: {
    rrpPence?: number | null;
    rrpDeltaPercent?: number | null;
  };
};

type CanonicalAlertResponse = {
  success?: boolean;
  alerts?: CanonicalAlertWire[];
  error?: string;
};

const CANONICAL_SIGNAL_STATES: NetworkSignalState[] = ['whisper', 'echo', 'manifested', 'vanished'];
const DEFAULT_WEB_URL = 'https://fatedrop.co.uk';

function webBaseUrl() {
  return (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, '');
}

function penceToGbp(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) / 100 : undefined;
}

function canonicalState(value: string | undefined): NetworkSignalState | null {
  const state = String(value || '').toLowerCase() as NetworkSignalState;
  return CANONICAL_SIGNAL_STATES.includes(state) ? state : null;
}

function canonicalAlertToSignal(alert: CanonicalAlertWire): NetworkSignal | null {
  const state = canonicalState(alert.fateStage);
  const title = alert.product?.title || alert.title || '';
  if (!alert.id || !state || !title) return null;
  const productUrl = alert.product?.url || alert.productUrl || null;
  const rrpPence = alert.priceIntelligence?.rrpPence ?? alert.product?.rrpPence;
  return {
    id: alert.id,
    state,
    productId: alert.productId ?? null,
    offerId: alert.offerId ?? null,
    retailerId: alert.retailerId ?? null,
    retailerName: alert.retailer ?? null,
    title,
    productUrl,
    imageUrl: alert.product?.imageUrl ?? null,
    priceGbp: penceToGbp(alert.product?.pricePence),
    rrpGbp: penceToGbp(rrpPence),
    markupPercent: Number.isFinite(alert.priceIntelligence?.rrpDeltaPercent)
      ? Number(alert.priceIntelligence?.rrpDeltaPercent)
      : undefined,
    confidence: Number.isFinite(alert.confidence) ? Number(alert.confidence) : undefined,
    detectedAt: alert.detectedAt,
    reason: alert.message ?? null,
    target: {
      type: 'product',
      productId: alert.productId ?? null,
      offerId: alert.offerId ?? null,
      retailerId: alert.retailerId ?? null,
      productUrl,
      query: title,
    },
  };
}

async function fetchSignedInCanonicalAlerts(limit: number): Promise<NetworkSignal[] | null> {
  const token = await getStoredSessionToken();
  if (!token) return null;
  const response = await fetch(`${webBaseUrl()}/api/mobile/alerts?limit=${limit}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null) as CanonicalAlertResponse | null;
  if (!response.ok) throw new Error(data?.error || `Canonical alert inbox HTTP ${response.status}`);
  if (!data?.success || !Array.isArray(data.alerts)) return [];
  return data.alerts.flatMap((alert) => {
    const signal = canonicalAlertToSignal(alert);
    return signal ? [signal] : [];
  });
}

export async function fetchNetworkPulse(days = 7): Promise<NetworkPulse> {
  const safeDays = Math.min(30, Math.max(2, Math.trunc(days)));
  const response = await fetch(`${webBaseUrl()}/api/mobile/signal-health?days=${safeDays}`, {
    headers: { accept: 'application/json' },
  });
  const data = await response.json().catch(() => null) as SignalHealthResponse | null;
  if (!response.ok || data?.available !== true || !data.lifecycle) {
    throw new Error('FateDrop network pulse is temporarily unavailable.');
  }
  return Object.fromEntries(CANONICAL_SIGNAL_STATES.map((state) => {
    const total = Number(data.lifecycle?.[state]?.total);
    return [state, Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0];
  })) as NetworkPulse;
}

export async function fetchPublicNetworkSignals(limit = 100): Promise<NetworkSignal[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/signals?limit=${safeLimit}`);
  if (!response.ok) throw new Error(`Signal feed HTTP ${response.status}`);
  const data = await response.json() as NetworkSignalResponse;
  if (!data.success || !Array.isArray(data.signals)) return [];
  return data.signals.filter((signal): signal is NetworkSignal => Boolean(signal?.id && signal?.title && CANONICAL_SIGNAL_STATES.includes(signal.state)));
}

export async function fetchNetworkSignals(limit = 50): Promise<NetworkSignal[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

  // Signed-in Alerts must use the canonical alert inbox so the app reflects the
  // same persisted alert IDs that Web and delivery telemetry use. Do not silently
  // fall back to raw detections when the canonical inbox is unavailable.
  const canonicalAlerts = await fetchSignedInCanonicalAlerts(safeLimit);
  if (canonicalAlerts) return canonicalAlerts;

  // Signed-out users may still inspect public lifecycle activity. This is a raw
  // network feed and must not be presented as personal/canonical alert history.
  return fetchPublicNetworkSignals(safeLimit);
}
