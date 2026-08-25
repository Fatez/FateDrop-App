export interface TruePriceOffer {
  id: string;
  retailerId: string;
  retailerName: string;
  title: string;
  priceGbp?: number;
  shippingGbp?: number;
  totalDeliveredGbp?: number;
  deliveryKnown: boolean;
  freeShippingThresholdGbp?: number;
  collectionAvailable: boolean;
  productUrl?: string;
  imageUrl?: string;
  lastCheckedAt?: string;
  stockStatus: string;
  isLowestKnownDelivered: boolean;
}

export interface TruePriceGroup {
  id: string;
  title: string;
  category: string;
  matchingConfidence: number;
  retailerCount: number;
  identityKey?: string;
  valueFamilyKey?: string;
  rrpGbp?: number;
  rrpSource?: string;
  rrpKind?: 'official' | 'component_reference' | 'pack_reference';
  rrpObservedAt?: string;
  rrpReferenceBasis?: string;
  unitCount?: number;
  unitKind?: string;
  unitRrpGbp?: number;
  offers: TruePriceOffer[];
}

export interface TruePriceResponse {
  success: boolean;
  count: number;
  groups: TruePriceGroup[];
  disclaimer: string;
}

export interface FateRrpReferenceEvidence {
  rrpGbp: number;
  directRrpGbp: number | null;
  unitRrpGbp: number | null;
  unitCount: number | null;
  unitKind: string | null;
  source: string | null;
  kind: string | null;
  observedAt: string | null;
  basis: string | null;
  scaledFromUnit: boolean;
}

export interface FateTruePriceEvidence {
  itemPriceGbp: number | null;
  deliveryGbp: number | null;
  totalGbp: number | null;
  deliveryKnown: boolean;
  retailerName: string | null;
  observedAt: string | null;
  stockStatus: string | null;
}

export interface FateVerdictPosition {
  groupId: string;
  title: string;
  identityKey: string | null;
  valueFamilyKey: string | null;
  offerId: string;
  retailerId?: string;
  retailerName?: string;
  itemPrice: number | null;
  truePrice: number | null;
  checkoutCost: number | null;
  rrpGbp: number | null;
  rrpPercent: number | null;
  unitCount: number | null;
  unitKind: string | null;
  unitCost: number | null;
  deliveryKnown: boolean;
  provisional: boolean;
  reference: FateRrpReferenceEvidence | null;
  truePriceEvidence: FateTruePriceEvidence;
}

export interface FatePairVerdict {
  left: FateVerdictPosition | null;
  right: FateVerdictPosition | null;
  winnerId: string | null;
  basis: 'rrp_percent' | 'unit_true_price' | null;
  gap: number | null;
  reason: string;
}

export interface FateRankVerdict {
  winnerId: string | null;
  basis: 'rrp_percent' | 'unit_true_price' | null;
  reason: string;
  provisional: boolean;
  ranking: FateVerdictPosition[];
}

export interface FateVerdictResponse {
  success: boolean;
  mode: 'verdict';
  count: number;
  groups: TruePriceGroup[];
  verdict: FateRankVerdict;
  pairVerdict: FatePairVerdict | null;
  source: 'FATEDROP_CLOUD';
  rulesVersion: string;
  disclaimer: string;
  notice?: string;
}
