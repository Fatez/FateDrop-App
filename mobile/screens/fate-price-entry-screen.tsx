import { useLocalSearchParams } from 'expo-router';

import FatePriceDiscoveryScreen from '@/screens/fate-price-discovery-screen';
import FatePriceFlagshipScreen from '@/screens/fate-price-flagship-screen';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function FatePriceEntryScreen() {
  const params = useLocalSearchParams<{ cardId?: string | string[] }>();
  const cardId = first(params.cardId)?.trim() || '';
  return cardId ? <FatePriceFlagshipScreen /> : <FatePriceDiscoveryScreen />;
}
