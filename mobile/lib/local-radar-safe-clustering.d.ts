import type { Region } from 'react-native-maps';
import type { RadarShop } from '@/services/local-radar-intelligence';

export type RadarShopCluster = {
  id: string;
  latitude: number;
  longitude: number;
  shops: RadarShop[];
};

export function clusterRadarShops(shops: RadarShop[], region: Region): RadarShopCluster[];
