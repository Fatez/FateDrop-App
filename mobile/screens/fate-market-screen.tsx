import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';

const marketAreas = [
  {
    icon: 'pulse-outline' as const,
    eyebrow: 'FATEPULSE',
    title: 'Market movement',
    copy: 'Market Heat, price direction, volatility, heating and cooling sets, and unusual movers.',
    accent: FateDropColors.manifested,
  },
  {
    icon: 'pricetag-outline' as const,
    eyebrow: 'FATEPRICE',
    title: 'Know the value',
    copy: 'Card value, sold-history evidence, fair ranges and price comparison from canonical market data.',
    accent: FateDropColors.goldBright,
  },
  {
    icon: 'albums-outline' as const,
    eyebrow: 'FATECOLLECTOR',
    title: 'Your collection',
    copy: 'Collection value, set completion, missing cards and performance — including the investment view.',
    accent: FateDropColors.echo,
  },
] as const;

export default function FateMarketScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FATEDROP MARKET</Text>
          <Text style={styles.title}>See the market. Know the value. Understand what you own.</Text>
          <Text style={styles.copy}>One market layer for Pulse, Price and Collector — all backed by the same Cloud-owned evidence.</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCompass}>
            <View style={styles.heroCompassInner}>
              <Ionicons name="analytics-outline" size={28} color={FateDropColors.goldBright} />
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>MARKET INTELLIGENCE</Text>
            <Text style={styles.heroTitle}>Fate Market</Text>
            <Text style={styles.heroDetail}>FatePulse is being built first. FatePrice and FateCollector will plug into the same market foundation rather than creating separate truth.</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>MARKET AREAS</Text>
        <View style={styles.stack}>
          {marketAreas.map((area) => (
            <View key={area.eyebrow} style={styles.card}>
              <View style={[styles.iconPlate, { borderColor: `${area.accent}55`, backgroundColor: `${area.accent}10` }]}>
                <Ionicons name={area.icon} size={23} color={area.accent} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.cardEyebrow, { color: area.accent }]}>{area.eyebrow}</Text>
                <Text style={styles.cardTitle}>{area.title}</Text>
                <Text style={styles.cardDetail}>{area.copy}</Text>
              </View>
              <View style={styles.foundationPill}>
                <Text style={styles.foundationText}>FOUNDATION</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ruleCard}>
          <Ionicons name="shield-checkmark-outline" size={19} color={FateDropColors.goldBright} />
          <Text style={styles.ruleText}>No invented prices, heat or performance. Missing market evidence stays unknown until the Cloud has enough verified history.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 124 },
  header: { paddingHorizontal: 2, paddingBottom: 20 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 31, lineHeight: 36, fontWeight: '700', marginTop: 7 },
  copy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 560 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 17, borderRadius: 22, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  heroCompass: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: `${FateDropColors.goldBright}66`, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.goldBright}09` },
  heroCompassInner: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${FateDropColors.manifested}66`, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.card },
  heroCopy: { flex: 1 },
  heroLabel: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { color: FateDropColors.ivory, fontSize: 21, fontWeight: '900', marginTop: 3 },
  heroDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  sectionLabel: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 24, marginBottom: 10 },
  stack: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 19, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  iconPlate: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  cardTitle: { color: FateDropColors.ivory, fontSize: 17, fontWeight: '900', marginTop: 2 },
  cardDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  foundationPill: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  foundationText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  ruleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  ruleText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
});
