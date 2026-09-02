import { FATEDROP_WEB_URL } from '@/constants/api';
import { createAlertQueryCache, type AlertQueryCacheSnapshot } from '@/lib/alert-query-cache';
import { getStoredSessionToken } from '@/services/fatedrop-id';
import type { CanonicalAlertStage, CanonicalMobileAlert } from '@/services/canonical-alerts';

export const ALERT_QUERY_FRESHNESS_MS = 20_000;
export const INITIAL_ALERT_LIMITS: Record<CanonicalAlertStage, number> = {
  WHISPER: 20,
  ECHO: 20,
  MANIFESTED: 100,
  VANISHED: 20,
};
export const EARLIER_ALERT_PAGE_SIZE = 20;

export type CanonicalAlertCursor = { before: number; beforeId: string };
export type CanonicalAlertPage = { alerts: CanonicalMobileAlert[]; nextCursor: CanonicalAlertCursor | null };
export type CanonicalAlertReadBasisItem = Pick<CanonicalMobileAlert, 'id' | 'tcgCode' | 'fateStage' | 'detectedAt'>;

export type CanonicalAlertQuery = {
  accountId: string;
  stage: CanonicalAlertStage;
  selectedTcgCodes: readonly string[];
  filterKey: string;
  limit: number;
  cursor?: CanonicalAlertCursor | null;
};

export type CanonicalAlertReadBasisQuery = {
  accountId: string;
  selectedTcgCodes: readonly string[];
  filterKey: string;
};

type AlertPageResponse = {
  success?: boolean;
  alerts?: CanonicalMobileAlert[];
  nextCursor?: CanonicalAlertCursor | null;
  error?: string;
};

type AlertReadBasisResponse = {
  success?: boolean;
  readBasis?: boolean;
  alerts?: CanonicalAlertReadBasisItem[];
  error?: string;
};

const cache = createAlertQueryCache({ freshnessMs: ALERT_QUERY_FRESHNESS_MS });
const stageQueries = new Map<string, CanonicalAlertQuery>();
const readBasisQueries = new Map<string, CanonicalAlertReadBasisQuery>();

const stateByStage: Record<CanonicalAlertStage, string> = {
  WHISPER: 'whisper',
  ECHO: 'echo',
  MANIFESTED: 'manifested',
  VANISHED: 'vanished',
};

function normalizedTcgs(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
}

function stageKey(query: CanonicalAlertQuery) {
  return `stage:${JSON.stringify({
    accountId: query.accountId,
    tcgs: normalizedTcgs(query.selectedTcgCodes),
    stage: query.stage,
    filterKey: query.filterKey,
    limit: query.limit,
    cursor: query.cursor ?? null,
  })}`;
}

function readBasisKey(query: CanonicalAlertReadBasisQuery) {
  return `read-basis:${JSON.stringify({
    accountId: query.accountId,
    tcgs: normalizedTcgs(query.selectedTcgCodes),
    filterKey: query.filterKey,
  })}`;
}

async function authenticatedJson<T>(path: string): Promise<T> {
  const token = await getStoredSessionToken();
  if (!token) throw new Error('FateDrop ID sign-in required.');
  const response = await fetch(`${FATEDROP_WEB_URL}${path}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error || `FateDrop Alerts HTTP ${response.status}`);
  if (!data) throw new Error('FateDrop Alerts returned an empty response.');
  return data;
}

async function fetchStagePage(query: CanonicalAlertQuery): Promise<CanonicalAlertPage> {
  const params = new URLSearchParams({ state: stateByStage[query.stage], limit: String(query.limit) });
  if (query.cursor) {
    params.set('before', String(query.cursor.before));
    params.set('beforeId', query.cursor.beforeId);
  }
  const data = await authenticatedJson<AlertPageResponse>(`/api/mobile/alerts?${params.toString()}`);
  if (data.success !== true || !Array.isArray(data.alerts)) throw new Error(`Canonical ${query.stage.toLowerCase()} alert inbox unavailable`);
  const malformed = data.alerts.some((alert) => !alert?.id || !alert?.title || alert.fateStage !== query.stage);
  if (malformed) throw new Error(`Canonical ${query.stage.toLowerCase()} alert inbox returned invalid lifecycle data`);
  const nextCursor = data.nextCursor && Number.isFinite(data.nextCursor.before) && data.nextCursor.before > 0 && data.nextCursor.beforeId
    ? { before: Math.trunc(data.nextCursor.before), beforeId: data.nextCursor.beforeId }
    : null;
  return { alerts: data.alerts, nextCursor };
}

async function fetchReadBasis(): Promise<CanonicalAlertReadBasisItem[]> {
  const data = await authenticatedJson<AlertReadBasisResponse>('/api/mobile/alerts?readBasis=true&limit=100');
  if (data.success !== true || data.readBasis !== true || !Array.isArray(data.alerts)) throw new Error('Canonical alert read basis unavailable');
  const validStages = new Set<CanonicalAlertStage>(['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED']);
  if (data.alerts.some((alert) => !alert?.id || !alert?.tcgCode || !alert?.detectedAt || !validStages.has(alert.fateStage))) {
    throw new Error('Canonical alert read basis returned invalid data');
  }
  return data.alerts;
}

export function peekCanonicalAlertPage(query: CanonicalAlertQuery): AlertQueryCacheSnapshot<CanonicalAlertPage> {
  const key = stageKey(query);
  stageQueries.set(key, query);
  return cache.peek<CanonicalAlertPage>(key);
}

export function queryCanonicalAlertPage(query: CanonicalAlertQuery, options: { force?: boolean } = {}) {
  const key = stageKey(query);
  stageQueries.set(key, query);
  return cache.request<CanonicalAlertPage>(key, () => fetchStagePage(query), options);
}

export function peekCanonicalAlertReadBasis(query: CanonicalAlertReadBasisQuery): AlertQueryCacheSnapshot<CanonicalAlertReadBasisItem[]> {
  const key = readBasisKey(query);
  readBasisQueries.set(key, query);
  return cache.peek<CanonicalAlertReadBasisItem[]>(key);
}

export function queryCanonicalAlertReadBasis(query: CanonicalAlertReadBasisQuery, options: { force?: boolean } = {}) {
  const key = readBasisKey(query);
  readBasisQueries.set(key, query);
  return cache.request<CanonicalAlertReadBasisItem[]>(key, fetchReadBasis, options);
}

export function subscribeCanonicalAlertQueryCache(listener: () => void) {
  return cache.subscribe(() => listener());
}

export function invalidateCanonicalAlertQueries(input: { accountId: string; stage?: CanonicalAlertStage | null; tcgCode?: string | null }) {
  for (const [key, query] of stageQueries) {
    if (query.accountId !== input.accountId) continue;
    if (input.stage && query.stage !== input.stage) continue;
    if (input.tcgCode && !normalizedTcgs(query.selectedTcgCodes).includes(input.tcgCode.toLowerCase())) continue;
    cache.invalidate(key);
  }
  for (const [key, query] of readBasisQueries) {
    if (query.accountId === input.accountId) cache.invalidate(key);
  }
}

export function clearCanonicalAlertQueryCache(accountId?: string | null) {
  if (!accountId) {
    cache.clear();
    stageQueries.clear();
    readBasisQueries.clear();
    return;
  }
  for (const [key, query] of [...stageQueries]) {
    if (query.accountId !== accountId) continue;
    cache.clearMatching((candidate) => candidate === key);
    stageQueries.delete(key);
  }
  for (const [key, query] of [...readBasisQueries]) {
    if (query.accountId !== accountId) continue;
    cache.clearMatching((candidate) => candidate === key);
    readBasisQueries.delete(key);
  }
}

export async function revalidateStaleCanonicalAlertQueries(accountId: string) {
  const work: Promise<unknown>[] = [];
  for (const [key, query] of stageQueries) {
    if (query.accountId !== accountId) continue;
    const snapshot = cache.peek<CanonicalAlertPage>(key);
    if (snapshot.data !== undefined && !snapshot.fresh) work.push(cache.request(key, () => fetchStagePage(query)));
  }
  for (const [key, query] of readBasisQueries) {
    if (query.accountId !== accountId) continue;
    const snapshot = cache.peek<CanonicalAlertReadBasisItem[]>(key);
    if (snapshot.data !== undefined && !snapshot.fresh) work.push(cache.request(key, fetchReadBasis));
  }
  await Promise.allSettled(work);
}
