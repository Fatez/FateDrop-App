import { Redirect, useLocalSearchParams } from 'expo-router';

import FateMarketHubScreen from '@/screens/fate-market-hub-screen';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function FateMarketEntry() {
  const params = useLocalSearchParams<{ area?: string | string[] }>();
  const area = first(params.area)?.trim().toLowerCase();

  if (area === 'pulse') return <Redirect href="/fate-pulse" />;
  if (area === 'price') return <Redirect href="/fate-price" />;
  if (area === 'collectors' || area === 'collection') return <Redirect href="/collection" />;

  return <FateMarketHubScreen />;
}
