import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateCollectionsArt, type CollectionArtKind } from '@/components/fate-collections-art';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  fetchFateCollectorDashboard,
  type FateCollectorPersonalMover,
  type FateCollectorsDashboardSnapshot,
} from '@/services/fate-collector';

type PersonalPeriod = 'd7' | 'd30';

function money(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode || 'GBP', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode || 'GBP'}`;
  }
}

function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function FateCollectionsDashboardScreen() {
  const [data, setData] = useState<FateCollectorsDashboardSnapshot | null>(null);
  const [period, setPeriod] = useState<PersonalPeriod>('d30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchFateCollectorDashboard({ force: true }));
    } catch {
      setError('Your collection could not be read safely right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const summary = data?.summary;
  const collection = summary?.collection;
  const graded = summary?.gradedCollection;
  const completedSets = useMemo(() => (summary?.sets || []).filter((set) => set.status === 'available' && set.missingCount === 0 && Number(set.totalCount) > 0).length, [summary?.sets]);
  const gradedCount = summary?.gradedCardUnits ?? 0;
  const totalCards = summary?.cardUnits ?? 0;
  const bindersTracked = (summary?.sets || []).filter((set) => set.status === 'available' && Number(set.ownedCount) > 0).length;
  const pulse = data?.personalPulse?.periods[period];
  const completeValue = Boolean(collection && collection.totalUnits > 0 && collection.unpricedUnits === 0 && collection.totalValue != null);
  const headlineValue = completeValue ? collection?.totalValue : collection?.knownValue;
  const currency = collection?.currencyCode || summary?.currencyCode || 'GBP';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
        <View style={styles.veil} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>FATE MARKET</Text>
          <Text style={styles.heroTitle}>Your collection. A clearer picture.</Text>
          <Text style={styles.heroCopy}>Your cards. Your sets. Your story. Turn ownership into insight, and see what your collection is really worth.</Text>
        </View>

        <View style={styles.marketTabs}>
          <MarketTab label="FatePulse" icon="pulse-outline" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} />
          <MarketTab label="FatePrice" icon="pricetag-outline" onPress={() => router.push('/fate-price')} />
          <MarketTab label="Fate Collections" icon="albums-outline" active onPress={() => undefined} />
        </View>

        {loading && !data ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Opening your private collection…</Text></View> : null}
        {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={FateDropColors.vanished} /><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.valuePanel}>
          <View style={styles.valueOrbitA} />
          <View style={styles.valueOrbitB} />
          <Text style={styles.valueEyebrow}>{completeValue ? 'COLLECTION VALUE' : 'KNOWN COLLECTION VALUE'}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.valueMain}>{collection && collection.pricedUnits > 0 ? money(headlineValue, currency) : '—'}</Text>
          <Text style={styles.valueSub}>{collection ? `Price coverage ${collection.priceCoveragePercent.toFixed(1)}% · verified evidence only` : 'Verified evidence only'}</Text>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon="layers-outline" value={String(totalCards)} label="TOTAL CARDS HELD" />
          <View style={styles.metricDivider} />
          <Metric icon="checkmark-done-outline" value={String(completedSets)} label="SETS COMPLETED" />
          <View style={styles.metricDivider} />
          <Metric icon="ribbon-outline" value={String(gradedCount)} label="GRADED CARDS" />
        </View>

        <View style={styles.destinationRow}>
          <DestinationCard
            art="collection"
            title="Personal Collection"
            copy="Your raw cards and exact owned copies."
            value={String(Math.max(0, totalCards - gradedCount))}
            valueLabel="cards held"
            onPress={() => router.push('/collection')}
          />
          <DestinationCard
            art="binders"
            title="Binders"
            copy="Track set completion and missing cards."
            value={String(bindersTracked)}
            valueLabel="sets tracked"
            onPress={() => router.push('/binders')}
          />
          <DestinationCard
            art="graded"
            title="Graded"
            copy="Your slabs, grades and cert-tracked items."
            value={String(gradedCount)}
            valueLabel="graded cards"
            onPress={() => router.push('/graded-collection')}
          />
        </View>

        <View style={styles.sectionHead}>
          <View style={styles.flex}>
            <Text style={styles.sectionEyebrow}>YOUR COLLECTION PULSE</Text>
            <Text style={styles.sectionTitle}>Your biggest risers and fallers</Text>
            <Text style={styles.sectionCopy}>Top 3 owned exact cards by verified value movement.</Text>
          </View>
          <View style={styles.periodRail}>
            <PeriodButton label="7D" selected={period === 'd7'} onPress={() => setPeriod('d7')} />
            <PeriodButton label="30D" selected={period === 'd30'} onPress={() => setPeriod('d30')} />
          </View>
        </View>

        <View style={styles.moverColumns}>
          <MoverColumn label="BIGGEST WINS" accent={FateDropColors.manifested} items={pulse?.risers || []} positive />
          <MoverColumn label="BIGGEST LOSSES" accent={FateDropColors.vanished} items={pulse?.decliners || []} />
        </View>

        {!pulse || pulse.status === 'building' ? (
          <View style={styles.buildingLine}>
            <Ionicons name="time-outline" size={15} color={FateDropColors.muted} />
            <Text style={styles.buildingText}>Personal movement appears only when an owned exact identity has trustworthy FatePrice history. Missing history is never treated as 0%.</Text>
          </View>
        ) : null}

        <View style={styles.truth}>
          <Ionicons name="shield-checkmark-outline" size={17} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>Cloud owns identity, history and calculations. Missing evidence stays unknown; the App never fills gaps with synthetic scores or values.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketTab({ active = false, icon, label, onPress }: { active?: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.marketTab, active && styles.marketTabActive]}>
      <Ionicons name={icon} size={16} color={active ? FateDropColors.echo : FateDropColors.muted} />
      <Text style={[styles.marketTabText, active && styles.marketTabTextActive]}>{label}</Text>
      {active ? <View style={styles.activeGem} /> : null}
    </Pressable>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.metric}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function DestinationCard({ art, copy, onPress, title, value, valueLabel }: { art: CollectionArtKind; copy: string; onPress: () => void; title: string; value: string; valueLabel: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.destination, pressed && styles.pressed]}>
      <FateCollectionsArt kind={art} size={72} />
      <View style={styles.destinationTitleRow}><Text style={styles.destinationTitle}>{title}</Text><Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} /></View>
      <Text style={styles.destinationCopy}>{copy}</Text>
      <View style={styles.destinationDivider} />
      <Text style={styles.destinationValue}>{value}</Text>
      <Text style={styles.destinationLabel}>{valueLabel}</Text>
    </Pressable>
  );
}

function PeriodButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.periodButton, selected && styles.periodButtonActive]}><Text style={[styles.periodText, selected && styles.periodTextActive]}>{label}</Text></Pressable>;
}

function MoverColumn({ accent, items, label, positive = false }: { accent: string; items: FateCollectorPersonalMover[]; label: string; positive?: boolean }) {
  return (
    <View style={styles.moverColumn}>
      <View style={styles.moverHead}><Ionicons name={positive ? 'trending-up-outline' : 'trending-down-outline'} size={17} color={accent} /><Text style={[styles.moverLabel, { color: accent }]}>{label}</Text></View>
      {items.length ? items.slice(0, 3).map((item, index) => (
        <Pressable
          key={`${item.cardIdentityId}:${index}`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.cardIdentityId, name: item.name || undefined, collectorNumber: item.collectorNumber || undefined, setId: item.setId || undefined, setName: item.setName || undefined, tcg: item.tcgCode || undefined } })}
          style={({ pressed }) => [styles.moverRow, pressed && styles.pressed]}
        >
          <View style={[styles.moverThumb, { borderColor: `${accent}66` }]}><Text style={[styles.rank, { color: accent }]}>{index + 1}</Text></View>
          <View style={styles.flex}><Text style={styles.moverName} numberOfLines={1}>{item.name || 'Owned card'}</Text><Text style={styles.moverMeta} numberOfLines={1}>#{item.collectorNumber || '—'} · {item.setName || 'Verified set'}</Text></View>
          <View style={styles.moverValue}><Text style={[styles.movement, { color: accent }]}>{percent(item.movementPercent)}</Text><Text style={styles.moverPrice}>{money(item.currentPrice, item.currencyCode)}</Text></View>
        </Pressable>
      )) : <Text style={styles.emptyMover}>No qualifying owned movement yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.56)' },
  content: { paddingHorizontal: 18, paddingBottom: 140 },
  hero: { paddingTop: 10, paddingBottom: 12 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.65 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 34, lineHeight: 38, marginTop: 7, maxWidth: 330 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 8, maxWidth: 345 },
  marketTabs: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.26)', backgroundColor: 'rgba(3,7,18,.52)' },
  marketTab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, position: 'relative' },
  marketTabActive: { backgroundColor: 'rgba(124,110,255,.09)' },
  marketTabText: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 13 },
  marketTabTextActive: { color: FateDropColors.ivory },
  activeGem: { position: 'absolute', bottom: -4, width: 8, height: 8, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  loading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 7 },
  loadingText: { color: FateDropColors.secondary, fontSize: 9 },
  error: { marginTop: 16, flexDirection: 'row', gap: 8, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.vanished}55`, borderRadius: 14 },
  errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14 },
  valuePanel: { minHeight: 175, marginTop: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,197,141,.58)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.62)' },
  valueOrbitA: { position: 'absolute', width: 310, height: 130, borderRadius: 155, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.30)' },
  valueOrbitB: { position: 'absolute', width: 225, height: 104, borderRadius: 112, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.35)' },
  valueEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.55 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 43, lineHeight: 50, marginTop: 5, maxWidth: '90%' },
  valueSub: { color: FateDropColors.secondary, fontSize: 9.5, marginTop: 2 },
  metricsRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.22)' },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 48, backgroundColor: 'rgba(226,197,141,.25)' },
  metricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, marginTop: 4 },
  metricLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .75, marginTop: 2, textAlign: 'center' },
  destinationRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  destination: { flex: 1, minHeight: 254, padding: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.40)', borderRadius: 16, backgroundColor: 'rgba(4,8,21,.74)' },
  destinationTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, marginTop: 3 },
  destinationTitle: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15, lineHeight: 17 },
  destinationCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 12, marginTop: 7, minHeight: 34 },
  destinationDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.24)', marginTop: 10, marginBottom: 9 },
  destinationValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20 },
  destinationLabel: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 22, marginBottom: 12 },
  flex: { flex: 1 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24, lineHeight: 29, marginTop: 4 },
  sectionCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 13, marginTop: 3 },
  periodRail: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 18, overflow: 'hidden' },
  periodButton: { minWidth: 42, height: 34, alignItems: 'center', justifyContent: 'center' },
  periodButtonActive: { backgroundColor: 'rgba(226,197,141,.12)' },
  periodText: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.ivory },
  moverColumns: { flexDirection: 'row', gap: 8 },
  moverColumn: { flex: 1, minHeight: 210, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.72)' },
  moverHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.18)' },
  moverLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: .8 },
  moverRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.06)' },
  moverThumb: { width: 27, height: 36, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(124,110,255,.08)' },
  rank: { fontFamily: Fonts.serif, fontSize: 13 },
  moverName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 10.5 },
  moverMeta: { color: FateDropColors.muted, fontSize: 6.7, marginTop: 2 },
  moverValue: { alignItems: 'flex-end' },
  movement: { fontSize: 10, fontWeight: '900' },
  moverPrice: { color: FateDropColors.secondary, fontSize: 7.3, marginTop: 2 },
  emptyMover: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 13, marginTop: 18 },
  buildingLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 13 },
  buildingText: { flex: 1, color: FateDropColors.muted, fontSize: 8, lineHeight: 12 },
  truth: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 14, paddingTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .72 },
});
