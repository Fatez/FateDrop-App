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
  rrpGbp?: number;
  rrpSource?: string;
  rrpObservedAt?: string;
  offers: TruePriceOffer[];
}

export interface TruePriceResponse {
  success: boolean;
  count: number;
  groups: TruePriceGroup[];
  disclaimer: string;
}
