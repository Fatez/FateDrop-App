import AsyncStorage from '@react-native-async-storage/async-storage';

import { getStoredSessionToken } from '@/services/fatedrop-id';

const DEFAULT_WEB_URL = 'https://fatedrop.co.uk';
const ALERT_READ_STATE_PREFIX = 'fatedrop:canonical-alerts:read:v1';
const MAX_SEEN_ALERT_IDS = 500;

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

type CanonicalAlertReadState = {
  version: 1;
  userId: string;
  seenAlertIds: string[];
  seenThroughDetectedAt: string | null;
  updatedAt: number;
};

type CanonicalAlertReadStateListener = (userId: string) => void;
const readStateListeners = new Set<CanonicalAlertReadStateListener>();

function baseUrl() {
  return (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, '');
}

function readStateKey(userId: string) {
  return `${ALERT_READ_STATE_PREFIX}:${encodeURIComponent(userId)}`;
}

function detectedAtMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function newestDetectedAt(alerts: CanonicalMobileAlert[], previous: string | null | undefined) {
  let newest = previous ?? null;
  let newestMs = detectedAtMs(newest) ?? Number.NEGATIVE_INFINITY;
  for (const alert of alerts) {
    const currentMs = detectedAtMs(alert.detectedAt);
    if (currentMs != null && currentMs > newestMs) {
      newest = alert.detectedAt;
      newestMs = currentMs;
    }
  }
  return newest;
}

function emitReadStateChanged(userId: string) {
  readStateListeners.forEach((listener) => listener(userId));
}

async function loadCanonicalAlertReadState(userId: string): Promise<CanonicalAlertReadState | null> {
  try {
    const raw = await AsyncStorage.getItem(readStateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CanonicalAlertReadState>;
    if (parsed.version !== 1 || parsed.userId !== userId || !Array.isArray(parsed.seenAlertIds)) return null;
    return {
      version: 1,
      userId,
      seenAlertIds: parsed.seenAlertIds.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, MAX_SEEN_ALERT_IDS),
      seenThroughDetectedAt: typeof parsed.seenThroughDetectedAt === 'string' ? parsed.seenThroughDetectedAt : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function subscribeCanonicalAlertReadState(listener: CanonicalAlertReadStateListener) {
  readStateListeners.add(listener);
  return () => { readStateListeners.delete(listener); };
}

export async function countUnreadCanonicalAlerts(userId: string, alerts: CanonicalMobileAlert[]) {
  if (!userId || alerts.length === 0) return 0;
  const state = await loadCanonicalAlertReadState(userId);
  if (!state) return alerts.length;

  const seenIds = new Set(state.seenAlertIds);
  const cursorMs = detectedAtMs(state.seenThroughDetectedAt);
  return alerts.reduce((count, alert) => {
    if (seenIds.has(alert.id)) return count;
    const alertMs = detectedAtMs(alert.detectedAt);
    if (cursorMs != null && alertMs != null && alertMs < cursorMs) return count;
    return count + 1;
  }, 0);
}

export async function markCanonicalAlertsSeen(userId: string, alerts: CanonicalMobileAlert[]) {
  if (!userId) return;
  if (alerts.length === 0) {
    emitReadStateChanged(userId);
    return;
  }
  const previous = await loadCanonicalAlertReadState(userId);
  const seenAlertIds = Array.from(new Set([
    ...alerts.map((alert) => alert.id),
    ...(previous?.seenAlertIds ?? []),
  ])).slice(0, MAX_SEEN_ALERT_IDS);
  const next: CanonicalAlertReadState = {
    version: 1,
    userId,
    seenAlertIds,
    seenThroughDetectedAt: newestDetectedAt(alerts, previous?.seenThroughDetectedAt),
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(readStateKey(userId), JSON.stringify(next));
  emitReadStateChanged(userId);
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
