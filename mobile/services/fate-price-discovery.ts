import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateMarketApiError, type FatePriceCard } from '@/services/fate-market';

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean };
};

export type FatePriceSeries = {
  id: string;
  tcgCode: string;
  name: string;
  verificationStatus: string;
};

export type FatePriceSet = {
  id: string;
  tcgCode: string | null;
  seriesId: string;
  seriesName: string | null;
  name: string;
  printedTotal: number | null;
  total: number | null;
  releasedAt: number | null;
  verificationStatus: string;
};

async function request<T>(path: string) {
  const response = await fetch(`${SIGNAL_ENGINE_URL}${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  let payload: ApiEnvelope<T>;
  try {
    payload = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new FateMarketApiError('FatePrice discovery returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new FateMarketApiError(payload.error?.message || `FatePrice HTTP ${response.status}`, response.status, payload.error?.code || `HTTP_${response.status}`);
  }
  return payload.data;
}

export function fetchFatePriceSeries(tcgCode: string) {
  const tcg = tcgCode.trim();
  if (!tcg) return Promise.resolve({ series: [] as FatePriceSeries[], count: 0 });
  return request<{ series: FatePriceSeries[]; count: number }>(`/v1/fate-price/series?tcg=${encodeURIComponent(tcg)}&limit=500`);
}

export function fetchFatePriceSets(tcgCode: string, seriesId = '') {
  const tcg = tcgCode.trim();
  if (!tcg) return Promise.resolve({ sets: [] as FatePriceSet[], count: 0 });
  const params = [`tcg=${encodeURIComponent(tcg)}`, 'limit=1000'];
  if (seriesId.trim()) params.push(`seriesId=${encodeURIComponent(seriesId.trim())}`);
  return request<{ sets: FatePriceSet[]; count: number }>(`/v1/fate-price/sets?${params.join('&')}`);
}

export function searchScopedFatePriceCards({
  query = '',
  tcgCode = '',
  seriesId = '',
  setId = '',
  limit = 60,
}: {
  query?: string;
  tcgCode?: string;
  seriesId?: string;
  setId?: string;
  limit?: number;
} = {}) {
  const params = [`limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`];
  if (query.trim()) params.push(`q=${encodeURIComponent(query.trim())}`);
  if (tcgCode.trim()) params.push(`tcg=${encodeURIComponent(tcgCode.trim())}`);
  if (seriesId.trim()) params.push(`seriesId=${encodeURIComponent(seriesId.trim())}`);
  if (setId.trim()) params.push(`setId=${encodeURIComponent(setId.trim())}`);
  return request<{ cards: FatePriceCard[]; count: number }>(`/v1/fate-price/cards?${params.join('&')}`);
}
