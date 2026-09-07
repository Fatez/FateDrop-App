import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateGlassPanel, FateMetricStrip, FateSectionHeading } from '@/components/fate-polish-ui';
import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { isFeatureEnabled, type FeatureFlag } from '@/constants/features';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

type Tool = { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; path: Href; color: string; feature?: FeatureFlag; badge?: string };

const collectorTools: Tool[] = [
  { title: 'FateFind', detail: 'Find the strongest live deal, then keep hunting under your rules.', icon: 'telescope-outline', path: '/fatefind', color: FateDropColors.goldBright, badge: 'INTELLIGENCE' },
  { title: 'FatePrice', detail: 'Exact-card value, movement and market evidence.', icon: 'pricetag-outline', path: '/fate-price', color: FateDropColors.cyan, badge: 'MARKET' },
  { title: 'Wishlist', detail: 'Save products without turning a passive bookmark into an active hunt.', icon: 'bookmark-outline', path: '/(tabs)/watchlist', color: FateDropColors.violetLight, badge: 'SAVED' },
  { title: 'Local Radar', detail: 'Nearby shops, branch intelligence and collector events.', icon: 'navigate-outline', path: '/local-radar', color: FateDropColors.blue, feature: 'localRadar', badge: 'NEARBY' },
  { title: 'Fate Encounters', detail: 'Shows, tournaments, trade nights and event discovery.', icon: 'calendar-outline', path: '/encounters', color: FateDropColors.amber, badge: 'EVENTS' },
];

const experienceTools: Tool[] = [
  { title: 'App Guide', detail: 'Replay the FateDrop tour and understand every lifecycle state.', icon: 'compass-outline', path: '/onboarding', color: FateDropColors.goldBright },
  { title: 'Notification preferences', detail: 'Choose lifecycle and delivery surfaces.', icon: 'notifications-outline', path: '/notification-preferences', color: FateDropColors.cyan },
  { title: 'Fate Companion', detail: 'Open your Koru & Friends companion experience.', icon: 'sparkles-outline', path: '/companion', color: FateDropColors.violetLight },
  { title: 'FateDrop ID', detail: 'Identity, membership and cross-platform sync.', icon: 'person-circle-outline', path: '/account', color: FateDropColors.mint },
  { title: 'Live Network', detail: 'See public retailer coverage and monitor health.', icon: 'pulse-outline', path: '/(tabs)/network', color: FateDropColors.manifested },
];

export default function MoreScreenV3() {
  const { snapshot, signedIn, syncing } = useFateDropId();
  const visibleCollectorTools = collectorTools.filter((item) => !item.feature || isFeatureEnabled(item.feature));
  const displayName = snapshot?.user.displayName || snapshot?.user.handle || 'Collector';
  const fateId = snapshot?.user.fateId || null;
  const tier = snapshot?.entitlement.effectiveTier?.toUpperCase() || 'FREE';
  const activeFinds = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const selectedTcgs = snapshot?.tcgPreferences?.selectedTcgCodes?.length ?? 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="More" subtitle="THE REST OF FATEDROP" />

        <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [styles.identity, pressed && styles.pressed]}>
          <View style={styles.avatar}><Ionicons name={signedIn ? 'person' : 'person-outline'} size={22} color={FateDropColors.goldBright} /></View>
          <View style={styles.identityCopy}>
            <Text style={styles.identityEyebrow}>{signedIn ? `FATEDROP ID · ${tier}` : 'FATEDROP ID'}</Text>
            <Text style={styles.identityTitle}>{signedIn ? displayName : 'Connect your collector identity'}</Text>
            <Text style={styles.identityDetail}>{signedIn ? `${fateId || 'ID synced'} · ${syncing ? 'syncing now' : 'synced'}` : 'One identity for app, web, preferences and collection tools.'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={FateDropColors.goldBright} />
        </Pressable>

        <FateGlassPanel accent={FateDropColors.violetLight} style={styles.hero}>
          <Text style={styles.heroEyebrow}>FATEDROP TOOL DIRECTORY</Text>
          <Text style={styles.heroTitle}>Power when you need it. Calm when you do not.</Text>
          <Text style={styles.heroCopy}>The main tabs stay focused. Every specialist tool remains one clear step away, grouped by what you are trying to achieve.</Text>
          <View style={styles.heroRule} />
          <View style={styles.heroRoute}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.heroRouteText}>Find · value · save · explore · manage</Text></View>
        </FateGlassPanel>

        <FateMetricStrip items={[
          { icon: 'telescope-outline', value: String(activeFinds), label: 'ACTIVE FINDS', color: FateDropColors.goldBright },
          { icon: 'layers-outline', value: String(selectedTcgs), label: 'TCG INTERESTS', color: FateDropColors.cyan },
          { icon: signedIn ? 'cloud-done-outline' : 'cloud-offline-outline', value: signedIn ? 'SYNCED' : 'LOCAL', label: 'IDENTITY', color: signedIn ? FateDropColors.manifested : FateDropColors.echo },
        ]} />

        <FateSectionHeading eyebrow="COLLECTOR TOOLS" title="Do something with the network." copy="Action-oriented features live here without competing with Home, Alerts or Fate Market." />
        <View style={styles.toolGrid}>{visibleCollectorTools.map((item) => <FeatureCard key={item.title} item={item} />)}</View>

        <FateSectionHeading eyebrow="ACCOUNT & EXPERIENCE" title="Shape your FateDrop." copy="Guide, notifications, companion, identity and network visibility." />
        <View style={styles.toolList}>{experienceTools.map((item) => <ToolRow key={item.title} item={item} />)}</View>

        <View style={styles.systemNote}>
          <Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright} />
          <View style={styles.toolCopy}>
            <Text style={styles.noteTitle}>The machinery stays behind the experience.</Text>
            <Text style={styles.noteCopy}>Retailer imports, monitoring telemetry, billing infrastructure and experimental systems remain operational surfaces — collectors only see the tools and evidence they need.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCard({ item }: { item: Tool }) {
  return <Pressable onPress={() => router.push(item.path)} style={({ pressed }) => [styles.featureCard, pressed && styles.pressed]}>
    <View style={styles.featureTop}>
      <View style={[styles.featureIcon, { backgroundColor: `${item.color}10`, borderColor: `${item.color}38` }]}><Ionicons name={item.icon} size={20} color={item.color} /></View>
      {item.badge ? <Text style={[styles.featureBadge, { color: item.color }]}>{item.badge}</Text> : null}
    </View>
    <Text style={styles.featureTitle}>{item.title}</Text>
    <Text style={styles.featureDetail}>{item.detail}</Text>
    <View style={styles.featureFooter}><Text style={[styles.openLabel, { color: item.color }]}>OPEN</Text><Ionicons name="arrow-forward" size={14} color={item.color} /></View>
  </Pressable>;
}

function ToolRow({ item }: { item: Tool }) {
  return <Pressable onPress={() => router.push(item.path)} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
    <View style={[styles.toolIcon, { backgroundColor: `${item.color}10`, borderColor: `${item.color}30` }]}><Ionicons name={item.icon} size={19} color={item.color} /></View>
    <View style={styles.toolCopy}><Text style={styles.toolTitle}>{item.title}</Text><Text style={styles.toolDetail}>{item.detail}</Text></View>
    <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 120 }, pressed: { opacity: .76, transform: [{ scale: .99 }] },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.goldBright}30`, backgroundColor: 'rgba(9,14,22,.91)', marginBottom: 11 }, avatar: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.goldBright}0D`, borderWidth: 1, borderColor: `${FateDropColors.goldBright}30` }, identityCopy: { flex: 1 }, identityEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 }, identityTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 3 }, identityDetail: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  hero: { padding: 20, marginBottom: 11 }, heroEyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.25 }, heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 27, lineHeight: 31, marginTop: 7, maxWidth: 330 }, heroCopy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 8 }, heroRule: { height: 1, backgroundColor: 'rgba(226,197,141,.18)', marginTop: 15, marginBottom: 10 }, heroRoute: { flexDirection: 'row', alignItems: 'center', gap: 7 }, heroRouteText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '800', letterSpacing: .3 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, featureCard: { width: '48.5%', minHeight: 168, padding: 14, borderRadius: 19, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(10,14,23,.91)' }, featureTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, featureIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, featureBadge: { fontSize: 6.5, fontWeight: '900', letterSpacing: .65, marginTop: 2 }, featureTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 11 }, featureDetail: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 4, paddingBottom: 24 }, featureFooter: { position: 'absolute', left: 14, bottom: 13, flexDirection: 'row', alignItems: 'center', gap: 5 }, openLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: .65 },
  toolList: { gap: 8 }, tool: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(12,16,24,.90)' }, toolIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, toolCopy: { flex: 1 }, toolTitle: { color: FateDropColors.ivory, fontSize: 12.5, fontWeight: '900' }, toolDetail: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  systemNote: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.goldBright}24`, backgroundColor: 'rgba(7,12,20,.76)', marginTop: 20 }, noteTitle: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '900' }, noteCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 3 },
});
