import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CanonicalThumbnail } from '@/components/canonical-thumbnail';
import { FateMarketBackground, FateMarketHeader } from '@/components/fate-market-brand';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  fetchFatePulse,
  type FatePulseDirectionPeriod,
  type FatePulseRankedCard,
  type FatePulseRankedSet,
  type FatePulseSnapshot,
} from '@/services/fate-market';

type PulsePeriod = 'd1' | 'd7' | 'd30' | 'd90';

const PERIODS: { key: PulsePeriod; label: string }[] = [
  { key: 'd1', label: '1D' },
  { key: 'd7', label: '7D' },
  { key: 'd30', label: '30D' },
  { key: 'd90', label: '90D' },
];

const TABS = [
  { label: 'Overview', route: '/fate-pulse' as const, active: true },
  { label: 'Sets', route: '/fate-pulse/sets' as const, active: false },
  { label: 'Cards', route: '/fate-pulse/cards' as const, active: false },
  { label: 'My Pulse', route: '/fate-pulse/my-pulse' as const, active: false },
];

function movement(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function conditionLabel(value: FatePulseDirectionPeriod['condition'] | undefined) {
  if (value === 'broadly_rising') return 'Heating up';
  if (value === 'broadly_falling') return 'Cooling down';
  if (value === 'mixed') return 'Mixed market';
  if (value === 'unchanged') return 'Stable';
  return 'Building history';
}

function conditionColor(value: FatePulseDirectionPeriod['condition'] | undefined) {
  if (value === 'broadly_falling') return FateDropColors.vanished;
  if (value === 'mixed' || value === 'unchanged') return FateDropColors.goldBright;
  return FateDropColors.manifested;
}

function formatMoney(value: number | null | undefined, currencyCode: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const currency = currencyCode || 'EUR';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function FatePulseOverviewScreen() {
  const [periodKey, setPeriodKey] = useState<PulsePeriod>('d30');
  const [pulse, setPulse] = useState<FatePulseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  const load = useCallback(async (force = false) => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const next = await fetchFatePulse(undefined, { force });
      if (request !== generation.current) return;
      setPulse(next);
    } catch {
      if (request !== generation.current) return;
      setError('Market data is temporarily unavailable.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(false);
    return () => {
      generation.current += 1;
    };
  }, [load]));

  const period = periodKey === 'd90' ? undefined : pulse?.pulse?.direction?.periods[periodKey];
  const accent = conditionColor(period?.condition);
  const risers = (period?.cardRisers ?? []).slice(0, 3);
  const fallers = (period?.cardDecliners ?? []).slice(0, 3);
  const heatingSets = (period?.setRisers ?? []).slice(0, 3);
  const currencyCode = pulse?.source.currencyCode;
  const is90 = periodKey === 'd90';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateMarketBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true)} tintColor={FateDropColors.goldBright} />}
      >
        <FateMarketHeader title="FatePulse" subtitle="Understand the market. Follow what matters to you." />

        <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}>
          <Ionicons name="search" size={18} color={FateDropColors.secondary} />
          <Text style={styles.searchText}>Search any card or set</Text>
          <Ionicons name="chevron-forward" size={15} color={FateDropColors.muted} />
        </Pressable>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map((tab) => (
            <Pressable key={tab.label} accessibilityRole="tab" accessibilityState={{ selected: tab.active }} onPress={() => router.replace(tab.route)} style={styles.tab}>
              <Text style={[styles.tabText, tab.active && styles.tabTextActive]}>{tab.label}</Text>
              {tab.active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.periodRail}>
          {PERIODS.map((item) => (
            <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: periodKey === item.key }} onPress={() => setPeriodKey(item.key)} style={[styles.periodButton, periodKey === item.key && styles.periodButtonActive]}>
              <Text style={[styles.periodText, periodKey === item.key && styles.periodTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <View style={styles.errorCard}><Ionicons name="cloud-offline-outline" size={16} color={FateDropColors.vanished} /><Text style={styles.errorText}>{error}</Text></View> : null}
        {loading && !pulse ? <View style={styles.loadingCard}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Loading market movement…</Text></View> : null}

        <View style={styles.marketSummary}>
          <View style={styles.summaryTop}>
            <View style={styles.flex}>
              <Text style={styles.summaryEyebrow}>TRACKED TCG MARKET</Text>
              <View style={styles.summaryValueRow}>
                <Text style={[styles.summaryValue, { color: is90 ? FateDropColors.muted : accent }]}>{is90 ? '—' : movement(period?.headlinePercent)}</Text>
                <Text style={[styles.summaryCondition, { color: is90 ? FateDropColors.goldBright : accent }]}>· {is90 ? '90D building' : conditionLabel(period?.condition)}</Text>
              </View>
            </View>
            <View style={[styles.directionBadge, { borderColor: `${accent}55` }]}>
              <Ionicons name={(period?.headlinePercent ?? 0) < 0 ? 'trending-down' : 'trending-up'} size={18} color={is90 ? FateDropColors.muted : accent} />
            </View>
          </View>
          <Text style={styles.summaryCopy}>{is90 ? '90-day rankings will appear when verified 90D market history is available.' : period?.status === 'available' ? `${period.breadth.risingSets} sets rising · ${period.breadth.fallingSets} falling in this window.` : 'Verified market history is still building for this window.'}</Text>
        </View>

        <MoverSection title="Biggest Card Risers" icon="trending-up" accent={FateDropColors.manifested} items={risers} currencyCode={currencyCode} onSeeAll={() => router.push('/fate-pulse/cards')} />
        <MoverSection title="Biggest Card Fallers" icon="trending-down" accent={FateDropColors.vanished} items={fallers} currencyCode={currencyCode} onSeeAll={() => router.push('/fate-pulse/cards')} />

        <View style={styles.sectionCard}>
          <SectionHeader title="Sets Heating Up" icon="flame-outline" accent={FateDropColors.goldBright} onPress={() => router.push('/fate-pulse/sets')} />
          {heatingSets.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.setRail}>
              {heatingSets.map((item) => <SetMoverCard key={item.key} item={item} />)}
            </ScrollView>
          ) : <EmptyState text={is90 ? '90D set rankings are still building.' : 'No qualifying set risers yet.'} />}
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/fate-pulse/my-pulse')} style={({ pressed }) => [styles.myPulseCard, pressed && styles.pressed]}>
          <View style={styles.myPulseIcon}><Ionicons name="star-outline" size={20} color={FateDropColors.goldBright} /></View>
          <View style={styles.flex}>
            <Text style={styles.myPulseKicker}>MY PULSE</Text>
            <Text style={styles.myPulseTitle}>Track the cards and sets you care about.</Text>
            <Text style={styles.myPulseCopy}>Your personal market watchlist, separate from retail Wishlist and stock alerts.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright} />
        </Pressable>

        <Text style={styles.truthText}>Only verified market movement is shown. Missing prices or unsupported history stay unavailable rather than being estimated.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoverSection({ title, icon, accent, items, currencyCode, onSeeAll }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  items: FatePulseRankedCard[];
  currencyCode: string | undefined;
  onSeeAll: () => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <SectionHeader title={title} icon={icon} accent={accent} onPress={onSeeAll} />
      {items.map((item) => <CardMoverRow key={`${item.cardIdentityId}:${item.sourceVariantKey}`} item={item} currencyCode={currencyCode} accent={accent} />)}
      {items.length === 0 ? <EmptyState text="No qualifying card movement yet." /> : null}
    </View>
  );
}

function SectionHeader({ title, icon, accent, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; accent: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={18} color={accent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
        <Text style={styles.seeAllText}>See all</Text>
        <Ionicons name="chevron-forward" size={13} color={FateDropColors.secondary} />
      </Pressable>
    </View>
  );
}

function CardMoverRow({ item, currencyCode, accent }: { item: FatePulseRankedCard; currencyCode: string | undefined; accent: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.cardIdentityId } })} style={({ pressed }) => [styles.moverRow, pressed && styles.pressed]}>
      <CanonicalThumbnail kind="card" setId={item.setCode} collectorNumber={item.collectorNumber} width={36} height={50} />
      <View style={styles.moverCopy}>
        <Text numberOfLines={1} style={styles.moverName}>{item.name || 'Verified card'}</Text>
        <Text numberOfLines={1} style={styles.moverMeta}>{item.setName || item.setCode || 'Tracked set'}{item.collectorNumber ? ` · #${item.collectorNumber}` : ''}</Text>
      </View>
      <View style={styles.moverNumbers}>
        <Text style={styles.moverPrice}>{formatMoney(item.currentPrice, currencyCode)}</Text>
        <Text style={[styles.moverMovement, { color: accent }]}>{movement(item.movementPercent)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={FateDropColors.muted} />
    </Pressable>
  );
}

function SetMoverCard({ item }: { item: FatePulseRankedSet }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/fate-pulse/sets')} style={({ pressed }) => [styles.setCard, pressed && styles.pressed]}>
      <CanonicalThumbnail kind="set" setId={item.setCode} width={44} height={44} />
      <Text numberOfLines={2} style={styles.setName}>{item.setName || item.setCode || 'Tracked set'}</Text>
      <Text style={styles.setMovement}>{movement(item.movementPercent)}</Text>
      <Text style={styles.setMeta}>{item.pricedCardCount} priced cards</Text>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 126, gap: 13 },
  flex: { flex: 1 },
  pressed: { opacity: .72 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerCopy: { flex: 1 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,12,20,.88)' },
  brand: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 30, lineHeight: 34 },
  kicker: { color: FateDropColors.secondary, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.75, marginTop: 1 },
  searchBar: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,13,23,.92)', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  searchText: { flex: 1, color: FateDropColors.secondary, fontSize: 12 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: FateDropColors.borderSoft },
  tab: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { color: FateDropColors.muted, fontSize: 10.5, fontWeight: '800' },
  tabTextActive: { color: FateDropColors.goldBright },
  tabUnderline: { position: 'absolute', left: 10, right: 10, bottom: -1, height: 2, borderRadius: 1, backgroundColor: FateDropColors.goldBright },
  periodRail: { flexDirection: 'row', gap: 8 },
  periodButton: { flex: 1, minHeight: 37, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,13,23,.78)' },
  periodButtonActive: { borderColor: `${FateDropColors.goldBright}88`, backgroundColor: 'rgba(226,197,141,.11)' },
  periodText: { color: FateDropColors.muted, fontSize: 9.5, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.goldBright },
  loadingCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,13,23,.86)' },
  loadingText: { color: FateDropColors.secondary, fontSize: 9.5 },
  errorCard: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.vanished}55`, backgroundColor: 'rgba(28,10,18,.72)', paddingHorizontal: 12 },
  errorText: { color: FateDropColors.secondary, fontSize: 9.5 },
  marketSummary: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(4,8,21,.84)', padding: 15 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryEyebrow: { color: FateDropColors.secondary, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.35 },
  summaryValueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 5 },
  summaryValue: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 39 },
  summaryCondition: { fontFamily: Fonts.serif, fontSize: 16, marginLeft: 5 },
  directionBadge: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,10,18,.72)' },
  summaryCopy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 7 },
  sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(4,8,21,.84)', overflow: 'hidden' },
  sectionHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FateDropColors.borderSoft },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  sectionTitle: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 17 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8 },
  seeAllText: { color: FateDropColors.secondary, fontSize: 8.5, fontWeight: '800' },
  moverRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: FateDropColors.borderSoft },
  cardThumb: { width: 39, height: 50, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,20,33,.96)' },
  moverCopy: { flex: 1, minWidth: 0 },
  moverName: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 11.5 },
  moverMeta: { color: FateDropColors.muted, fontSize: 7.8, marginTop: 3 },
  moverNumbers: { alignItems: 'flex-end', minWidth: 68 },
  moverPrice: { color: FateDropColors.text, fontSize: 10, fontWeight: '800' },
  moverMovement: { fontSize: 10.5, fontWeight: '900', marginTop: 3 },
  setRail: { gap: 9, padding: 11 },
  setCard: { width: 132, minHeight: 122, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(4,9,17,.68)', padding: 11 },
  setIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,197,141,.3)', backgroundColor: 'rgba(226,197,141,.07)' },
  setName: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 11, lineHeight: 14, marginTop: 8 },
  setMovement: { color: FateDropColors.manifested, fontSize: 12, fontWeight: '900', marginTop: 6 },
  setMeta: { color: FateDropColors.muted, fontSize: 7, marginTop: 3 },
  myPulseCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(16,15,25,.92)', padding: 13 },
  myPulseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(226,197,141,.08)' },
  myPulseKicker: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  myPulseTitle: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 13.5, marginTop: 3 },
  myPulseCopy: { color: FateDropColors.secondary, fontSize: 8.3, lineHeight: 12, marginTop: 3 },
  emptyText: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, paddingHorizontal: 13, paddingVertical: 18 },
  truthText: { color: FateDropColors.muted, fontSize: 7.5, lineHeight: 12, textAlign: 'center', paddingHorizontal: 16, marginTop: 1 },
});
