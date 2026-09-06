import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export type CollectionArtKind = 'collection' | 'binders' | 'graded';

// Original, user-approved transparent PNGs; preserve the artwork and brand mark.
const artwork: Record<CollectionArtKind, number> = {
  collection: require('../assets/images/fate-collections-personal.png'),
  binders: require('../assets/images/fate-collections-binder.png'),
  graded: require('../assets/images/fate-collections-graded.png'),
};

export function FateCollectionsArt({ kind, size = 96 }: { kind: CollectionArtKind; size?: number }) {
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.viewport, { width: size, height: size }]}>
    <Image source={artwork[kind]} accessible={false} contentFit="contain" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
  </View>;
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', flexShrink: 0 },
});
