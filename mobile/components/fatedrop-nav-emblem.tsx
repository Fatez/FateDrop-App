import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const FATEDROP_CENTER_EMBLEM = require('../assets/images/fatedrop-center-emblem.png');

/**
 * Canonical FateDrop emblem for navigation chrome.
 *
 * The artwork lives in one shared asset so the centre navigation mark and
 * toolbox launcher do not drift into separate hand-drawn interpretations.
 */
export function FateDropNavEmblem({ size = 46 }: { size?: number }) {
  const artworkSize = size * 0.84;

  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={FATEDROP_CENTER_EMBLEM}
        style={{ width: artworkSize, height: artworkSize }}
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
    backgroundColor: 'rgba(8,14,20,.92)',
  },
});
