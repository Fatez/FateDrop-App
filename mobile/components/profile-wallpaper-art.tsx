import { Image } from 'expo-image';
import { type ImageStyle, StyleSheet, View } from 'react-native';

import { profileWallpaperSources } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

const profileWallpaperTransforms: Partial<Record<ProfileWallpaperId, ImageStyle>> = {
  // Wallpaper 12 needs to sit slightly lower in the Home hero so a little more
  // of the bottom is cropped. Keep a small scale buffer to avoid exposing edges.
  fatedrop12: {
    transform: [{ scale: 1.1 }, { translateY: 20 }],
  },
};

export function ProfileWallpaperArt({ wallpaperId }: { wallpaperId: ProfileWallpaperId }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image
        source={profileWallpaperSources[wallpaperId]}
        style={[StyleSheet.absoluteFillObject, profileWallpaperTransforms[wallpaperId]]}
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
