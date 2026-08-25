import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';

const journey = [
  { icon: 'search-outline' as const, title: 'Search', copy: 'See what is available across the live FateDrop network.' },
  { icon: 'bookmark-outline' as const, title: 'Wishlist', copy: 'Remember products you care about without starting monitoring.' },
  { icon: 'telescope-outline' as const, title: 'FateFind', copy: 'Compare equivalent offers using verified RRP, True Price and the Cloud Fate Verdict — then keep hunting under your rules.' },
  { icon: 'sparkles-outline' as const, title: 'FateMatch', copy: 'When an active FateFind meets your conditions, that successful result becomes a FateMatch.' },
];

const lifecycle = [
  ['Oru', 'Whisper', 'Earliest credible movement'],
  ['Fenn', 'Echo', 'Developing evidence'],
  ['Koru', 'Manifested', 'Confirmed live'],
  ['Nyxen', 'Vanished', 'Confirmed availability disappeared'],
] as const;

export default function DemoRoute() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="How FateDrop Works" subtitle="THE COLLECTOR JOURNEY" />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SEARCH → WISHLIST → FATEFIND → FATEMATCH</Text>
          <Text style={styles.heroTitle}>From finding a product to finding the right moment to buy it.</Text>
          <Text style={styles.heroCopy}>FateDrop separates discovery, memory, intelligent hunting and successful results so each tool has one clear job.</Text>
        </View>

        <Text style={styles.sectionTitle}>THE CORE FLOW</Text>
        <View style={styles.list}>
          {journey.map((item, index) => (
            <View key={item.title} style={styles.card}>
              <View style={styles.icon}><Ionicons name={item.icon} size={20} color={FateDropColors.goldBright} /></View>
              <View style={styles.flex}>
                <Text style={styles.step}>0{index + 1}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardCopy}>{item.copy}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>NETWORK LIFECYCLE</Text>
        <View style={styles.lifecyclePanel}>
          {lifecycle.map(([companion, stage, detail]) => (
            <View key={stage} style={styles.lifecycleRow}>
              <View style={styles.flex}>
                <Text style={styles.lifecycleTitle}>{companion} · {stage}</Text>
                <Text style={styles.lifecycleCopy}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>True Price lives inside FateFind.</Text>
          <Text style={styles.noteCopy}>RRP percentage uses item price against the verified reference. True Price adds known mandatory delivery and fees. Unknown delivery stays unknown — never £0 by assumption.</Text>
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
  sectionTitle: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9 },
  list: { gap: 9, marginBottom: 24 },
  card: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}33`, backgroundColor: `${FateDropColors.gold}10` },
  flex: { flex: 1 },
  step: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  cardTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900', marginTop: 2 },
  cardCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  lifecyclePanel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, overflow: 'hidden', marginBottom: 20 },
  lifecycleRow: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FateDropColors.borderSoft },
  lifecycleTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900' },
  lifecycleCopy: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
  note: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.cyan}33`, backgroundColor: 'rgba(10,20,27,.9)' },
  noteTitle: { color: FateDropColors.cyan, fontSize: 14, fontWeight: '900' },
  noteCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
