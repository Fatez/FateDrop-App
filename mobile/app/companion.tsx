import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanionStage, type CompanionClipName, type CompanionVariant } from '@/components/companion-stage';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import {
  ACTIVE_COMPANION_ROSTER,
  LEGACY_COMPANION_ARCHIVE,
  normalizeCompanionId,
  type CompanionReaction,
} from '@/lib/companion-contract';

const reactions: { id: CompanionReaction; label: string; clip: CompanionClipName; detail: string }[] = [
  { id: 'idle', label: 'Idle', clip: 'Idle', detail: 'Quiet network state' },
  { id: 'watching', label: 'Whisper', clip: 'Whisper', detail: 'Catalogue movement · not confirmed stock' },
  { id: 'echo', label: 'Echo', clip: 'Echo', detail: 'Queue / access readiness' },
  { id: 'manifested', label: 'Manifested', clip: 'Manifested', detail: 'Confirmed purchasable stock' },
  { id: 'vanished', label: 'Vanished', clip: 'Vanished', detail: 'Availability lost' },
  { id: 'fatematch', label: 'FateMatch', clip: 'FateMatch', detail: 'Special FateDrop moment' },
];

const iconByCompanion: Record<CompanionVariant, keyof typeof Ionicons.glyphMap> = {
  oru: 'sparkles',
  nyxen: 'eye-outline',
  solix: 'flash-outline',
  aeris: 'radio-outline',
};

export default function CompanionScreen() {
  const params = useLocalSearchParams<{ variant?: string }>();
  const routeVariant = normalizeCompanionId(params.variant);
  const [variant, setVariant] = useState<CompanionVariant>(routeVariant);
  const [reaction, setReaction] = useState<CompanionReaction>('idle');

  useEffect(() => {
    setVariant(routeVariant);
    setReaction('idle');
  }, [routeVariant]);

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={FateDropColors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ORU & FRIENDS</Text>
            <Text style={styles.title}>The signal has a little soul now.</Text>
          </View>
          <View style={styles.live}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>3D LIVE</Text>
          </View>
        </View>

        <Text style={styles.intro}>Oru is FateDrop’s guide. Nyxen, Solix and Aeris share the same reaction contract, so the character can change without ever changing what a Whisper, Echo, Manifested or Vanished signal means.</Text>

        <CompanionStage variant={variant} reaction={reaction} />

        <View style={styles.contractStrip}>
          <View style={styles.contractMetric}><Text style={styles.contractValue}>4</Text><Text style={styles.contractLabel}>ACTIVE FRIENDS</Text></View>
          <View style={styles.contractDivider} />
          <View style={styles.contractMetric}><Text style={styles.contractValue}>6</Text><Text style={styles.contractLabel}>RIG STATES</Text></View>
          <View style={styles.contractDivider} />
          <View style={styles.contractMetric}><Text style={styles.contractValue}>GLB</Text><Text style={styles.contractLabel}>NATIVE RENDER</Text></View>
        </View>

        <Text style={styles.sectionLabel}>CHOOSE YOUR GUIDE</Text>
        <View style={styles.variantGrid}>
          {ACTIVE_COMPANION_ROSTER.map((item) => {
            const active = item.id === variant;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${item.name}`}
                onPress={() => {
                  setVariant(item.id);
                  setReaction('idle');
                }}
                style={[styles.variant, active && styles.variantActive]}
              >
                <View style={[styles.variantIcon, active && styles.variantIconActive]}>
                  <Ionicons name={iconByCompanion[item.id]} size={18} color={active ? FateDropColors.cyan : FateDropColors.violetLight} />
                </View>
                <View style={styles.variantCopy}>
                  <View style={styles.variantNameRow}>
                    <Text style={[styles.variantTitle, active && styles.activeText]}>{item.name.toUpperCase()}</Text>
                    {item.isMascot ? <Text style={styles.mascotPill}>MASCOT</Text> : null}
                  </View>
                  <Text style={styles.variantSub}>{item.code} · {item.role}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>TEST FATEDROP REACTIONS</Text>
        <View style={styles.reactionGrid}>
          {reactions.map((item) => {
            const active = reaction === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setReaction(item.id)}
                style={[styles.reaction, active && styles.reactionActive]}
              >
                <Text style={[styles.reactionText, active && styles.activeText]}>{item.label}</Text>
                <Text style={styles.reactionDetail}>{item.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.lifecycleCard}>
          <View style={styles.lifecycleIcon}><Ionicons name="pulse-outline" size={19} color={FateDropColors.violetLight} /></View>
          <View style={styles.lifecycleCopy}>
            <Text style={styles.lifecycleTitle}>Characters react. FateDrop evidence stays authoritative.</Text>
            <Text style={styles.lifecycleText}>Whisper is anticipation, Echo is readiness, Manifested is confirmed purchasable stock and Vanished is availability lost. FateMatch is the extra celebration layer — it never rewrites the four core signal stages.</Text>
          </View>
        </View>

        <View style={styles.legacyCard}>
          <View style={styles.legacyTop}>
            <View style={styles.legacyIcon}><Ionicons name="archive-outline" size={18} color="#C9A66B" /></View>
            <View style={styles.legacyCopy}>
              <Text style={styles.legacyEyebrow}>FATEDROP LEGACY</Text>
              <Text style={styles.legacyTitle}>Kael & Nyra are in the vault.</Text>
            </View>
          </View>
          <Text style={styles.legacyText}>They are no longer active Companions, but their original identities are preserved for future cameos, anniversary moments or deliberate Legacy appearances.</Text>
          <View style={styles.legacyNames}>
            {LEGACY_COMPANION_ARCHIVE.map((item) => <Text key={item.id} style={styles.legacyName}>{item.name.toUpperCase()} · {item.code}</Text>)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 80 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#BDA6BF', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: FateDropColors.text, fontSize: 20, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: `${FateDropColors.mint}12`, borderWidth: 1, borderColor: `${FateDropColors.mint}40` },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint },
  liveText: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  intro: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginBottom: 14 },
  contractStrip: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 16, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  contractMetric: { flex: 1, alignItems: 'center' },
  contractValue: { color: FateDropColors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  contractLabel: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: 0.9, marginTop: 2 },
  contractDivider: { width: 1, height: 25, backgroundColor: FateDropColors.border },
  sectionLabel: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 20, marginBottom: 9 },
  variantGrid: { gap: 8 },
  variant: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 17, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  variantActive: { borderColor: 'rgba(190, 160, 194, 0.66)', backgroundColor: 'rgba(119, 83, 132, 0.13)' },
  variantIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(141, 109, 151, 0.10)' },
  variantIconActive: { backgroundColor: 'rgba(125, 191, 181, 0.10)' },
  variantCopy: { flex: 1 },
  variantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  variantTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  variantSub: { color: FateDropColors.muted, fontSize: 8, marginTop: 3 },
  mascotPill: { color: '#CDB8C9', fontSize: 6, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(184, 149, 186, 0.10)', overflow: 'hidden' },
  activeText: { color: FateDropColors.cyan },
  reactionGrid: { gap: 8 },
  reaction: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  reactionActive: { backgroundColor: 'rgba(120, 85, 132, 0.13)', borderColor: 'rgba(190, 160, 194, 0.55)' },
  reactionText: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' },
  reactionDetail: { color: FateDropColors.muted, fontSize: 8, marginTop: 3 },
  lifecycleCard: { marginTop: 20, flexDirection: 'row', gap: 12, padding: 15, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  lifecycleIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 105, 150, 0.12)' },
  lifecycleCopy: { flex: 1 },
  lifecycleTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  lifecycleText: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 4 },
  legacyCard: { marginTop: 12, padding: 15, borderRadius: 18, backgroundColor: 'rgba(117, 93, 60, 0.06)', borderWidth: 1, borderColor: 'rgba(201, 166, 107, 0.17)' },
  legacyTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  legacyIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201, 166, 107, 0.09)' },
  legacyCopy: { flex: 1 },
  legacyEyebrow: { color: '#B49362', fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  legacyTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900', marginTop: 3 },
  legacyText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 15, marginTop: 10 },
  legacyNames: { flexDirection: 'row', gap: 12, marginTop: 10 },
  legacyName: { color: '#B49362', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
});
