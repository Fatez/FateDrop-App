import AsyncStorage from '@react-native-async-storage/async-storage';

import { FATEDROP_WEB_URL } from '@/constants/api';
import {
  CANONICAL_ALERT_STAGES,
  countUnreadCanonicalAlertsByStageFromState,
  markCanonicalAlertStageSeenInState,
  normalizeCanonicalAlertReadState,
  type CanonicalAlertReadItem,
  type CanonicalAlertReadState,
} from '@/lib/canonical-alert-read-state';
import { getStoredSessionToken } from '@/services/fatedrop-id';

const ALERT_READ_STATE_PREFIX = 'fatedrop:canonical-alerts:read:v1';

export type CanonicalAlertStage = 'WHISPER' | 'ECHO' | 'MANIFESTED' | 'VANISHED';

type CanonicalAlertQueryState = 'whisper' | 'echo' | 'manifested' | 'vanished';
const CANONICAL_ALERT_QUERY_STATES: readonly CanonicalAlertQueryState[] = ['whisper', 'echo', 'manifested', 'vanished'];

export type CanonicalAlertPresentation = {
  referenceKind: string | null;
  referenceBasis: string | null;
  sourceMarket: string | null;
  sourceCurrency: string | null;
  sourceMsrp: string | null;
};

export type CanonicalAlertLiveWindow = {
  manifestedAt: string | null;
  lastConfirmedLiveAt: string | null;
  vanishedAt: string | null;
  observedDurationSeconds: number | null;
  historyComplete: boolean;
};

export type CanonicalAlertOpportunity = {
  eventKind: 'listing_discovered' | 'evidence_changed' | 'retailer_behaviour_changed' | 'availability_started' | 'new_retailer_available' | 'availability_ended';
  current: boolean;
  currentViewKind: 'still_available' | null;
  firstManifestedAt: string | null;
  lastVerifiedAt: string | null;
};

export type CanonicalAlertFacets = {
  version: number;
  languageGroup: 'english' | 'japanese' | 'korean' | 'simplified_chinese' | 'traditional_chinese' | 'other' | 'unknown';
  languageCode: string | null;
  marketCode: string | null;
  marketGroup?: 'english' | 'japanese' | 'korean' | 'simplified_chinese' | 'traditional_chinese' | 'other' | 'unknown';
  marketStatus?: 'verified' | 'reused' | 'candidate' | 'unknown' | 'conflict';
  languageLabel: string;
  setKey: string | null;
  setName: string | null;
  confidence: { language: number; market?: number; set: number };
  source: { language: string; market?: string; set: string };
};

export type CanonicalMobileAlert = {
  id: string;
  tcgCode: string;
  fateStage: CanonicalAlertStage;
  productId: string;
  offerId: string;
  retailerId: string;
  title: string;
  message: string;
  signalKind: string | null;
  deliveryPolicy: 'interrupt' | 'inbox_only' | 'history_only' | 'anomaly_quarantine';
  interruptEligible: boolean;
  facets: CanonicalAlertFacets;
  retailer: string;
  detectedAt: string;
  liveWindow?: CanonicalAlertLiveWindow | null;
  opportunity?: CanonicalAlertOpportunity | null;
  confidence: number;
  productUrl: string;
  product: {
    title: string;
    url: string;
    imageUrl: string | null;
    pricePence: number | null;
    rrpPence: number | null;
    deliveredPricePence: number | null;
    stockStatus: string | null;
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
  preparedLinks?: {
    primary?: {
      stockStatus?: string | null;
    };
  };
  presentation?: CanonicalAlertPresentation | null;
  delivery?: {
    discord: {
      status: string;
      attemptedAt: string | null;
      issue: string | null;
      providerMessageId: string | null;
    } | null;
  };
  operatorIntelligence?: {
    availabilityScope: 'online_retailer_readiness';
    availabilityVerified: false;
    sourceType: string | null;
    expectedFrom: string | null;
    expectedTo: string | null;
    expectedLabel: string | null;
    expiresAt: string | null;
    operatorIssue: number | null;
  } | null;
};

type CanonicalAlertResponse = {
  success?: boolean;
  alerts?: CanonicalMobileAlert[];
  error?: string;
};

type CanonicalAlertReadStateListener = (userId: string) => void;
const readStateListeners = new Set<CanonicalAlertReadStateListener>();
const readStateMutationQueues = new Map<string, Promise<void>>();

function readStateKey(userId: string) {
  return `${ALERT_READ_STATE_PREFIX}:${encodeURIComponent(userId)}`;
}

function emitReadStateChanged(userId: string) {
  readStateListeners.forEach((listener) => listener(userId));
}

function emptyUnreadCounts(): Record<CanonicalAlertStage, number> {
  return { WHISPER: 0, ECHO: 0, MANIFESTED: 0, VANISHED: 0 };
}

async function loadCanonicalAlertReadState(userId: string): Promise<CanonicalAlertReadState | null> {
  try {
    const raw = await AsyncStorage.getItem(readStateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeCanonicalAlertReadState(parsed, userId);
  } catch {
    return null;
  }
}

async function mutateCanonicalAlertReadState(
  userId: string,
  mutation: (previous: CanonicalAlertReadState | null) => CanonicalAlertReadState,
) {
  const previousQueue = readStateMutationQueues.get(userId) ?? Promise.resolve();
  const nextQueue = previousQueue.catch(() => undefined).then(async () => {
    const previous = await loadCanonicalAlertReadState(userId);
    const next = mutation(previous);
    await AsyncStorage.setItem(readStateKey(userId), JSON.stringify(next));
    emitReadStateChanged(userId);
  });
  readStateMutationQueues.set(userId, nextQueue);
  try {
    await nextQueue;
  } finally {
    if (readStateMutationQueues.get(userId) === nextQueue) readStateMutationQueues.delete(userId);
  }
}

export function subscribeCanonicalAlertReadState(listener: CanonicalAlertReadStateListener) {
  readStateListeners.add(listener);
  return () => { readStateListeners.delete(listener); };
}

export async function countUnreadCanonicalAlertsByStage(userId: string, alerts: CanonicalAlertReadItem[]) {
  if (!userId || alerts.length === 0) return emptyUnreadCounts();
  const state = await loadCanonicalAlertReadState(userId);
  return countUnreadCanonicalAlertsByStageFromState(alerts, state);
}

export async function countUnreadCanonicalAlerts(userId: string, alerts: CanonicalAlertReadItem[]) {
  const counts = await countUnreadCanonicalAlertsByStage(userId, alerts);
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export async function markCanonicalAlertStageSeen(
  userId: string,
  stage: CanonicalAlertStage,
  alerts: CanonicalAlertReadItem[],
) {
  if (!userId) return;
  const stageAlerts = alerts.filter((alert) => alert.fateStage === stage);
  if (stageAlerts.length === 0) return;
  await mutateCanonicalAlertReadState(userId, (previous) => (
    markCanonicalAlertStageSeenInState(previous, userId, stage, stageAlerts, Date.now())
  ));
}

export async function markCanonicalAlertsSeen(userId: string, alerts: CanonicalAlertReadItem[]) {
  if (!userId || alerts.length === 0) return;
  await mutateCanonicalAlertReadState(userId, (previous) => {
    const updatedAt = Date.now();
    let next = previous;
    for (const stage of CANONICAL_ALERT_STAGES) {
      next = markCanonicalAlertStageSeenInState(next, userId, stage, alerts, updatedAt);
    }
    return next!;
  });
}

async function fetchCanonicalAlertStage(
  token: string,
  state: CanonicalAlertQueryState,
  limit: number,
  currentOnly = false,
): Promise<CanonicalMobileAlert[]> {
  const currentQuery = currentOnly ? '&current=true' : '';
  const response = await fetch(`${FATEDROP_WEB_URL}/api/mobile/alerts?state=${state}&limit=${limit}${currentQuery}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null) as CanonicalAlertResponse | null;
  if (!response.ok) throw new Error(data?.error || `Alert inbox ${state} HTTP ${response.status}`);
  if (!data?.success || !Array.isArray(data.alerts)) {
    throw new Error(`Canonical ${state} alert inbox unavailable`);
  }
  return data.alerts.filter((alert) => Boolean(alert?.id && alert?.title && alert?.fateStage));
}

export function canonicalAlertIsCurrentOpportunity(alert: CanonicalMobileAlert) {
  return alert.fateStage === 'MANIFESTED'
    && alert.liveWindow?.historyComplete === true
    && alert.liveWindow.vanishedAt === null
    && alert.liveWindow.lastConfirmedLiveAt !== null
    && alert.opportunity?.current !== false;
}

export async function fetchCanonicalLiveOpportunities(limit = 16): Promise<CanonicalMobileAlert[]> {
  const token = await getStoredSessionToken();
  if (!token) return [];
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const alerts = await fetchCanonicalAlertStage(token, 'manifested', safeLimit, true);
  return alerts.filter(canonicalAlertIsCurrentOpportunity).slice(0, safeLimit);
}

export async function fetchCanonicalAlerts(limit = 30): Promise<CanonicalMobileAlert[]> {
  const token = await getStoredSessionToken();
  if (!token) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

  // Legacy aggregate reader retained for non-inbox compatibility only. The active
  // Alerts screen and unread badge use the shared stage-scoped query owner instead.
  const stageWindows = await Promise.all(
    CANONICAL_ALERT_QUERY_STATES.map((state) => fetchCanonicalAlertStage(token, state, safeLimit)),
  );
  const byId = new Map<string, CanonicalMobileAlert>();
  for (const alerts of stageWindows) {
    for (const alert of alerts) byId.set(alert.id, alert);
  }
  return [...byId.values()].sort((a, b) => {
    const right = Date.parse(b.detectedAt);
    const left = Date.parse(a.detectedAt);
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
}