import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { isFeatureEnabled, type FeatureFlag } from '@/constants/features';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

type Tool = {
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href;
  color: string;
  feature?: FeatureFlag;
};

const collectorTools: Tool[] = [
  { title: 'FateFind', detail: 'Find the strongest-value live buying option now.', icon: 'telescope-outline', path: '/fatefind', color: FateDropColors.violetLight },
  { title: 'FateMatch', detail: 'Let your companion watch for stock and alert you when it goes live.', icon: 'notifications-outline', path: '/fatematch', color: FateDropColors.mint },
  { title: 'Wishlist', detail: 'Keep products saved across the collector journey.', icon: 'bookmark-outline', path: '/(tabs)/watchlist', color: FateDropColors.violetLight },
  { title: 'Local Radar', detail: 'Nearby shops and collector events.', icon: 'navigate-outline', path: '/local-radar', color: FateDropColors.blue, feature: 'localRadar' },
  { title: 'Fate Encounters', detail: 'Shows, tournaments and trade nights.', icon: 'calendar-outline', path: '/encounters', color: FateDropColors.amber },
];

const accountTools: Tool[] = [
  { title: 'Notification preferences', detail: 'Choose lifecycle and delivery surfaces.', icon: 'notifications-outline', path: '/notification-preferences', color: FateDropColors.cyan },
  { title: 'Fate Companion', detail: 'Your persistent Koru & Friends companion loadout.', icon: 'sparkles-outline', path: '/companion', color: FateDropColors.violetLight },
  { title: 'FateDrop ID', detail: 'Identity, membership and cross-platform sync.', icon: 'person-circle-outline', path: '/account', color: FateDropColors.mint },
];

function ToolRow({ item }: { item: Tool }) {
  return <Pressable onPress={() => router.push(item.path)} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
    <View style={[styles.toolIcon, { backgroundColor: `${item.color}12`, borderColor: `${item.color}24` }]}><Ionicons name={item.icon} size={19} color={item.color} /></View>
    <View style={styles.toolCopy}><Text style={styles.toolTitle}>{item.title}</Text><Text style={styles.toolDetail}>{item.detail}</Text></View>
    <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
  </Pressable>;
}

export default function MoreScreenV2() {
  const { snapshot, signedIn, syncing } = useFateDropId();
  const visibleCollectorTools = collectorTools.filter((item) => !item.feature || isFeatureEnabled(item.feature));
  const displayName = snapshot?.user.displayName || snapshot?.user.handle || 'Collector';
  const fateId = snapshot?.user.fateId || null;
  const tier = snapshot?.entitlement.effectiveTier?.toUpperCase() || 'FREE';

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <FateDropHeader title="More" subtitle="YOUR FATEDROP" />

    <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [styles.identity, pressed && styles.pressed]}>
      <View style={styles.avatar}><Ionicons name={signedIn ? 'person' : 'person-outline'} size={22} color={FateDropColors.violetLight} /></View>
      <View style={styles.identityCopy}>
        <Text style={styles.identityEyebrow}>{signedIn ? `FATEDROP ID · ${tier}` : 'FATEDROP ID'}</Text>
        <Text style={styles.identityTitle}>{signedIn ? displayName : 'Connect your collector identity'}</Text>
        <Text style={styles.identityDetail}>{signedIn ? `${fateId || 'ID synced'} · ${syncing ? 'syncing now' : 'synced across FateDrop'}` : 'One identity for app, Web, preferences and linked Discord access.'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={FateDropColors.violetLight} />
    </Pressable>

    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.heroEyebrow}>THE REST OF THE NETWORK</Text>
      <Text style={styles.heroTitle}>Powerful tools without cluttering the core tabs.</Text>
      <Text style={styles.heroCopy}>Home, Search, Indies and Alerts stay focused. FateFind finds the best live deal using RRP percentage and includes True Price when delivery is known. FateMatch watches a specific product until your budget and buying conditions are met.</Text>
    </View>

    <View style={styles.sectionHead}><Text style={styles.sectionEyebrow}>COLLECTOR TOOLS</Text><Text style={styles.sectionCount}>{visibleCollectorTools.length}</Text></View>
    <View style={styles.toolList}>{visibleCollectorTools.map((item) => <ToolRow key={item.title} item={item} />)}</View>

    <View style={styles.sectionHead}><Text style={styles.sectionEyebrow}>ACCOUNT & EXPERIENCE</Text><Text style={styles.sectionCount}>{accountTools.length}</Text></View>
    <View style={styles.toolList}>{accountTools.map((item) => <ToolRow key={item.title} item={item} />)}</View>

    <View style={styles.systemNote}>
      <Ionicons name="layers-outline" size={18} color={FateDropColors.cyan} />
      <View style={styles.toolCopy}><Text style={styles.noteTitle}>Advanced systems stay behind the interface.</Text><Text style={styles.noteCopy}>Retailer imports, monitoring telemetry, billing infrastructure and experimental systems are operational tools — not things collectors should have to navigate around.</Text></View>
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 120 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, borderRadius: 19, borderWidth: 1, borderColor: `${FateDropColors.violetLight}36`, backgroundColor: 'rgba(15,13,25,.94)', marginBottom: 11 }, avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}14`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}26` }, identityCopy: { flex: 1 }, identityEyebrow: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 }, identityTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900', marginTop: 3 }, identityDetail: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 13, marginTop: 3 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 22, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(9,10,17,.92)', marginBottom: 20 }, heroGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -70, top: -90, backgroundColor: 'rgba(124,58,237,.11)' }, heroEyebrow: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: FateDropColors.text, fontSize: 24, lineHeight: 27, fontWeight: '900', letterSpacing: -.6, marginTop: 7, maxWidth: 320 }, heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }, sectionEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, sectionCount: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900' }, toolList: { gap: 8, marginBottom: 20 }, tool: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' }, toolIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, toolCopy: { flex: 1 }, toolTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900' }, toolDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 }, systemNote: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, noteTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' }, noteCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 }, pressed: { opacity: .78, transform: [{ scale: .99 }] },
});
