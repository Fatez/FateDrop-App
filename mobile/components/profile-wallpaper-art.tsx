import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { profileWallpaperSources } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

const profileWallpaperContentPositions: Partial<Record<ProfileWallpaperId, string>> = {
  // Koru sits on the right side of the source artwork. Bias the crop toward that
  // side so the character lands closer to the centre of the Home hero.
  koruHome: '62% center',
  // Oru's source contains the FateDrop motto near the top. Bias the crop upward
  // so the artwork itself sits slightly lower and clears the iPhone sensor area.
  oru: 'center 42%',
};

export function ProfileWallpaperArt({ wallpaperId }: { wallpaperId: ProfileWallpaperId }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image
        source={profileWallpaperSources[wallpaperId]}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        contentPosition={profileWallpaperContentPositions[wallpaperId] ?? 'center'}
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
