import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';

type Step = 1 | 2 | 3 | 4 | 5;

export function FatePriceBackdrop({ sceneKey }: { sceneKey: string }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <FateDropBackground />
    <Image
      source={require('../assets/images/fate-market-orbital-theme.webp')}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      contentPosition="top center"
      cachePolicy="disk"
      enforceEarlyResizing
      recyclingKey={`fate-price:${sceneKey}:cosmos`}
    />
    <Image
      source={require('../assets/images/fate-market-guardian-wayfinder.webp')}
      style={styles.guardian}
      contentFit="contain"
      contentPosition="top right"
      cachePolicy="disk"
      enforceEarlyResizing
      recyclingKey={`fate-price:${sceneKey}:wayfinder`}
    />
    <Constellation />
    <View style={styles.topVeil} />
    <View style={styles.copyVeil} />
    <View style={styles.lowerVeil} />
  </View>;
}

export function FatePriceTopBar({ step, backLabel = 'Fate Market' }: { step: Step; backLabel?: string }) {
  return <View style={styles.topBar}>
    <Pressable
      accessibilityLabel={`Back to ${backLabel}`}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={21} color={FateDropColors.goldBright} />
      <Text style={styles.backText}>{backLabel}</Text>
    </Pressable>
    <View style={styles.brandLockup}>
      <View style={styles.brandGem}><Ionicons name="sparkles" size={11} color={FateDropColors.goldBright} /></View>
      <Text style={styles.brandText}>FATEPRICE</Text>
    </View>
    <View accessibilityLabel={`FatePrice journey, step ${step} of 5`} style={styles.journeyDots}>
      {[1, 2, 3, 4, 5].map((item) => <View key={item} style={[styles.journeyDot, item === step && styles.journeyDotActive, item < step && styles.journeyDotDone]} />)}
    </View>
  </View>;
}

export function FatePriceAreaRail() {
  return <View accessibilityRole="tablist" style={styles.areaRail}>
    <Pressable accessibilityRole="tab" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} style={styles.areaTab}>
      <Ionicons name="pulse-outline" size={16} color={FateDropColors.muted} />
      <Text style={styles.areaTitle}>FatePulse</Text>
    </Pressable>
    <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.areaTab, styles.areaTabActive]}>
      <Ionicons name="pricetag-outline" size={16} color={FateDropColors.goldBright} />
      <Text style={[styles.areaTitle, styles.areaTitleActive]}>FatePrice</Text>
      <View style={styles.areaActiveGem} />
    </View>
    <Pressable accessibilityRole="tab" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'collectors' } })} style={styles.areaTab}>
      <Ionicons name="albums-outline" size={16} color={FateDropColors.muted} />
      <Text style={styles.areaTitle}>Collections</Text>
    </Pressable>
  </View>;
}

export function FatePriceCardGlyph({ collectorNumber, large = false }: { collectorNumber?: string | null; large?: boolean }) {
  return <View style={[styles.cardGlyph, large && styles.cardGlyphLarge]}>
    <View style={styles.cardGlyphInset} />
    <View style={styles.cardGlyphOrbit} />
    <View style={styles.cardGlyphDiamond}><Ionicons name="sparkles" size={large ? 23 : 14} color={FateDropColors.goldBright} /></View>
    {collectorNumber ? <Text numberOfLines={1} style={[styles.cardGlyphNumber, large && styles.cardGlyphNumberLarge]}>#{collectorNumber}</Text> : null}
  </View>;
}

export function FatePriceTruth({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.truthPanel}>
    <View style={styles.truthIcon}><Ionicons name="shield-checkmark-outline" size={19} color={FateDropColors.goldBright} /></View>
    <View style={styles.truthCopyWrap}>
      <Text style={styles.truthTitle}>{title}</Text>
      <Text style={styles.truthCopy}>{children}</Text>
    </View>
  </View>;
}

function Constellation() {
  return <View style={StyleSheet.absoluteFill}>
    <View style={[styles.star, { left: '8%', top: 188 }]} />
    <View style={[styles.star, styles.starBright, { left: '38%', top: 118 }]} />
    <View style={[styles.star, { right: '10%', top: 286 }]} />
    <View style={[styles.star, { left: '18%', top: 388 }]} />
    <View style={[styles.line, { left: '8%', top: 190, width: '33%', transform: [{ rotate: '-14deg' }] }]} />
    <View style={[styles.line, { left: '39%', top: 120, width: '50%', transform: [{ rotate: '20deg' }] }]} />
    <View style={[styles.line, { left: '17%', top: 388, width: '29%', transform: [{ rotate: '-55deg' }] }]} />
    <View style={styles.orbitOne} />
    <View style={styles.orbitTwo} />
  </View>;
}

const styles = StyleSheet.create({
  guardian: { position: 'absolute', width: 330, height: 520, right: -92, top: 22, opacity: 0.54 },
  topVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,15,.22)' },
  copyVeil: { position: 'absolute', left: 0, top: 0, width: '69%', height: 560, backgroundColor: 'rgba(2,6,17,.52)' },
  lowerVeil: { position: 'absolute', left: 0, right: 0, top: 390, bottom: 0, backgroundColor: 'rgba(3,7,17,.78)' },
  star: { position: 'absolute', width: 4, height: 4, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(226,197,141,.8)', backgroundColor: '#FBF2DA' },
  starBright: { width: 7, height: 7, borderRadius: 4, shadowColor: FateDropColors.goldBright, shadowOpacity: 0.9, shadowRadius: 8 },
  line: { position: 'absolute', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.18)' },
  orbitOne: { position: 'absolute', width: 330, height: 126, borderRadius: 170, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.11)', left: -76, top: 247, transform: [{ rotate: '-17deg' }] },
  orbitTwo: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.12)', right: -116, top: 254 },
  topBar: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minWidth: 106, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -8, paddingHorizontal: 7 },
  backText: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '800' },
  brandLockup: { position: 'absolute', left: '35%', right: '35%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  brandGem: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.58)', backgroundColor: 'rgba(11,14,31,.8)' },
  brandText: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  journeyDots: { minWidth: 62, height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  journeyDot: { width: 4, height: 4, borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)' },
  journeyDotDone: { backgroundColor: 'rgba(226,197,141,.5)' },
  journeyDotActive: { width: 7, height: 7, borderRadius: 4, borderColor: FateDropColors.goldBright, backgroundColor: FateDropColors.goldBright },
  areaRail: { height: 52, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(3,8,20,.28)' },
  areaTab: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.15)' },
  areaTabActive: { backgroundColor: 'rgba(124,110,255,.08)' },
  areaTitle: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 11 },
  areaTitleActive: { color: FateDropColors.ivory },
  areaActiveGem: { position: 'absolute', width: 6, height: 6, bottom: -4, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  cardGlyph: { width: 72, height: 96, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 7, borderWidth: 1, borderColor: 'rgba(226,197,141,.62)', backgroundColor: 'rgba(16,15,39,.96)', shadowColor: FateDropColors.violet, shadowOpacity: 0.42, shadowRadius: 10 },
  cardGlyphLarge: { width: 118, height: 158, borderRadius: 10 },
  cardGlyphInset: { position: 'absolute', left: 5, right: 5, top: 5, bottom: 5, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.72)' },
  cardGlyphOrbit: { position: 'absolute', width: '112%', height: '44%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', transform: [{ rotate: '-17deg' }] },
  cardGlyphDiamond: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.45)', transform: [{ rotate: '45deg' }] },
  cardGlyphNumber: { position: 'absolute', left: 7, right: 7, bottom: 8, color: FateDropColors.secondary, fontSize: 7, fontWeight: '800', textAlign: 'center' },
  cardGlyphNumberLarge: { bottom: 11, fontSize: 9 },
  truthPanel: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingHorizontal: 14, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 14, backgroundColor: 'rgba(5,9,22,.78)' },
  truthIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)' },
  truthCopyWrap: { flex: 1 },
  truthTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14 },
  truthCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  pressed: { opacity: 0.72 },
});