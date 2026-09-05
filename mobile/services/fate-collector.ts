import { SIGNAL_ENGINE_URL } from '@/constants/api';
import type { FateCollectorsSnapshot } from '@/services/fate-market';
import { getStoredSessionToken } from '@/services/fatedrop-id';

const CACHE_TTL_MS = 30_000;

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean };
};

export type FateCollectorPersonalMover = {
  cardIdentityId: string;
  name: string | null;
  tcgCode: string | null;
  setId: string | null;
  setName: string | null;
  collectorNumber: string | null;
  variantCode: string | null;
  languageCode: string | null;
  quantity: number;
  currentPrice: number | null;
  currencyCode: string | null;
  movementAmount: number | null;
  movementPercent: number | null;
};

export type FateCollectorPersonalPulsePeriod = {
  status: 'available' | 'building';
  reason: string | null;
  eligibleOwnedIdentities: number;
  risers: FateCollectorPersonalMover[];
  decliners: FateCollectorPersonalMover[];
};

export type FateCollectorSetBinder = {
  setId: string;
  setName: string | null;
  tcgCode: string | null;
  status: 'available' | 'unavailable';
  reason: string | null;
  ownedCount: number | null;
  totalCount: number | null;
  missingCount: number | null;
  completionPercent: number | null;
};

export type FateCollectorsDashboardSnapshot = Omit<FateCollectorsSnapshot, 'summary' | 'evidence'> & {
  summary: FateCollectorsSnapshot['summary'] & { sets?: FateCollectorSetBinder[] };
  personalPulse?: {
    schemaVersion: 'collector-personal-pulse:1';
    ownedIdentityCount: number;
    verifiedOwnedIdentityCount: number;
    periods: {
      d7: FateCollectorPersonalPulsePeriod;
      d30: FateCollectorPersonalPulsePeriod;
    };
  };
  evidence: FateCollectorsSnapshot['evidence'] & { personalPulseConnected?: boolean };
};

export type FateCollectorCardIdentity = {
  fateCardId: string;
  tcgCode: string | null;
  setId: string | null;
  setName: string | null;
  name: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  supertype: string | null;
  variantCode: string | null;
  languageCode: string | null;
};

export type FateCollectorItem = {
  id: string;
  fateCardId: string;
  quantity: number;
  tradeQuantity: number;
  availableToTrade: boolean;
  copyState: 'raw' | 'graded';
  conditionCode: string | null;
  revision: number;
  card?: FateCollectorCardIdentity | null;
};

export type FateCollectorCollectionSnapshot = {
  items: FateCollectorItem[];
  wants: unknown[];
  summary: {
    ownedLots: number;
    totalCopies: number;
    tradeableCopies: number;
    wantedCards: number;
  };
};

export type CollectrPreview = {
  contractVersion: number;
  mode: 'preview_only';
  writesPerformed: false;
  requiresUserConfirmation: boolean;
  confirmationToken: string;
  preview: {
    confirmationToken?: string;
    parsed: { acceptedRows: number; rejectedRows: number };
    matched: { total: number; exact: number; needsConfirmation: number; ambiguous: number; unresolved: number };
    plan: { create: number; update: number; unchanged: number; hold: number; staleSourceRecords: number };
    scale?: { mayBeTruncated: boolean };
  };
};

export type CollectrConfirmResult = {
  contractVersion: number;
  mode: 'confirmed_import';
  confirmed: true;
  duplicate: boolean;
  writesPerformed: boolean;
  importBatchKey: string | null;
  summary: {
    created: number;
    updated: number;
    unchanged: number;
    held: number;
    staleSourceRecords: number;
    rejectedCsvRows: number;
  };
};

export class FateCollectorApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'FateCollectorApiError';
    this.status = status;
    this.code = code;
  }
}

let dashboardCache: { token: string; cachedAt: number; data: FateCollectorsDashboardSnapshot } | null = null;
let dashboardFlight: { token: string; promise: Promise<FateCollectorsDashboardSnapshot> } | null = null;

async function authenticatedRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new FateCollectorApiError('Connect your FateDrop ID to use FateCollector.', 401, 'AUTH_REQUIRED');
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  if (init.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${SIGNAL_ENGINE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
  let payload: ApiEnvelope<T>;
  try {
    payload = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new FateCollectorApiError('FateCollector returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new FateCollectorApiError(payload.error?.message || `FateCollector HTTP ${response.status}`, response.status, payload.error?.code || `HTTP_${response.status}`);
  }
  return { data: payload.data, token };
}

export function invalidateFateCollectorCache() {
  dashboardCache = null;
  dashboardFlight = null;
}

export async function fetchFateCollectorDashboard({ force = false }: { force?: boolean } = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new FateCollectorApiError('Connect your FateDrop ID to view your collection.', 401, 'AUTH_REQUIRED');
  if (!force && dashboardCache?.token === token && Date.now() - dashboardCache.cachedAt < CACHE_TTL_MS) return dashboardCache.data;
  if (dashboardFlight?.token === token) return dashboardFlight.promise;
  const promise = authenticatedRequest<FateCollectorsDashboardSnapshot>('/v1/collectors/summary?currency=GBP&language=en&variant=standard')
    .then(({ data }) => {
      dashboardCache = { token, cachedAt: Date.now(), data };
      return data;
    })
    .finally(() => {
      if (dashboardFlight?.promise === promise) dashboardFlight = null;
    });
  dashboardFlight = { token, promise };
  return promise;
}

export async function fetchFateCollectorCollection({ limit = 2000 }: { limit?: number } = {}) {
  const safeLimit = Math.min(2000, Math.max(1, Math.trunc(limit || 2000)));
  const { data } = await authenticatedRequest<FateCollectorCollectionSnapshot>(`/v1/collection?limit=${safeLimit}`);
  return data;
}

export async function addExactCardToCollector(cardIdentityId: string, {
  quantity = 1,
  conditionCode = 'unknown',
}: { quantity?: number; conditionCode?: string } = {}) {
  const id = cardIdentityId.trim();
  if (!id) throw new FateCollectorApiError('Choose an exact card before adding it.', 400, 'CARD_IDENTITY_REQUIRED');
  const { data } = await authenticatedRequest<{ item: FateCollectorItem }>('/v1/collection/items', {
    method: 'POST',
    body: JSON.stringify({ fateCardId: id, quantity, copyState: 'raw', conditionCode }),
  });
  invalidateFateCollectorCache();
  return data.item;
}

export async function previewCollectrCsv(csvText: string) {
  const csv = csvText.trim();
  if (!csv) throw new FateCollectorApiError('Choose a Collectr CSV export first.', 400, 'COLLECTR_CSV_REQUIRED');
  const { data } = await authenticatedRequest<CollectrPreview>('/v1/collectors/import/collectr/preview', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
  return data;
}

export async function confirmCollectrCsv(csvText: string, confirmationToken: string) {
  const token = confirmationToken.trim();
  if (!token) throw new FateCollectorApiError('Preview this CSV before importing it.', 400, 'COLLECTR_CONFIRMATION_TOKEN_REQUIRED');
  const { data } = await authenticatedRequest<CollectrConfirmResult>('/v1/collectors/import/collectr/confirm', {
    method: 'POST',
    body: JSON.stringify({ csvText, confirmationToken: token, confirmed: true }),
  });
  invalidateFateCollectorCache();
  return data;
}
