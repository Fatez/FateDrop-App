import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { invalidateFateCollectorsSummaryCache, type FateCollectorsSnapshot } from '@/services/fate-market';
import { getStoredSessionToken } from '@/services/fatedrop-id';

const CACHE_TTL_MS = 30_000;

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean };
};

export type FateCollectorPersonalMover = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
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

export type FateCollectorPersonalSetMover = {
  setId: string;
  setName: string | null;
  tcgCode: string | null;
  currencyCode: string | null;
  currentValue: number;
  baselineValue: number;
  movementAmount: number;
  movementPercent: number | null;
  eligibleOwnedIdentities: number;
  eligibleOwnedCopies: number;
};

export type FateCollectorPersonalPulsePeriod = {
  status: 'available' | 'building';
  reason: string | null;
  eligibleOwnedIdentities: number;
  risers: FateCollectorPersonalMover[];
  decliners: FateCollectorPersonalMover[];
  setRisers: FateCollectorPersonalSetMover[];
  setDecliners: FateCollectorPersonalSetMover[];
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
  explicitlyTracked?: boolean;
  missingCards?: FateCollectorMissingCard[];
  value?: FateCollectorBinderValue | null;
};

export type FateCollectorPeriodValue = {
  status: 'available' | 'building';
  reason: string | null;
  eligibleIdentities: number;
  eligibleCopies: number;
  coveragePercent: number;
  baselineValue: number | null;
  currentValue: number | null;
  movementAmount: number | null;
  movementPercent: number | null;
};

export type FateCollectorIntelligenceCard = {
  cardIdentityId: string;
  name: string | null;
  tcgCode: string | null;
  setId: string | null;
  setName: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  variantCode: string | null;
  languageCode: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  quantity: number;
  currentUnitPrice: number | null;
  currentKnownValue: number | null;
  currencyCode: string;
  d7: FateCollectorPeriodValue;
  d30: FateCollectorPeriodValue;
};

export type FateCollectorIntelligenceSet = {
  setId: string | null;
  setName: string | null;
  tcgCode: string | null;
  uniqueCards: number;
  totalCopies: number;
  pricedCopies: number;
  unpricedCopies: number;
  priceCoveragePercent: number;
  currentKnownValue: number;
  collectionSharePercent: number;
  d7: FateCollectorPeriodValue;
  d30: FateCollectorPeriodValue;
};

export type FateCollectorIntelligenceSnapshot = {
  contractVersion: 1;
  schemaVersion: 'collector-intelligence:1';
  scope: 'owned_raw_cards_only';
  currencyCode: string;
  snapshot: {
    status: 'available' | 'partial' | 'unavailable';
    reason: string | null;
    currentKnownValue: number;
    totalCopies: number;
    pricedCopies: number;
    unpricedCopies: number;
    priceCoveragePercent: number;
    uniqueCards: number;
    setsRepresented: number;
    topFiveValue: number;
    topFiveSharePercent: number;
  };
  periods: { d7: FateCollectorPeriodValue; d30: FateCollectorPeriodValue };
  history: {
    status: 'available' | 'building';
    reason: string | null;
    pointPolicy: 'stored_market_days_only_no_interpolation';
    includedIdentities: number;
    ownedIdentities: number;
    currentValueCoveragePercent: number;
    points: { marketDay: string; knownValue: number; pricedCopies: number; totalCopies: number; coveragePercent: number }[];
  };
  cards: FateCollectorIntelligenceCard[];
  sets: FateCollectorIntelligenceSet[];
  evidence: {
    ownershipPolicy: 'raw_only';
    movementQuantityPolicy: 'same_current_owned_quantities_at_both_endpoints';
    concentrationIdentityPolicy: 'unique_exact_card_identity_with_quantity_weighted_value';
    acquisitionCostUsed: false;
    missingEvidencePolicy: 'unknown_not_zero';
    exactPriceRuntimeConnected: boolean;
    historyRuntimeConnected: boolean;
    historyIdentityLimit: number;
    historyIncludedIdentities: number;
  };
};

export type FateCollectorSetProgressSnapshot = {
  contractVersion: 2;
  progress: FateCollectorSetBinder & {
    catalogue?: { status: string; reason: string | null; expectedTotal?: number | null; verifiedChecklistCount?: number } | null;
    priceEvidenceConnected?: boolean;
  };
};

export type FateCollectorMissingCard = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  fateCardId: string;
  printingId: string | null;
  setId: string;
  setName: string | null;
  tcgCode: string | null;
  name: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  variantCode: string | null;
  languageCode: string | null;
};

export type FateCollectorValueCoverage = {
  status: 'available' | 'partial' | 'unavailable';
  reason: string | null;
  currencyCode: string;
  totalUnits: number;
  pricedUnits: number;
  unpricedUnits: number;
  priceCoveragePercent: number;
  totalValue: number | null;
  knownValue: number;
};

export type FateCollectorBinderValue = {
  fullSetValue: number | null;
  ownedValue: number | null;
  missingValue: number | null;
  currencyCode: string;
  status?: string;
  reason?: string | null;
};

export type FateCollectorsDashboardSnapshot = Omit<FateCollectorsSnapshot, 'summary' | 'evidence'> & {
  summary: FateCollectorsSnapshot['summary'] & {
    sets?: FateCollectorSetBinder[];
    bindersTracked?: number;
    rawCardUnits?: number;
    gradedCardUnits?: number;
    rawCollection?: FateCollectorValueCoverage;
    gradedCollection?: FateCollectorValueCoverage;
  };
  personalPulse?: {
    schemaVersion: 'collector-personal-pulse:1';
    ownedIdentityCount: number;
    verifiedOwnedIdentityCount: number;
    periods: {
      d7: FateCollectorPersonalPulsePeriod;
      d30: FateCollectorPersonalPulsePeriod;
    };
  };
  evidence: FateCollectorsSnapshot['evidence'] & {
    personalPulseConnected?: boolean;
    gradedCollectionValuesConnected?: boolean;
    binderOwnershipPolicy?: 'raw_only';
    personalMovementPolicy?: 'raw_only';
  };
};

export type FateCollectorCardIdentity = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
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
  grading?: {
    gradingCompany: string;
    gradeLabel: string;
    gradeValue: number | null;
    certificationNumber: string | null;
    certificationStatus: 'unverified' | 'verified' | 'failed' | 'unavailable';
    verificationSource: string | null;
    verifiedAt: number | null;
  } | null;
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
let dashboardGeneration = 0;
let intelligenceCache: { token: string; cachedAt: number; data: FateCollectorIntelligenceSnapshot } | null = null;
let intelligenceFlight: { token: string; promise: Promise<FateCollectorIntelligenceSnapshot> } | null = null;

async function authenticatedRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new FateCollectorApiError('Connect your FateDrop ID to use Fate Collections.', 401, 'AUTH_REQUIRED');
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
    throw new FateCollectorApiError('Fate Collections returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new FateCollectorApiError(payload.error?.message || `Fate Collections HTTP ${response.status}`, response.status, payload.error?.code || `HTTP_${response.status}`);
  }
  return { data: payload.data, token };
}

export function invalidateFateCollectorCache() {
  dashboardGeneration += 1;
  dashboardCache = null;
  dashboardFlight = null;
  intelligenceCache = null;
  intelligenceFlight = null;
  invalidateFateCollectorsSummaryCache();
}

export async function fetchFateCollectorDashboard({ force = false }: { force?: boolean } = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new FateCollectorApiError('Connect your FateDrop ID to view your collection.', 401, 'AUTH_REQUIRED');
  if (!force && dashboardCache?.token === token && Date.now() - dashboardCache.cachedAt < CACHE_TTL_MS) return dashboardCache.data;
  if (dashboardFlight?.token === token) return dashboardFlight.promise;
  const generation = dashboardGeneration;
  const promise = authenticatedRequest<FateCollectorsDashboardSnapshot>('/v1/collectors/summary?currency=GBP&language=en&variant=standard')
    .then(({ data }) => {
      if (generation === dashboardGeneration) dashboardCache = { token, cachedAt: Date.now(), data };
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

export async function fetchFateCollectorIntelligence({ force = false }: { force?: boolean } = {}) {
  const token = await getStoredSessionToken();
  if (!token) throw new FateCollectorApiError('Connect your FateDrop ID to understand your collection.', 401, 'AUTH_REQUIRED');
  if (!force && intelligenceCache?.token === token && Date.now() - intelligenceCache.cachedAt < CACHE_TTL_MS) return intelligenceCache.data;
  if (intelligenceFlight?.token === token) return intelligenceFlight.promise;
  const generation = dashboardGeneration;
  const promise = authenticatedRequest<FateCollectorIntelligenceSnapshot>('/v1/collectors/intelligence?currency=GBP')
    .then(({ data }) => {
      if (generation === dashboardGeneration) intelligenceCache = { token, cachedAt: Date.now(), data };
      return data;
    })
    .finally(() => {
      if (intelligenceFlight?.promise === promise) intelligenceFlight = null;
    });
  intelligenceFlight = { token, promise };
  return promise;
}

export async function fetchFateCollectorSetProgress(setId: string) {
  const id = setId.trim();
  if (!id) throw new FateCollectorApiError('Choose a verified set first.', 400, 'SET_IDENTITY_REQUIRED');
  const { data } = await authenticatedRequest<FateCollectorSetProgressSnapshot>(`/v1/collectors/sets/${encodeURIComponent(id)}/progress?currency=GBP&language=en&variant=standard`);
  return data;
}

export async function setFateCollectorBinderTracked(setId: string, tracked: boolean) {
  const id = setId.trim();
  if (!id) throw new FateCollectorApiError('Choose a verified set first.', 400, 'SET_IDENTITY_REQUIRED');
  const { data } = await authenticatedRequest<{ contractVersion: 1; binder: { setId: string; tracked: boolean } }>(`/v1/collectors/binders/${encodeURIComponent(id)}`, {
    method: tracked ? 'PUT' : 'DELETE',
  });
  invalidateFateCollectorCache();
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

export async function updateFateCollectorItemQuantity(itemId: string, quantity: number, expectedRevision: number) {
  const id = itemId.trim();
  const nextQuantity = Math.trunc(quantity);
  if (!id) throw new FateCollectorApiError('Choose a collection item first.', 400, 'COLLECTION_ITEM_REQUIRED');
  if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > 999) throw new FateCollectorApiError('Quantity must be between 1 and 999.', 400, 'COLLECTION_QUANTITY_INVALID');
  const { data } = await authenticatedRequest<{ item: FateCollectorItem }>(`/v1/collection/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity: nextQuantity, expectedRevision }),
  });
  invalidateFateCollectorCache();
  return data.item;
}

export async function previewCollectrCsv(csvText: string) {
  const csv = csvText.trim();
  if (!csv) throw new FateCollectorApiError('Choose a collection CSV export first.', 400, 'COLLECTR_CSV_REQUIRED');
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
