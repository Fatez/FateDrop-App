export interface LegacyCatalogueProduct {
  id?: string;
  sku?: string;
  title?: string;
  retailer?: string;
  retailerKey?: string;
  availability?: string;
  price?: number | null;
  url?: string | null;
  image?: string | null;
  launchDate?: string | null;
  lastSeen?: string;
  isCurrentlyListed?: boolean;
  category?: string;
  condition?: string;
  setName?: string | null;
  cardNumber?: string | null;
  shippingGbp?: number | null;
  collectionAvailable?: boolean;
  pulseLabels?: string[];
  productId?: string;
  rrpGbp?: number;
  rrpSource?: string;
  rrpObservedAt?: string;
}

export interface ProductsApiResponse {
  success: boolean;
  count: number;
  products: LegacyCatalogueProduct[] | Record<string, LegacyCatalogueProduct>;
}

export interface CatalogueApiResponse extends ProductsApiResponse {
  total: number;
  nextCursor?: string | null;
  updatedAt?: string | null;
}
