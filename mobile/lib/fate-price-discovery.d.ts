import type { FatePriceCard } from '@/services/fate-market';

export type FatePriceDiscoveryGame = { code: string; identityCount: number };
export type FatePriceDiscoverySet = {
  id: string;
  name: string;
  seriesId: string;
  seriesName: string;
  identityCount: number;
  cardCount: number;
};
export type FatePriceDiscoveryCard = {
  printingId: string;
  name: string;
  collectorNumber: string;
  rarity: string;
  supertype: string;
  identityCount: number;
  variantCodes: string[];
  languageCodes: string[];
};
export type FatePriceDiscoveryModel = {
  exactIdentityCount: number;
  games: FatePriceDiscoveryGame[];
  sets: FatePriceDiscoverySet[];
  cards: FatePriceDiscoveryCard[];
  variants: FatePriceCard[];
};

export function buildFatePriceDiscovery(
  cards: FatePriceCard[],
  selection?: { tcgCode?: string; setId?: string; printingId?: string },
): FatePriceDiscoveryModel;

export function fatePriceVariantLabel(card: FatePriceCard): string;
