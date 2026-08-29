import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';

const features = [
  { icon: 'search-outline' as const, title: 'Search', copy: 'Browse products and see the live retailer offers FateDrop currently knows about.', path: '/(tabs)/search' as Href },
  { icon: 'bookmark-outline' as const, title: 'Wishlist', copy: 'Remember products without turning monitoring on. Wishlist is memory, not an alert instruction.', path: '/(tabs)/watchlist' as Href },
  { icon: 'telescope-outline' as const, title: 'FateFind', copy: 'Find the strongest current buying opportunity using verified product identity, RRP and known True Price evidence.', path: '/fatefind' as Href },
  { icon: 'sparkles-outline' as const, title: 'FateMatch', copy: 'Ask FateDrop to keep watching your conditions. A matching live opportunity becomes a FateMatch.', path: '/fate-match' as Href },
  { icon: 'cash-outline' as const, title: 'True Price', copy: 'See item price against verified RRP. Known mandatory delivery is added when FateDrop actually knows it; unknown stays unknown.', path: '/true-price' as Href },
  { icon: 'notifications-outline' as const, title: 'Alerts', copy: 'Read Whisper, Echo, Manifested and Vanished signals and see the evidence behind what changed.', path: '/(tabs)/alerts' as Href },
  { icon: 'navigate-outline' as const, title: 'Local Radar', copy: 'Physical-store intelligence stays separate from online stock. Branch truth is only shown when the evidence supports it.', path: '/local-radar' as Href },
  { icon: 'storefront-outline' as const, title: 'Fate Network', copy: 'Explore major retailers, specialists and independent stores without changing canonical stock truth.', path: '/(tabs)/indies' as Href },
] as const;

const lifecycle = [
  { companion: 'Oru', stage: 'Whisper', detail: 'Earliest credible movement. Something meaningful may be starting, but live stock is not confirmed.', color: FateDropColors.whisper },
  { companion: 'Fenn', stage: 'Echo', detail: 'Evidence is strengthening. Get ready, but do not treat it as confirmed physical stock unless FateDrop says so.', color: FateDropColors.echo },
  { companion: 'Koru', stage: 'Manifested', detail: 'Confirmed live in the exact signal context shown. This is the act-now lifecycle state.', color: FateDropColors.manifested },
  { companion: 'Nyxen', stage: 'Vanished', detail: 'A previously confirmed live opportunity is no longer observed as available.', color: FateDropColors.vanished },
] as const;

export default function DemoRoute() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="FateDrop Guide" subtitle="REOPEN THIS ANY TIME" />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SEARCH → WISHLIST → FATEFIND → FATEMATCH</Text>
          <Text style={styles.heroTitle}>One place to understand every part of FateDrop.</Text>
          <Text style={styles.heroCopy}>Use this guide whenever you want to revisit a feature, understand an alert or replay the full guided introduction.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding')} style={({ pressed }) => [styles.tourButton, pressed && styles.pressed]}>
            <Ionicons name="play-circle-outline" size={20} color="#090A0F" />
            <View style={styles.flex}>
              <Text style={styles.tourButtonTitle}>REPLAY FULL GUIDED TOUR</Text>
              <Text style={styles.tourButtonCopy}>Walk through the collector journey and all four lifecycle signals.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#090A0F" />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>FEATURE GUIDE</Text>
        <View style={styles.list}>
          {features.map((item) => (
            <Pressable key={item.title} accessibilityRole="button" onPress={() => router.push(item.path)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.icon}><Ionicons name={item.icon} size={20} color={FateDropColors.goldBright} /></View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardCopy}>{item.copy}</Text>
                <Text style={styles.openLabel}>OPEN {item.title.toUpperCase()} →</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>NETWORK LIFECYCLE</Text>
        <View style={styles.lifecyclePanel}>
          {lifecycle.map((item) => (
            <Pressable key={item.stage} onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: item.stage.toUpperCase() } })} style={({ pressed }) => [styles.lifecycleRow, pressed && styles.pressed]}>
              <View style={[styles.lifecycleDot, { backgroundColor: item.color }]} />
              <View style={styles.flex}>
                <Text style={[styles.lifecycleTitle, { color: item.color }]}>{item.companion} · {item.stage}</Text>
                <Text style={styles.lifecycleCopy}>{item.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={item.color} />
            </Pressable>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Cloud truth always wins.</Text>
          <Text style={styles.noteCopy}>Online stock never becomes physical branch stock by assumption. Product identity, retailer identity, RRP and lifecycle evidence stay canonical, and unknown information stays unknown.</Text>
        </View>

        <View style={styles.mangaNote}>
          <Ionicons name="book-outline" size={19} color={FateDropColors.violetLight} />
          <View style={styles.flex}>
            <Text style={styles.mangaTitle}>Feature manga can sit alongside this guide.</Text>
            <Text style={styles.mangaCopy}>The Guide remains the quick product reference; story-led explainers can deepen each feature without making the main interface harder to understand.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { padding: 20, borderRadius: 22, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(12,17,24,.92)', marginBottom: 22 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  heroTitle: { color: FateDropColors.text, fontSize: 27, lineHeight: 31, fontWeight: '900', marginTop: 8 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  tourButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17, padding: 14, borderRadius: 16, backgroundColor: FateDropColors.goldBright },
  tourButtonTitle: { color: '#090A0F', fontSize: 10, fontWeight: '900', letterSpacing: .65 },
  tourButtonCopy: { color: 'rgba(9,10,15,.72)', fontSize: 9, lineHeight: 13, marginTop: 2 },
  sectionTitle: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9 },
  list: { gap: 9, marginBottom: 24 },
  card: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}33`, backgroundColor: `${FateDropColors.gold}10` },
  cardTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900' },
  cardCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  openLabel: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: .7, marginTop: 8 },
  lifecyclePanel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, overflow: 'hidden', marginBottom: 20 },
  lifecycleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FateDropColors.borderSoft },
  lifecycleDot: { width: 9, height: 9, borderRadius: 5 },
  lifecycleTitle: { fontSize: 14, fontWeight: '900' },
  lifecycleCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  note: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.cyan}33`, backgroundColor: 'rgba(10,20,27,.9)', marginBottom: 10 },
  noteTitle: { color: FateDropColors.cyan, fontSize: 14, fontWeight: '900' },
  noteCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  mangaNote: { flexDirection: 'row', gap: 11, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.violetLight}2E`, backgroundColor: 'rgba(18,13,27,.9)' },
  mangaTitle: { color: FateDropColors.violetLight, fontSize: 13, fontWeight: '900' },
  mangaCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },
  flex: { flex: 1 },
});