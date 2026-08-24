import { SIGNAL_ENGINE_URL } from '@/constants/api';

export type FateFindOpportunity = {
  rank: number;
  rankingBasis: 'rrp_value' | 'true_price_rrp_unavailable';
  productId: string | null;
  productTitle: string;
  productType: string | null;
  tcg: string;
  offerId: string | null;
  retailerId: string | null;
  retailerName: string | null;
  url: string | null;
  stockStatus: string;
  lastSeenAt: number | null;
  itemPricePence: number | null;
  deliveryKnown: boolean;
  deliveryPence: number | null;
  truePricePence: number | null;
  rrpResolved: boolean;
  rrpPence: number | null;
  rrpKind: string | null;
  rrpSource: string | null;
  rrpReferenceBasis: string | null;
  rrpReason: string | null;
  rrpApplicabilityReason: string | null;
  itemVsRrpDeltaPence: number | null;
  percentAboveRrp: number | null;
  valueLabel: string | null;
  qualifyingReasons: string[];
};

export type FateFindResult = {
  success: boolean;
  contractVersion: 1;
  query: string;
  generatedAt: number;
  comparisonStatus: 'no_matches' | 'ranked_by_rrp_value' | 'ranked_without_rrp';
  bestOpportunity: FateFindOpportunity | null;
  rankedOffers: FateFindOpportunity[];
};

export async function fetchLiveFateFind(query: string): Promise<FateFindResult> {
  const q = query.trim();
  if (q.length < 2) {
    return { success: true, contractVersion: 1, query: q, generatedAt: Math.floor(Date.now() / 1000), comparisonStatus: 'no_matches', bestOpportunity: null, rankedOffers: [] };
  }
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/fatefind?q=${encodeURIComponent(q)}`, { headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as (FateFindResult & { error?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error || `FateFind request failed (${response.status})`);
  return payload;
}
