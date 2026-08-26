import { FATEDROP_WEB_URL } from '@/constants/api';
import { getStoredSessionToken } from '@/services/fatedrop-id';

export type FateTraderSeries = {
  id: string;
  tcgCode: string;
  name: string;
  verificationStatus: string;
};

export type FateTraderSet = {
  id: string;
  tcgCode: string;
  seriesId: string;
  seriesName: string | null;
  name: string;
  printedTotal: number | null;
  total: number | null;
  releasedAt: number | null;
  verificationStatus: string;
};

export type FateTraderCard = {
  id: string;
  fateCardId: string;
  tcgCode: string;
  seriesId: string;
  seriesName: string | null;
  setId: string;
  setName: string | null;
  printingId: string;
  name: string | null;
  collectorNumber: string;
  rarity: string | null;
  supertype: string | null;
  variantCode: string;
  languageCode: string;
  verificationStatus: string;
  verifiedAt: number | null;
};

export type FateTraderBinder = {
  id: string;
  tcgId: string;
  name: string;
  visibility: 'private' | 'network' | string;
  status: 'active' | 'paused' | string;
  localTradeAllowed: boolean;
  postalTradeAllowed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type FateTraderBinderItem = {
  id: string;
  fateCardId: string;
  status: string;
  effectiveAvailable?: boolean;
  staleReason?: string | null;
  tradeMode?: string;
  visibility?: string;
  localTradeAllowed?: boolean;
  postalTradeAllowed?: boolean;
  revision?: number;
};

export type FateTraderBinderSnapshot = {
  binder?: FateTraderBinder | null;
  items?: FateTraderBinderItem[];
};

export type FateTraderWantsSnapshot = {
  wants?: Array<{
    fateCardId: string;
    quantity: number;
    active?: boolean;
    constraints?: unknown;
  }>;
  count?: number;
};

export type FateTraderCollectionItem = {
  id: string;
  revision: number;
  fateCardId?: string;
};

export type FateTraderFinderCard = {
  fateCardId: string;
  name: string | null;
  collectorNumber: string | null;
  variantCode: string | null;
  languageCode: string | null;
  setName: string | null;
};

export type FateTraderOpportunity = {
  id: string;
  opportunityClass: 'exact' | 'strong' | 'potential' | string;
  headline: string;
  score: number;
  scoreBreakdown?: Record<string, number>;
  targetRelation?: string;
  verifiedReciprocal?: boolean;
  compatibleReciprocal?: boolean;
  fateTradeFoundEligible?: boolean;
  targetQuantitySatisfied?: boolean;
  evidence?: string[];
  commonTradeMethods?: string[];
  targetCardId?: string;
  offeredTargetCardId?: string;
  candidateOfferId?: string | null;
  reciprocalMatchCount?: number;
  card?: FateTraderFinderCard | null;
};

export type FateTraderFinderSnapshot = {
  opportunities: FateTraderOpportunity[];
  count: number;
  searchedWants: number;
  networkOffersConsidered: number;
};

export type FateTraderEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  };
  meta?: { requestId?: string | null; apiVersion?: string };
};

export class FateTraderApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, { status, code, retryable = false }: { status: number; code: string; retryable?: boolean }) {
    super(message);
    this.name = 'FateTraderApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function traderUrl(path: string) {
  return `${FATEDROP_WEB_URL.replace(/\/+$/, '')}/api/trader/${path.replace(/^\/+/, '')}`;
}

async function traderRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getStoredSessionToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init?.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(traderUrl(path), {
    ...init,
    cache: 'no-store',
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  let payload: FateTraderEnvelope<T>;
  try {
    payload = await response.json() as FateTraderEnvelope<T>;
  } catch {
    throw new FateTraderApiError('Fate Trader returned an invalid response.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }

  if (!response.ok || !payload.ok) {
    throw new FateTraderApiError(
      payload.error?.message || `Fate Trader HTTP ${response.status}`,
      {
        status: response.status,
        code: payload.error?.code || `HTTP_${response.status}`,
        retryable: Boolean(payload.error?.retryable),
      },
    );
  }

  if (payload.data === undefined) {
    throw new FateTraderApiError('Fate Trader returned no data.', {
      status: response.status,
      code: 'EMPTY_RESPONSE',
    });
  }
  return payload.data;
}

export function fetchTraderSeries() {
  return traderRequest<{ series: FateTraderSeries[]; count: number }>('card-series?tcg=pokemon');
}

export function fetchTraderSets(seriesId: string) {
  return traderRequest<{ sets: FateTraderSet[]; count: number }>(`card-sets?seriesId=${encodeURIComponent(seriesId)}`);
}

export function searchTraderCards({ query = '', setId = '', limit = 100 }: { query?: string; setId?: string; limit?: number } = {}) {
  const params = [`limit=${Math.max(1, Math.min(500, Math.trunc(limit)))}`];
  if (query.trim()) params.push(`q=${encodeURIComponent(query.trim())}`);
  if (setId.trim()) params.push(`setId=${encodeURIComponent(setId.trim())}`);
  return traderRequest<{ cards: FateTraderCard[]; count: number }>(`cards?${params.join('&')}`);
}

export function fetchTraderSetCards(setId: string) {
  return traderRequest<{ cards: FateTraderCard[]; count: number }>(`card-sets/${encodeURIComponent(setId)}/cards?limit=500`);
}

export function fetchTraderBinder() {
  return traderRequest<FateTraderBinderSnapshot>('binder?tcg=pokemon');
}

export function patchTraderBinderSettings(input: {
  visibility?: 'private' | 'network';
  status?: 'active' | 'paused';
  localTradeAllowed?: boolean;
  postalTradeAllowed?: boolean;
}) {
  return traderRequest<{ binder: FateTraderBinder }>('binder?tcg=pokemon', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function fetchTraderStructuredWants() {
  return traderRequest<FateTraderWantsSnapshot>('structured-wants');
}

export function fetchTraderFinder(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return traderRequest<FateTraderFinderSnapshot>(`finder?limit=${safeLimit}`);
}

export function createTraderCollectionItem(input: Record<string, unknown>) {
  return traderRequest<{ item: FateTraderCollectionItem }>('collection/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTraderCollectionItem(itemId: string, expectedRevision: number) {
  return traderRequest<{ removed: true }>(`collection/items/${encodeURIComponent(itemId)}?expectedRevision=${encodeURIComponent(String(expectedRevision))}`, {
    method: 'DELETE',
  });
}

export function createTraderBinderItem(input: Record<string, unknown>) {
  return traderRequest<{ item: FateTraderBinderItem }>('binder/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function putTraderExactWant(fateCardId: string, input: { quantity: number; active: boolean }) {
  return traderRequest<{ want: unknown }>(`wants/${encodeURIComponent(fateCardId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function putTraderStructuredWant(fateCardId: string, input: Record<string, unknown>) {
  return traderRequest<{ constraints: unknown }>(`structured-wants/${encodeURIComponent(fateCardId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function fateTraderCardLabel(card: FateTraderCard) {
  const name = card.name || 'Unknown card';
  const number = card.collectorNumber ? ` #${card.collectorNumber}` : '';
  const variant = card.variantCode && card.variantCode !== 'standard'
    ? ` · ${card.variantCode.replaceAll('-', ' ')}`
    : '';
  return `${name}${number}${variant}`;
}
