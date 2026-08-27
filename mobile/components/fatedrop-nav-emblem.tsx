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
  const artSize = Math.max(1, size - 2);
  const accentInset = 4;

  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        pointerEvents="none"
        style={[
          styles.innerAccent,
          {
            top: accentInset,
            right: accentInset,
            bottom: accentInset,
            left: accentInset,
            borderRadius: Math.max(1, (size - accentInset * 2) / 2),
          },
        ]}
      />
      <Image
        source={{ uri: FATEDROP_CENTER_EMBLEM_URI }}
        style={{ width: artSize, height: artSize }}
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
    backgroundColor: 'rgba(5, 8, 14, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(216, 193, 122, 0.72)',
    shadowColor: '#D8C17A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 11,
    elevation: 10,
  },
  innerAccent: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(124, 110, 255, 0.24)',
    backgroundColor: 'rgba(124, 110, 255, 0.025)',
  },
});