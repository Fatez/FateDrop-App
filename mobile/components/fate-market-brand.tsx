import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { loadProfileCustomisation, type ProfileWallpaperId } from '@/services/profile-customisation';

/** The home artwork continues into Market, with a quiet layer behind the data. */
export function FateMarketBackground() {
  const { snapshot } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [theme, setTheme] = useState<{ identity: string; wallpaper: ProfileWallpaperId } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadProfileCustomisation(identity).then((value) => {
      if (active) setTheme({ identity, wallpaper: value.wallpaperId });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [identity]));
  const wallpaper = theme?.identity === identity ? theme.wallpaper : 'koruHome';
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {wallpaper === 'koruHome'
      ? <Image source={require('../assets/images/home-living-stage-v2.png')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
      : <ProfileWallpaperArt wallpaperId={wallpaper} home />}
    <View style={styles.veil} />
    <View style={styles.lowerVeil} />
  </View>;
}

export function FateMarketHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={styles.header}>
    <View style={styles.navigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/market')} style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={FateDropColors.goldBright} /><Text style={styles.backText}>Back</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Explore Fate Market" onPress={() => router.navigate('/(tabs)/market')} style={styles.back}>
        <Text style={styles.eyebrow}>FATE MARKET</Text><Ionicons name="grid-outline" size={15} color={FateDropColors.goldBright} />
      </Pressable>
    </View>
    <View style={styles.titleRow}><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
      <Image accessible={false} source={require('../assets/images/home-orbital-crystal.png')} style={styles.crystal} contentFit="contain" />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.66)' },
  lowerVeil: { position: 'absolute', top: 260, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,7,18,.24)' },
  header: { paddingBottom: 8 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  backText: { color: FateDropColors.goldBright, fontSize: 12, fontWeight: '700' },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 16 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 30, lineHeight: 35 },
  subtitle: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  crystal: { width: 52, height: 68 },
});
