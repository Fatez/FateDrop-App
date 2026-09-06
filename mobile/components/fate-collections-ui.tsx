import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateCollectionsArt, type CollectionArtKind } from '@/components/fate-collections-art';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

export function CollectionsScreen({ children }: PropsWithChildren) {
  const { signedIn, loading } = useFateDropId();
  return <SafeAreaView style={collectionsStyles.screen} edges={['top', 'bottom']}>
    <Stack.Screen options={{ headerShown: false }} />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
      <View style={collectionsStyles.veil} />
    </View>
    {loading ? <CollectionState loading text="Opening Fate Collections…" /> : signedIn ? children : <View style={collectionsStyles.gate}>
      <CollectionHeader title="Fate Collections" copy="A home for your cards, binders and graded favourites." />
      <Text style={collectionsStyles.body}>Connect your FateDrop ID to open your private collection.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={collectionsStyles.primary}><Text style={collectionsStyles.primaryText}>Connect FateDrop ID</Text></Pressable>
    </View>}
  </SafeAreaView>;
}

export function CollectionHeader({ title, copy, kind }: { title: string; copy: string; kind?: CollectionArtKind }) {
  return <View style={collectionsStyles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={kind ? 'Back to Fate Collections' : 'Back to Fate Market'} onPress={() => {
      if (router.canGoBack()) router.back();
      else router.replace(kind ? '/collections' : { pathname: '/(tabs)/market', params: { area: 'pulse' } });
    }} style={collectionsStyles.back}><Ionicons name="chevron-back" size={18} color={FateDropColors.goldBright} /><Text style={collectionsStyles.backText}>{kind ? 'Fate Collections' : 'Fate Market'}</Text></Pressable>
    <View style={collectionsStyles.heroRow}>
      <View style={collectionsStyles.flex}><Text style={collectionsStyles.eyebrow}>{kind ? 'FATE COLLECTIONS' : 'YOUR CARDS. YOUR STORY.'}</Text><Text style={collectionsStyles.title}>{title}</Text><Text style={collectionsStyles.body}>{copy}</Text></View>
      {kind ? <FateCollectionsArt kind={kind} size={86} /> : <Image accessible={false} source={require('../assets/images/profile-avatar-koru.png')} style={collectionsStyles.companion} contentFit="contain" />}
    </View>
  </View>;
}

export function CollectionState({ text, loading = false, error = false, onRetry }: { text: string; loading?: boolean; error?: boolean; onRetry?: () => void }) {
  return <View accessibilityLiveRegion="polite" style={collectionsStyles.state}>
    {loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={error ? 'alert-circle-outline' : 'sparkles-outline'} size={22} color={error ? FateDropColors.vanished : FateDropColors.goldBright} />}
    <Text style={collectionsStyles.body}>{text}</Text>
    {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={collectionsStyles.chip}><Text style={collectionsStyles.chipText}>Try again</Text></Pressable> : null}
  </View>;
}

export function CollectionChip({ label, selected = false, onPress, disabled = false }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [collectionsStyles.chip, selected && collectionsStyles.chipSelected, pressed && collectionsStyles.pressed]}><Text style={[collectionsStyles.chipText, selected && collectionsStyles.chipTextSelected]}>{label}</Text></Pressable>;
}

export const collectionsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.64)' },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 },
  gate: { padding: 24, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { paddingBottom: 20 },
  back: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center' },
  backText: { color: FateDropColors.goldBright, fontSize: 13 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  companion: { width: 96, height: 112 },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 32, lineHeight: 37, marginVertical: 7 },
  body: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20 },
  panel: { padding: 16, borderWidth: 1, borderColor: 'rgba(226,197,141,.30)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.86)', marginBottom: 16 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24, lineHeight: 29, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(226,197,141,.3)', borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(4,8,21,.82)' },
  chipSelected: { backgroundColor: 'rgba(124,110,255,.20)', borderColor: FateDropColors.goldBright },
  chipText: { color: FateDropColors.secondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: FateDropColors.ivory },
  primary: { minHeight: 44, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: FateDropColors.goldBright, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: FateDropColors.background, fontSize: 13, fontWeight: '800' },
  state: { minHeight: 110, gap: 10, paddingVertical: 20, alignItems: 'flex-start' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, marginVertical: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.30)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.86)' },
  input: { flex: 1, minWidth: 0, paddingVertical: 12, color: FateDropColors.ivory, fontSize: 14 },
  pressed: { opacity: .72 },
});
