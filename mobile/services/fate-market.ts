import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { getStoredSessionToken } from '@/services/fatedrop-id';

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean };
};

const MARKET_SNAPSHOT_TTL_MS = 30_000;
type SnapshotCache<T> = { cachedAt: number; data: T };
const pulseCache = new Map<string, SnapshotCache<FatePulseSnapshot>>();
const pulseFlights = new Map<string, Promise<FatePulseSnapshot>>();
const fatePriceCache = new Map<string, SnapshotCache<FatePriceSnapshot>>();
const fatePriceFlights = new Map<string, Promise<FatePriceSnapshot>>();
const fatePriceHistoryCache = new Map<string, SnapshotCache<FatePriceHistorySnapshot>>();
const fatePriceHistoryFlights = new Map<string, Promise<FatePriceHistorySnapshot>>();
let collectorsCache: (SnapshotCache<FateCollectorsSnapshot> & { token: string }) | null = null;
let collectorsFlight: { token: string; promise: Promise<FateCollectorsSnapshot> } | null = null;

export type MovementWindow = {
  contributors: number;
  eligible: number;
  coveragePct: number | null;
  medianPercent: number | null;
  rising: number;
  falling: number;
  flat: number;
};

export type FatePulseRankedSet = {
  key: string;
  tcgCode: string | null;
  setCode: string | null;
  setName: string | null;
  expectedCardCount: number | null;
  pricedCardCount: number;
  baselineCardCount: number;
  currentPriceCoveragePct: number | null;
  baselineCoveragePct: number | null;
  currentBasketValue: number | null;
  baselineBasketValue: number | null;
  movementAmount: number | null;
  movementPercent: number | null;
};

export type FatePulseRankedCard = {
  cardIdentityId: string;
  sourceVariantKey: string;
  name: string | null;
  tcgCode: string | null;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  currentPrice: number | null;
  movementAmount: number | null;
  movementPercent: number | null;
};

export type FatePulseDirectionPeriod = {
  status: 'available' | 'building';
  reason: string | null;
  condition: 'broadly_rising' | 'broadly_falling' | 'mixed' | 'unchanged' | 'insufficient_evidence';
  headlinePercent: number | null;
  breadth: { risingSets: number; unchangedSets: number; fallingSets: number };
  coverage: {
    trackedSets: number;
    qualifyingSets: number;
    excludedSets: number;
    setsWithDeclaredTotals: number;
    expectedCards: number;
    pricedCards: number;
    baselineCards: number;
    currentPriceCoveragePct: number | null;
    exactBaselineCoveragePct: number | null;
  };
  setRisers: FatePulseRankedSet[];
  setDecliners: FatePulseRankedSet[];
  cardRisers: FatePulseRankedCard[];
  cardDecliners: FatePulseRankedCard[];
};

export type FatePulseDirection = {
  schemaVersion: 'market-pulse-direction:1';
  method: 'median_qualifying_set_basket_return';
  minimumSetCoveragePct: number;
  rankingLimit: number;
  periods: { d1: FatePulseDirectionPeriod; d7: FatePulseDirectionPeriod; d30: FatePulseDirectionPeriod };
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
    direction?: FatePulseDirection;
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

export type FatePriceCard = {
  id: string;
  fateCardId: string;
  tcgCode: string | null;
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

export type FatePriceScope = {
  currencyCode: string | null;
  marketSegmentKey: string;
  conditionCode: string;
};

export type FatePriceMovement = {
  available: boolean;
  reason?: string;
  targetAsOf?: number;
  days?: number;
  fromAmount?: number;
  toAmount?: number;
  absolute?: number;
  percent?: number;
  fromAsOf?: number;
  toAsOf?: number;
};

export type FatePriceSnapshot = {
  contractVersion: number;
  policyVersion: string;
  cardIdentityId: string;
  available: boolean;
  reason: string | null;
  marketScope: FatePriceScope | null;
  price: null | {
    amount: number;
    currencyCode: string;
    fairLow: number;
    fairHigh: number;
    guideLow: number | null;
    asOf: number;
  };
  movement: { d7: FatePriceMovement; d30: FatePriceMovement };
  confidence: null | {
    level: 'low' | 'medium' | 'high';
    reasons: string[];
    sourceCount: number;
    spreadPercent: number | null;
    ageHours: number;
  };
  evidence: {
    availableScopes: FatePriceScope[];
    requestedScope: null | {
      currencyCode: string | null;
      marketSegmentKey: string | null;
      conditionCode: string | null;
    };
    sourceCount: number;
    sources: string[];
    centralSignals?: string[];
    centralPolicy?: string;
    lowestListingUsedInCentralPrice?: false;
    sourceEstimates?: Array<{
      sourceName: string;
      asOf: number;
      estimate: number;
      rangeLow: number;
      rangeHigh: number;
      guideLow: number | null;
      signals: Array<{ field: string; value: number }>;
    }>;
  };
};

export type FatePriceHistoryDays = 7 | 30 | 90;

export type FatePriceHistoryPoint = {
  marketDay: string;
  asOf: number;
  amount: number;
  currencyCode: string;
  fairLow: number;
  fairHigh: number;
  guideLow: number | null;
  confidence: 'low' | 'medium' | 'high';
  sourceCount: number;
};

export type FatePriceHistorySnapshot = {
  contractVersion: number;
  policyVersion: string;
  cardIdentityId: string;
  available: boolean;
  reason: string | null;
  days: FatePriceHistoryDays;
  marketScope: FatePriceScope | null;
  points: FatePriceHistoryPoint[];
  evidence: {
    availableScopes: FatePriceScope[];
    requestedScope: null | {
      currencyCode: string | null;
      marketSegmentKey: string | null;
      conditionCode: string | null;
    };
    pointPolicy: 'stored_market_days_only_no_interpolation';
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

async function request<T>(path: string, { authenticated = false, authorizationToken, ...init }: RequestInit & { authenticated?: boolean; authorizationToken?: string } = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (authenticated) {
    const token = authorizationToken || await getStoredSessionToken();
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

export function fetchFatePulse(tcgCode?: string, { force = false }: { force?: boolean } = {}) {
  const query = tcgCode ? `?tcg=${encodeURIComponent(tcgCode)}` : '';
  const key = tcgCode || 'all';
  const cached = pulseCache.get(key);
  if (!force && cached && Date.now() - cached.cachedAt < MARKET_SNAPSHOT_TTL_MS) return Promise.resolve(cached.data);
  const active = pulseFlights.get(key);
  if (active) return active;
  const flight = request<FatePulseSnapshot>(`/v1/market/pulse${query}`).then((data) => {
    pulseCache.set(key, { cachedAt: Date.now(), data });
    return data;
  }).finally(() => {
    if (pulseFlights.get(key) === flight) pulseFlights.delete(key);
  });
  pulseFlights.set(key, flight);
  return flight;
}

function fatePriceScopeQuery(scope?: Partial<FatePriceScope> | null) {
  const params: string[] = [];
  if (scope?.currencyCode) params.push(`currency=${encodeURIComponent(scope.currencyCode)}`);
  if (scope?.marketSegmentKey) params.push(`marketSegment=${encodeURIComponent(scope.marketSegmentKey)}`);
  if (scope?.conditionCode) params.push(`condition=${encodeURIComponent(scope.conditionCode)}`);
  return params.length ? `?${params.join('&')}` : '';
}

export function fetchFatePrice(cardIdentityId: string, {
  force = false,
  scope = null,
}: { force?: boolean; scope?: Partial<FatePriceScope> | null } = {}) {
  const id = cardIdentityId.trim();
  if (!id) return Promise.reject(new FateMarketApiError('Choose an exact card first.', 400, 'CARD_IDENTITY_REQUIRED'));
  const query = fatePriceScopeQuery(scope);
  const key = `${id}${query}`;
  const cached = fatePriceCache.get(key);
  if (!force && cached && Date.now() - cached.cachedAt < MARKET_SNAPSHOT_TTL_MS) return Promise.resolve(cached.data);
  const active = fatePriceFlights.get(key);
  if (active) return active;
  const flight = request<{ fatePrice: FatePriceSnapshot }>(`/v1/fate-price/${encodeURIComponent(id)}${query}`).then(({ fatePrice }) => {
    fatePriceCache.set(key, { cachedAt: Date.now(), data: fatePrice });
    return fatePrice;
  }).finally(() => {
    if (fatePriceFlights.get(key) === flight) fatePriceFlights.delete(key);
  });
  fatePriceFlights.set(key, flight);
  return flight;
}

export function fetchFatePriceHistory(cardIdentityId: string, {
  days = 30,
  force = false,
  scope = null,
}: { days?: FatePriceHistoryDays; force?: boolean; scope?: Partial<FatePriceScope> | null } = {}) {
  const id = cardIdentityId.trim();
  if (!id) return Promise.reject(new FateMarketApiError('Choose an exact card first.', 400, 'CARD_IDENTITY_REQUIRED'));
  const scopeQuery = fatePriceScopeQuery(scope);
  const query = `${scopeQuery || '?'}${scopeQuery ? '&' : ''}days=${days}`;
  const key = `${id}${query}`;
  const cached = fatePriceHistoryCache.get(key);
  if (!force && cached && Date.now() - cached.cachedAt < MARKET_SNAPSHOT_TTL_MS) return Promise.resolve(cached.data);
  const active = fatePriceHistoryFlights.get(key);
  if (active) return active;
  const flight = request<{ history: FatePriceHistorySnapshot }>(`/v1/fate-price/${encodeURIComponent(id)}/history${query}`).then(({ history }) => {
    fatePriceHistoryCache.set(key, { cachedAt: Date.now(), data: history });
    return history;
  }).finally(() => {
    if (fatePriceHistoryFlights.get(key) === flight) fatePriceHistoryFlights.delete(key);
  });
  fatePriceHistoryFlights.set(key, flight);
  return flight;
}

export function searchFatePriceCards({
  query = '',
  setId = '',
  limit = 60,
}: { query?: string; setId?: string; limit?: number } = {}) {
  const params = [`limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`];
  if (query.trim()) params.push(`q=${encodeURIComponent(query.trim())}`);
  if (setId.trim()) params.push(`setId=${encodeURIComponent(setId.trim())}`);
  return request<{ cards: FatePriceCard[]; count: number }>(`/v1/fate-price/cards?${params.join('&')}`);
}

export function fetchFatePriceCard(cardIdentityId: string) {
  return request<{ card: FatePriceCard }>(`/v1/fate-price/cards/${encodeURIComponent(cardIdentityId.trim())}`);
}

export async function fetchFateCollectorsSummary({ force = false }: { force?: boolean } = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new FateMarketApiError('Connect your FateDrop ID to view your collection.', 401, 'AUTH_REQUIRED');
  if (!force && collectorsCache?.token === token && Date.now() - collectorsCache.cachedAt < MARKET_SNAPSHOT_TTL_MS) return collectorsCache.data;
  if (collectorsFlight?.token === token) return collectorsFlight.promise;
  const promise = request<FateCollectorsSnapshot>('/v1/collectors/summary?currency=EUR&language=en&variant=standard', {
    authenticated:true,
    authorizationToken:token,
  }).then((data) => {
    collectorsCache = { token, cachedAt:Date.now(), data };
    return data;
  }).finally(() => {
    if (collectorsFlight?.promise === promise) collectorsFlight = null;
  });
  collectorsFlight = { token, promise };
  return promise;
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
