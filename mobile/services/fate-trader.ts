// Fate Trader mobile API client. Contracts mirror the existing web Trader gateway.

import { SIGNAL_ENGINE_URL } from '@/constants/api';

export type TraderCardRef = {
  fateDropId?: string | null;
  tcg: string;
  setName?: string | null;
  cardName: string;
  cardNumber?: string | null;
  variant?: string | null;
  language?: string | null;
  condition?: string | null;
  grade?: string | null;
};

export type TraderWant = {
  id: string;
  status?: string | null;
  card: TraderCardRef;
  notes?: string | null;
  createdAt?: string | null;
};

export type TraderOffer = {
  id: string;
  status?: string | null;
  card: TraderCardRef;
  notes?: string | null;
  cashAdjustment?: number | null;
  createdAt?: string | null;
};

export type TraderMatch = {
  id?: string | null;
  compatibility?: 'exact' | 'potential' | string | null;
  score?: number | null;
  want?: TraderWant | null;
  offer?: TraderOffer | null;
  counterpart?: { displayName?: string | null; fateDropId?: string | null } | null;
  evidence?: string[] | null;
};

type TraderResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

async function traderRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/trader/${path.replace(/^\/+/, '')}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  const payload = await response.json().catch(() => ({})) as TraderResponse<T> & Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || `Trader HTTP ${response.status}`);
  }
  return (payload.data ?? payload) as T;
}

export function fetchTraderWants() {
  return traderRequest<TraderWant[]>('wants');
}

export function fetchTraderOffers() {
  return traderRequest<TraderOffer[]>('offers');
}

export function fetchTraderMatches() {
  return traderRequest<TraderMatch[]>('matches');
}

export function createTraderWant(input: { card: TraderCardRef; notes?: string }) {
  return traderRequest<TraderWant>('wants', { method: 'POST', body: JSON.stringify(input) });
}

export function createTraderOffer(input: { card: TraderCardRef; notes?: string; cashAdjustment?: number | null }) {
  return traderRequest<TraderOffer>('offers', { method: 'POST', body: JSON.stringify(input) });
}
