export type LocalRadarRetailerCategory = 'all' | 'supermarket' | 'large' | 'independent' | 'unclassified';

export type LocalRadarMapShop = {
  id: string;
  retailerGroup?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type LocalRadarRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LocalRadarShopPoint<T extends LocalRadarMapShop = LocalRadarMapShop> = {
  kind: 'shop';
  id: string;
  latitude: number;
  longitude: number;
  count: 1;
  shop: T;
};

export type LocalRadarClusterPoint = {
  kind: 'cluster';
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  shopIds: string[];
};

export type LocalRadarMapPoint<T extends LocalRadarMapShop = LocalRadarMapShop> = LocalRadarShopPoint<T> | LocalRadarClusterPoint;

export function retailerCategory(shop: LocalRadarMapShop): Exclude<LocalRadarRetailerCategory, 'all'>;
export function filterShopsByCategory<T extends LocalRadarMapShop>(shops: T[], category?: LocalRadarRetailerCategory): T[];
export function clusterShops<T extends LocalRadarMapShop>(shops: T[], region: LocalRadarRegion, options?: { maxMarkers?: number; maxIndividualMarkers?: number }): LocalRadarMapPoint<T>[];
export function clusterZoomRegion(point: { latitude: number; longitude: number }, region: LocalRadarRegion): LocalRadarRegion;
