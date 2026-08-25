import { StyleSheet, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';

/**
 * Native FateDrop compass mark for navigation chrome.
 *
 * This is intentionally drawn with React Native views instead of loading the
 * branded PNG. The centre navigation action must remain visible even when an
 * image decoder/cache fails inside Expo Go.
 */
export function FateDropNavEmblem({ size = 46 }: { size?: number }) {
  const scale = size / 46;
  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size / 2 }]}> 
      <View style={[styles.ring, { width: 34 * scale, height: 34 * scale, borderRadius: 17 * scale, borderWidth: Math.max(1.5, 1.8 * scale) }]} />
      <View style={[styles.diamond, { width: 17 * scale, height: 17 * scale, borderWidth: Math.max(1.5, 1.8 * scale) }]} />
      <View style={[styles.vertical, { width: 2 * scale, height: 25 * scale }]} />
      <View style={[styles.horizontal, { width: 25 * scale, height: 2 * scale }]} />
      <View style={[styles.core, { width: 5 * scale, height: 5 * scale, borderRadius: 2.5 * scale }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,14,20,.92)',
  },
  ring: {
    position: 'absolute',
    borderColor: FateDropColors.goldBright,
  },
  diamond: {
    position: 'absolute',
    borderColor: FateDropColors.goldBright,
    transform: [{ rotate: '45deg' }],
  },
  vertical: {
    position: 'absolute',
    backgroundColor: FateDropColors.goldBright,
    borderRadius: 999,
  },
  horizontal: {
    position: 'absolute',
    backgroundColor: FateDropColors.goldBright,
    borderRadius: 999,
  },
  core: {
    position: 'absolute',
    backgroundColor: FateDropColors.ivory,
  },
});
