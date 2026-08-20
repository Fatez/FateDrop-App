import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanionStage, type CompanionVariant } from '@/components/companion-stage';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import type { CompanionReaction } from '@/lib/companion-contract';

const variants: {
  id: CompanionVariant;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'male', title: 'KAEL', subtitle: 'Collector identity · K-01', icon: 'person' },
  { id: 'female', title: 'NYRA', subtitle: 'Collector identity · N-02', icon: 'person' },
];

const reactions: { id: CompanionReaction; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'watching', label: 'Notice' },
  { id: 'echo', label: 'Echo' },
  { id: 'manifested', label: 'Manifested' },
  { id: 'major', label: 'Celebrate' },
];

export default function CompanionScreen() {
  const params = useLocalSearchParams<{ variant?: string }>();
  const initialVariant: CompanionVariant = params.variant === 'female' ? 'female' : 'male';
  const [variant, setVariant] = useState<CompanionVariant>(initialVariant);
  const [reaction, setReaction] = useState<CompanionReaction>('idle');

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={FateDropColors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FATEDROP COMPANION</Text>
            <Text style={styles.title}>Your signal has a face.</Text>
          </View>
          <View style={styles.live}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>3D LIVE</Text>
          </View>
        </View>

        <CompanionStage variant={variant} reaction={reaction} />

        <Text style={styles.sectionLabel}>CHOOSE IDENTITY</Text>
        <View style={styles.variantRow}>
          {variants.map((item) => {
            const active = item.id === variant;
            return (
              <Pressable key={item.id} onPress={() => setVariant(item.id)} style={[styles.variant, active && styles.variantActive]}>
                <Ionicons name={item.icon} size={18} color={active ? FateDropColors.cyan : FateDropColors.secondary} />
                <Text style={[styles.variantTitle, active && styles.activeText]}>{item.title}</Text>
                <Text style={styles.variantSub}>{item.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.voxCard}>
          <View style={styles.voxIcon}>
            <Ionicons name="hardware-chip" size={18} color={FateDropColors.violetLight} />
          </View>
          <View style={styles.voxCopy}>
            <Text style={styles.voxTitle}>VØX · Familiar</Text>
            <Text style={styles.voxText}>Production familiar asset is temporarily disabled until the wrapped source is converted to a standards-compliant GLB. KAEL and NYRA stay fully live.</Text>
          </View>
          <Text style={styles.voxStatus}>ASSET HOLD</Text>
        </View>

        <Text style={styles.sectionLabel}>TEST SIGNAL REACTION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionRow}>
          {reactions.map((item) => (
            <Pressable key={item.id} onPress={() => setReaction(item.id)} style={[styles.reaction, reaction === item.id && styles.reactionActive]}>
              <Text style={[styles.reactionText, reaction === item.id && styles.activeText]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="flash" size={18} color={FateDropColors.violetLight} /></View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Production animation contract</Text>
            <Text style={styles.infoText}>Idle, Echo, Notice, Manifested and Celebrate now drive the real rig clips. Walk and Run remain available for future navigation and scene behaviour.</Text>
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
  eyebrow: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: FateDropColors.text, fontSize: 21, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: `${FateDropColors.mint}12`, borderWidth: 1, borderColor: `${FateDropColors.mint}40` },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint },
  liveText: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  sectionLabel: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 20, marginBottom: 9 },
  variantRow: { flexDirection: 'row', gap: 8 },
  variant: { flex: 1, minHeight: 82, padding: 11, borderRadius: 17, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  variantActive: { borderColor: `${FateDropColors.violetLight}99`, backgroundColor: `${FateDropColors.violet}18` },
  variantTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900', marginTop: 7 },
  variantSub: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 },
  activeText: { color: FateDropColors.cyan },
  voxCard: { marginTop: 10, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  voxIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violet}18` },
  voxCopy: { flex: 1 },
  voxTitle: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' },
  voxText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  voxStatus: { color: '#F8B66D', fontSize: 6, fontWeight: '900', letterSpacing: 1 },
  reactionRow: { gap: 8, paddingRight: 12 },
  reaction: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  reactionActive: { backgroundColor: `${FateDropColors.violet}1F`, borderColor: `${FateDropColors.violetLight}88` },
  reactionText: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '800' },
  infoCard: { marginTop: 20, flexDirection: 'row', gap: 12, padding: 15, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  infoIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violet}18` },
  infoCopy: { flex: 1 },
  infoTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  infoText: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 4 },
});
