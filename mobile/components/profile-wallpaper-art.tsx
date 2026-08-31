import { Image } from 'expo-image';
import { type ImageStyle, StyleSheet, View } from 'react-native';

import { profileWallpaperSources } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

const profileWallpaperTransforms: Partial<Record<ProfileWallpaperId, ImageStyle>> = {
  // Screenshot 1 / wallpaper 12: move the artwork left so Koru sits nearer
  // the visual centre of the Home hero while keeping a small crop buffer.
  fatedrop12: {
    transform: [{ scale: 1.1 }, { translateX: -36 }],
  },
  // Screenshot 2 / wallpaper 09: move the artwork down so the baked-in
  // FateDrop text clears the iPhone Dynamic Island / speaker area.
  fatedrop9: {
    transform: [{ scale: 1.1 }, { translateY: 38 }],
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
