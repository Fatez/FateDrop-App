import { Image } from 'expo-image';
import { type ImageStyle, StyleSheet, View } from 'react-native';

import { profileWallpaperSources } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

const profileWallpaperTransforms: Partial<Record<ProfileWallpaperId, ImageStyle>> = {
  // The retained Koru artwork is composed toward the right edge. Move the
  // rendered pixels left so Koru sits closer to the centre of the Home hero.
  koruHome: {
    transform: [{ scale: 1.1 }, { translateX: -30 }],
  },
  // Oru's source has the FateDrop motto baked into the top of the artwork.
  // Move the rendered pixels down so the first line clears the iPhone sensor area.
  oru: {
    transform: [{ scale: 1.1 }, { translateY: 34 }],
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
