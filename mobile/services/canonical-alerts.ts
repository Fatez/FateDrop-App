import AsyncStorage from '@react-native-async-storage/async-storage';

import { FATEDROP_WEB_URL } from '@/constants/api';
import {
  CANONICAL_ALERT_STAGES,
  countUnreadCanonicalAlertsByStageFromState,
  markCanonicalAlertStageSeenInState,
  normalizeCanonicalAlertReadState,
  type CanonicalAlertReadState,
} from '@/lib/canonical-alert-read-state';
import { getStoredSessionToken } from '@/services/fatedrop-id';

const ALERT_READ_STATE_PREFIX = 'fatedrop:canonical-alerts:read:v1';

export type CanonicalAlertStage = 'WHISPER' | 'ECHO' | 'MANIFESTED' | 'VANISHED';

export type CanonicalAlertPresentation = {
  referenceKind: string | null;
  referenceBasis: string | null;
  sourceMarket: string | null;
  sourceCurrency: string | null;
  sourceMsrp: string | null;
};

export type CanonicalMobileAlert = {
  id: string;
  fateStage: CanonicalAlertStage;
  title: string;
  message: string;
  retailer: string;
  detectedAt: string;
  confidence: number;
  productUrl: string;
  product: {
    title: string;
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
  preparedLinks?: {
    primary?: {
      stockStatus?: string | null;
    };
  };
  presentation?: CanonicalAlertPresentation | null;
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

export async function countUnreadCanonicalAlertsByStage(userId: string, alerts: CanonicalMobileAlert[]) {
  if (!userId || alerts.length === 0) return emptyUnreadCounts();
  const state = await loadCanonicalAlertReadState(userId);
  return countUnreadCanonicalAlertsByStageFromState(alerts, state);
}

export async function countUnreadCanonicalAlerts(userId: string, alerts: CanonicalMobileAlert[]) {
  const counts = await countUnreadCanonicalAlertsByStage(userId, alerts);
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export async function markCanonicalAlertStageSeen(
  userId: string,
  stage: CanonicalAlertStage,
  alerts: CanonicalMobileAlert[],
) {
  if (!userId) return;
  const stageAlerts = alerts.filter((alert) => alert.fateStage === stage);
  if (stageAlerts.length === 0) return;
  await mutateCanonicalAlertReadState(userId, (previous) => (
    markCanonicalAlertStageSeenInState(previous, userId, stage, stageAlerts, Date.now())
  ));
}

export async function markCanonicalAlertsSeen(userId: string, alerts: CanonicalMobileAlert[]) {
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

export async function fetchCanonicalAlerts(limit = 30): Promise<CanonicalMobileAlert[]> {
  const token = await getStoredSessionToken();
  if (!token) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await fetch(`${FATEDROP_WEB_URL}/api/mobile/alerts?limit=${safeLimit}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null) as CanonicalAlertResponse | null;
  if (!response.ok) throw new Error(data?.error || `Alert inbox HTTP ${response.status}`);
  if (!data?.success || !Array.isArray(data.alerts)) return [];
  return data.alerts.filter((alert) => Boolean(alert?.id && alert?.title && alert?.fateStage));
}
