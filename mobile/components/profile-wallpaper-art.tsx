import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { profileWallpaperSources, profileWallpaperThumbnailSources } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

export function ProfileWallpaperArt({ wallpaperId, thumbnail = false }: { wallpaperId: ProfileWallpaperId; thumbnail?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={thumbnail ? profileWallpaperThumbnailSources[wallpaperId] : profileWallpaperSources[wallpaperId]}
        style={StyleSheet.absoluteFill}
        cachePolicy="disk"
        contentFit="cover"
        contentPosition="center"
        enforceEarlyResizing
        recyclingKey={`${thumbnail ? 'thumbnail' : 'full'}:${wallpaperId}`}
      />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 7, 12, .14)',
  },
});
