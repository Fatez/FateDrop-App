import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { FateDropColors } from '@/constants/theme';
import { clusterRadarShops, regionForRadarCluster, type RadarMapCluster } from '@/lib/local-radar-clustering';
import { shopLocalState, shopSignal, type RadarShop } from '@/services/local-radar-intelligence';

function shopColor(shop: RadarShop) {
  const state = shopLocalState(shop);
  if (state === 'confirmed') return FateDropColors.mint;
  if (state === 'expected') return FateDropColors.cyan;
  return FateDropColors.goldBright;
}

function clusterColor(cluster: RadarMapCluster) {
  if (cluster.shops.some((shop) => shopLocalState(shop) === 'expected')) return FateDropColors.cyan;
  if (cluster.shops.some((shop) => shopLocalState(shop) === 'confirmed')) return FateDropColors.mint;
  return FateDropColors.goldBright;
}

export function LocalRadarMap({
  shops,
  region,
  showUserLocation,
  onRegionChange,
  onSelectShop,
}: {
  shops: RadarShop[];
  region: Region;
  showUserLocation: boolean;
  onRegionChange: (region: Region) => void;
  onSelectShop: (shop: RadarShop | null) => void;
}) {
  const clusters = useMemo(() => clusterRadarShops(shops, region), [shops, region]);

  return <MapView
    style={StyleSheet.absoluteFill}
    region={region}
    onRegionChangeComplete={onRegionChange}
    showsUserLocation={showUserLocation}
    showsMyLocationButton={false}
  >
    {clusters.map((cluster) => {
      if (cluster.shops.length === 1) {
        const shop = cluster.shops[0];
        return <Marker
          key={cluster.id}
          coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
          pinColor={shopColor(shop)}
          title={shop.name}
          description={shopSignal(shop)}
          onPress={() => onSelectShop(shop)}
        />;
      }

      return <Marker
        key={cluster.id}
        coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
        pinColor={clusterColor(cluster)}
        title={`${cluster.shops.length} nearby stores`}
        description="Tap to zoom in"
        onPress={() => {
          onSelectShop(null);
          onRegionChange(regionForRadarCluster(cluster, region));
        }}
      />;
    })}
  </MapView>;
}
