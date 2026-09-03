import { StyleSheet, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';

const blendBands = [
  'rgba(8,14,20,.04)',
  'rgba(8,14,20,.12)',
  'rgba(8,14,20,.25)',
  'rgba(8,14,20,.43)',
  'rgba(8,14,20,.64)',
  'rgba(8,14,20,.82)',
  FateDropColors.background,
] as const;

/**
 * A dependency-free image-to-shell fade. It uses lightweight colour bands
 * rather than another bitmap, blur surface or full-screen image allocation.
 */
export function ArtworkEdgeBlend({ accentColor, height = 88 }: { accentColor?: string; height?: number }) {
  return (
    <View pointerEvents="none" style={[styles.blend, { height }]}>
      {accentColor ? <View style={[styles.accentHorizon, { backgroundColor: `${accentColor}24` }]} /> : null}
      {blendBands.map((backgroundColor, index) => (
        <View key={`${backgroundColor}:${index}`} style={[styles.band, { backgroundColor }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blend: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  band: { flex: 1 },
  accentHorizon: { position: 'absolute', left: '8%', right: '8%', top: 3, height: StyleSheet.hairlineWidth },
});
