import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FatePulseFollowAction } from '@/components/fate-pulse-follow-action';
import FatePriceDiscoveryScreen from '@/screens/fate-price-discovery-screen';
import FatePriceScreen from '@/screens/fate-price-screen';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function FatePriceEntryScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    collectorNumber?: string | string[];
    name?: string | string[];
    printingId?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const cardId = first(params.cardId)?.trim() || '';

  if (!cardId) return <FatePriceDiscoveryScreen />;

  return (
    <View style={styles.root}>
      <FatePriceScreen />
      <FatePulseFollowAction
        cardIdentityId={cardId}
        printingId={first(params.printingId)?.trim() || ''}
        tcgCode={first(params.tcg)?.trim() || null}
        name={first(params.name)?.trim() || 'Exact card'}
        setName={first(params.setName)?.trim() || 'Verified set'}
        collectorNumber={first(params.collectorNumber)?.trim() || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
