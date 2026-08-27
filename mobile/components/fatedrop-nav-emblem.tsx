import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { FATEDROP_CENTER_EMBLEM_URI } from '@/constants/brand-emblem-data';

/**
 * Canonical FateDrop emblem for navigation chrome.
 *
 * Keep this as the one rendered centre-nav identity. The artwork can change
 * independently without changing navigation behaviour or tool routing.
 */
export function FateDropNavEmblem({ size = 52 }: { size?: number }) {
  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: FATEDROP_CENTER_EMBLEM_URI }}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityElementsHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 7,
  },
});
