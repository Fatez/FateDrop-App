import { Marker } from 'react-native-maps';

import { FateDropColors } from '@/constants/theme';
import type { LocalRadarClusterPoint, LocalRadarMapPoint } from '@/lib/local-radar-map';
import { shopSignal, type RadarShop } from '@/services/local-radar-intelligence';

const FIXED_MAP_MARKER_SLOTS = 36;
const HIDDEN_MARKER_COORDINATE = { latitude: 0, longitude: 0 };
const MARKER_SLOT_IDS = Array.from(
  { length: FIXED_MAP_MARKER_SLOTS },
  (_, index) => `local-radar-marker-slot-${index}`,
);

function shopMarkerColor(shop: RadarShop) {
  const stockState = String(shop.stockState || '').toUpperCase();
  if (stockState === 'CONFIRMED') return FateDropColors.mint;
  if (stockState === 'EXPECTED') return FateDropColors.cyan;
  return FateDropColors.goldBright;
}

type Props = {
  points: LocalRadarMapPoint<RadarShop>[];
  onClusterPress: (point: LocalRadarClusterPoint) => void;
  onShopPress: (shop: RadarShop) => void;
};

export function LocalRadarMarkerPool({ points, onClusterPress, onShopPress }: Props) {
  return <>
    {MARKER_SLOT_IDS.map((slotId, slotIndex) => {
      const point = points[slotIndex];
      const active = Boolean(point);
      const cluster = point?.kind === 'cluster' ? point : null;
      const shop = point?.kind === 'shop' ? point.shop : null;

      return <Marker
        key={slotId}
        identifier={slotId}
        coordinate={point ? { latitude: point.latitude, longitude: point.longitude } : HIDDEN_MARKER_COORDINATE}
        opacity={active ? 1 : 0}
        pinColor={cluster ? FateDropColors.violetLight : shop ? shopMarkerColor(shop) : FateDropColors.violetLight}
        title={cluster ? `${cluster.count} nearby stores` : shop?.name || ''}
        description={cluster ? 'Tap to zoom' : shop ? shopSignal(shop) : ''}
        tracksViewChanges={false}
        onPress={() => {
          if (cluster) onClusterPress(cluster);
          else if (shop) onShopPress(shop);
        }}
      />;
    })}
  </>;
}
