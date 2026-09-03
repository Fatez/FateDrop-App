import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { getStoredSessionToken } from '@/services/fatedrop-id';

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean };
};

export type MovementWindow = {
  contributors: number;
  eligible: number;
  coveragePct: number | null;
  medianPercent: number | null;
  rising: number;
  falling: number;
  flat: number;
};

export type FatePulseSnapshot = {
  contractVersion: number;
  status: 'available' | 'building';
  reason: string | null;
  source: { name: string; currencyCode: string; priceField: string; lane?: string };
  readiness: {
    canonical: { verifiedCards: number; mappedCards: number; mappingCoveragePct: number | null };
    history: { observations: number; distinctMarketDays: number; latestMarketDay: string | null };
  };
  pulse: null | {
    anchorMarketDay: string;
    evidence: { currentCardCount: number; currentLaneCount: number };
    movement: { d1: MovementWindow; d7: MovementWindow; d30: MovementWindow };
  };
  intelligence: {
    marketHeat: number | null;
    volatility: number | null;
    heatingUp: unknown[];
    coolingDown: unknown[];
    movers: unknown[];
    reason: string;
  };
};

export type FateCollectorsSnapshot = {
  contractVersion: number;
  status: 'empty' | 'partial' | 'available';
  reason: string | null;
  summary: {
    currencyCode: string;
    cardUnits: number;
    setsOwned: number;
    unavailableSetCount: number;
    closestSet: null | {
      setId: string;
      setName: string | null;
      tcgCode: string | null;
      completionPercent: number;
      missingCount: number;
    };
    collection: {
      status: 'available' | 'partial' | 'unavailable';
      knownValue: number;
      totalValue: number | null;
      totalUnits: number;
      pricedUnits: number;
      priceCoveragePercent: number;
    };
  };
  evidence: {
    collectionItemsRead: number;
    verifiedOwnedIdentities: number;
    unresolvedCollectionItemCount: number;
    completeSetValuesConnected: boolean;
    valuationReason: string | null;
  };
};

export class FateMarketApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'FateMarketApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, { authenticated = false, ...init }: RequestInit & { authenticated?: boolean } = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (authenticated) {
    const token = await getStoredSessionToken();
    if (!token) throw new FateMarketApiError('Connect your FateDrop ID to view your collection.', 401, 'AUTH_REQUIRED');
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${SIGNAL_ENGINE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
  let payload: ApiEnvelope<T>;
  try {
    payload = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new FateMarketApiError('Fate Market returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new FateMarketApiError(payload.error?.message || `Fate Market HTTP ${response.status}`, response.status, payload.error?.code || `HTTP_${response.status}`);
  }
  return payload.data;
}

export function fetchFatePulse(tcgCode?: string) {
  const query = tcgCode ? `?tcg=${encodeURIComponent(tcgCode)}` : '';
  return request<FatePulseSnapshot>(`/v1/market/pulse${query}`);
}

export function fetchFateCollectorsSummary() {
  return request<FateCollectorsSnapshot>('/v1/collectors/summary?currency=EUR&language=en&variant=standard', { authenticated:true });
}

export function previewCollectrExport(csvText: string) {
  return request<{
    contractVersion: number;
    mode: 'preview_only';
    writesPerformed: false;
    preview: {
      parsed: { acceptedRows: number; rejectedRows: number };
      matched: { total: number; exact: number; needsConfirmation: number; ambiguous: number; unresolved: number };
      plan: { create: number; update: number; unchanged: number; hold: number; staleSourceRecords: number };
    };
  }>('/v1/collectors/import/collectr/preview', {
    authenticated:true,
    method:'POST',
    body:JSON.stringify({ csvText }),
  });
}

