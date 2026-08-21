import { SIGNAL_ENGINE_URL } from '@/constants/api';

export type NetworkSignalState = 'echo' | 'manifested' | 'vanished';

export interface NetworkSignal {
  id: string;
  state: NetworkSignalState;
  productId?: string | null;
  offerId?: string | null;
  retailerId?: string | null;
  retailerName?: string | null;
  title: string;
  productType?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  priceGbp?: number;
  rrpGbp?: number;
  markupPercent?: number;
  stockStatus?: string;
  confidence?: number;
  detectedAt?: string;
  reason?: string | null;
  target?: {
    type: 'product';
    productId?: string | null;
    offerId?: string | null;
    retailerId?: string | null;
    productUrl?: string | null;
    query?: string;
  };
}

interface NetworkSignalResponse {
  success: boolean;
  count: number;
  generatedAt?: string;
  signals?: NetworkSignal[];
}

export async function fetchNetworkSignals(limit = 50): Promise<NetworkSignal[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/signals?limit=${safeLimit}`);
  if (!response.ok) throw new Error(`Signal feed HTTP ${response.status}`);
  const data = await response.json() as NetworkSignalResponse;
  if (!data.success || !Array.isArray(data.signals)) return [];
  return data.signals.filter((signal): signal is NetworkSignal => Boolean(signal?.id && signal?.title && ['echo', 'manifested', 'vanished'].includes(signal.state)));
}
