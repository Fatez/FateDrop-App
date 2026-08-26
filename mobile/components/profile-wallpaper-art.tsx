import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { profileWallpaperSources } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

export function ProfileWallpaperArt({ wallpaperId }: { wallpaperId: ProfileWallpaperId }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image
        source={profileWallpaperSources[wallpaperId]}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        contentPosition="center"
      />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 7, 12, .14)',
  },
});
