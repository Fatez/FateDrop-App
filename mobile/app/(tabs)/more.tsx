import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { isFeatureEnabled, type FeatureFlag } from '@/constants/features';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

interface Destination {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href;
  color: string;
  feature?: FeatureFlag;
}

const destinations: Destination[] = [
  { title: 'FateDrop ID', subtitle: 'Identity, membership and cross-platform sync', icon: 'person-circle', path: '/account', color: FateDropColors.cyan },
  { title: 'Fate Companion', subtitle: 'Your reactive collector companion', icon: 'sparkles', path: '/companion', color: FateDropColors.violetLight },
  { title: 'Wishlist', subtitle: 'Products you want to keep across the network', icon: 'bookmark', path: '/(tabs)/watchlist', color: FateDropColors.violetLight },
  { title: 'FateFind', subtitle: 'Create active product hunts with price and stock rules', icon: 'telescope', path: '/fatefind', color: FateDropColors.violetLight },
  { title: 'True Price', subtitle: 'Compare known delivered cost and RRP context', icon: 'pricetags', path: '/true-price', color: FateDropColors.cyan },
  { title: 'Fate Encounters', subtitle: 'Nearby indie shops, events, tournaments, trade nights and conventions', icon: 'map', path: '/encounters', color: FateDropColors.amber, feature: 'localRadar' },
];

export default function MoreScreen() {
  const visible = destinations.filter((item) => !item.feature || isFeatureEnabled(item.feature));
  const { snapshot, signedIn, syncing } = useFateDropId();

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <FateDropHeader title="More" />
        <AbstractHero eyebrow="Your FateDrop" title="Everything secondary, kept out of the way." subtitle="Companion, identity, Wishlist, active hunts and local discovery live here so Search, Indies and Alerts stay focused." icon="options" />

        <Pressable onPress={() => router.push('/account')} style={styles.identity}>
          <View><Text style={styles.identityLabel}>FATEDROP ID</Text><Text style={styles.identityTitle}>{signedIn ? snapshot?.user.displayName || snapshot?.user.handle || snapshot?.user.fateId : 'Connect your identity'}</Text><Text style={styles.identitySub}>{signedIn ? `${snapshot?.entitlement.effectiveTier.toUpperCase()} · ${syncing ? 'syncing' : 'synced across the network'}` : 'One account for web, app and connected Discord access'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={FateDropColors.violetLight} />
        </Pressable>

        <View style={styles.destinations}>
          {visible.slice(1).map((item) => (
            <Pressable key={item.title} onPress={() => router.push(item.path)} style={styles.destination}>
              <View style={[styles.icon, { backgroundColor: `${item.color}14` }]}><Ionicons name={item.icon} size={20} color={item.color} /></View>
              <View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.subtitle}>{item.subtitle}</Text></View>
              <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.note}><Ionicons name="layers-outline" size={18} color={FateDropColors.cyan} /><View style={styles.copy}><Text style={styles.noteTitle}>Advanced systems stay behind the scenes</Text><Text style={styles.noteText}>Retailer analytics, catalogue imports, monitor health, experimental scoring and future basket optimisation are not collector navigation items.</Text></View></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  identity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, marginBottom: 12, borderRadius: 18, backgroundColor: `${FateDropColors.violet}12`, borderWidth: 1, borderColor: `${FateDropColors.violet}40` },
  identityLabel: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  identityTitle: { color: FateDropColors.text, fontWeight: '900', fontSize: 14, marginTop: 4 },
  identitySub: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 },
  destinations: { gap: 9 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: FateDropColors.text, fontWeight: '900', fontSize: 14 },
  subtitle: { color: FateDropColors.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  note: { flexDirection: 'row', gap: 11, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginTop: 18 },
  noteTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  noteText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
});
