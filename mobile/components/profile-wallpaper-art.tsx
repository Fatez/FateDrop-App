import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { profileAvatarSources, profileWallpaperBase, profileWallpaperMeta } from '@/constants/profile-customisation';
import type { ProfileWallpaperId } from '@/services/profile-customisation';

export function ProfileWallpaperArt({ wallpaperId, characterScale = 1 }: { wallpaperId: ProfileWallpaperId; characterScale?: number }) {
  const meta = profileWallpaperMeta[wallpaperId];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image source={profileWallpaperBase} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" />
      <View style={[styles.tint, { backgroundColor: meta.glow }]} />
      <View style={styles.vignette} />
      <View style={styles.emblem}>
        <FateDropNavEmblem size={94} />
      </View>
      <Image
        source={profileAvatarSources[wallpaperId]}
        style={[styles.character, { transform: [{ scale: characterScale }] }]}
        contentFit="contain"
        contentPosition="center bottom"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tint: { ...StyleSheet.absoluteFillObject, opacity: .72 },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 7, 12, .34)' },
  emblem: { position: 'absolute', left: 20, top: 28, opacity: .18 },
  character: { position: 'absolute', right: -4, bottom: -9, width: '46%', height: '88%' },
});
