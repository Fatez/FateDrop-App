import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanionStage, type CompanionVariant } from '@/components/companion-stage';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import type { CompanionReaction } from '@/lib/companion-contract';

const variants: { id: CompanionVariant; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'male', title: 'Male', subtitle: 'Collector companion', icon: 'person' },
  { id: 'female', title: 'Female', subtitle: 'Collector companion', icon: 'person' },
  { id: 'droid', title: 'Droid', subtitle: 'Signal familiar', icon: 'hardware-chip' },
];

const reactions: { id: CompanionReaction; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'echo', label: 'Echo' },
  { id: 'manifested', label: 'Manifested' },
  { id: 'vanished', label: 'Vanished' },
  { id: 'fatematch', label: 'FateMatch' },
];

export default function CompanionScreen() {
  const [variant, setVariant] = useState<CompanionVariant>('male');
  const [reaction, setReaction] = useState<CompanionReaction>('idle');

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={FateDropColors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>FATEDROP COMPANION</Text><Text style={styles.title}>Your signal has a face.</Text></View>
          <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>3D LIVE</Text></View>
        </View>

        <CompanionStage variant={variant} reaction={reaction} />

        <Text style={styles.sectionLabel}>CHOOSE COMPANION</Text>
        <View style={styles.variantRow}>
          {variants.map((item) => {
            const active = item.id === variant;
            return <Pressable key={item.id} onPress={() => setVariant(item.id)} style={[styles.variant, active && styles.variantActive]}>
              <Ionicons name={item.icon} size={18} color={active ? FateDropColors.cyan : FateDropColors.secondary} />
              <Text style={[styles.variantTitle, active && styles.activeText]}>{item.title}</Text>
              <Text style={styles.variantSub}>{item.subtitle}</Text>
            </Pressable>;
          })}
        </View>

        <Text style={styles.sectionLabel}>TEST SIGNAL REACTION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionRow}>
          {reactions.map((item) => <Pressable key={item.id} onPress={() => setReaction(item.id)} style={[styles.reaction, reaction === item.id && styles.reactionActive]}><Text style={[styles.reactionText, reaction === item.id && styles.activeText]}>{item.label}</Text></Pressable>)}
        </ScrollView>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="flash" size={18} color={FateDropColors.violetLight} /></View>
          <View style={styles.infoCopy}><Text style={styles.infoTitle}>Not just decoration</Text><Text style={styles.infoText}>The Companion contract already understands Echo, Manifested, Vanished, FateMatch and major signal states. This preview gives those states a real 3D surface without making the renderer critical to the rest of the app.</Text></View>
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
