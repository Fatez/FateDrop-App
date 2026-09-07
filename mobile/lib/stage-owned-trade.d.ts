import type { FateCollectorItem } from '../services/fate-collector';

export function stageOwnedTrade(input: {
  item: FateCollectorItem;
  tradeQuantity: number;
  terms: { localTradeAllowed: boolean; postalTradeAllowed: boolean; tradeMode: string; notes?: string };
}, api: {
  fetchBinder: (tcg: string | null) => Promise<{ items?: { collectionItemId?: string }[] }>;
  updateTradeQuantity: (id: string, patch: { tradeQuantity: number; expectedRevision: number }) => Promise<unknown>;
  createBinder: (input: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ alreadyPresent: boolean }>;

