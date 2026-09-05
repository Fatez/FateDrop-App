import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateCollectionsArt } from '@/components/fate-collections-art';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchFateCollectorDashboard, type FateCollectorSetBinder, type FateCollectorsDashboardSnapshot } from '@/services/fate-collector';

type BinderFilter = 'all' | 'progress' | 'complete';

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function money(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; }
}

export default function FateBindersScreen() {
  const [data, setData] = useState<FateCollectorsDashboardSnapshot | null>(null);
  const [filter, setFilter] = useState<BinderFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await fetchFateCollectorDashboard({ force: true })); }
    catch { setError('Your binders could not be read safely right now.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const allBinders = useMemo(() => (data?.summary.sets || [])
    .filter((set) => set.status === 'available' && Number(set.ownedCount) > 0)
    .sort((a, b) => Number(b.completionPercent || 0) - Number(a.completionPercent || 0) || String(a.setName || '').localeCompare(String(b.setName || ''))), [data?.summary.sets]);
  const completed = allBinders.filter((set) => set.missingCount === 0);
  const inProgress = allBinders.filter((set) => Number(set.missingCount) > 0);
  const visible = filter === 'complete' ? completed : filter === 'progress' ? inProgress : allBinders;
  const closest = data?.summary.closestSet ? allBinders.find((set) => set.setId === data.summary.closestSet?.setId) || null : null;
  const currency = closest?.value?.currencyCode || data?.summary.currencyCode || 'GBP';
  const topNeeded = closest?.missingCards?.slice(0, 3) || [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
        <View style={styles.veil} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · BINDERS</Text>
            <Text style={styles.title}>Track the sets you are building.</Text>
            <Text style={styles.copy}>See your progress, find what’s missing, and get closer to completion — one verified raw card at a time.</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryMetric icon="checkmark-done-outline" value={String(completed.length)} label="SETS COMPLETED" />
          <View style={styles.summaryDivider} />
          <SummaryMetric icon="ellipse-outline" value={String(inProgress.length)} label="IN PROGRESS" />
          <View style={styles.summaryDivider} />
          <View style={styles.closestSummary}><Ionicons name="locate-outline" size={18} color={FateDropColors.goldBright} /><Text style={styles.closestSummaryName} numberOfLines={2}>{closest?.setName || '—'}</Text><Text style={styles.summaryLabel}>CLOSEST SET</Text></View>
        </View>

        {loading && !data ? <StateLine icon="time-outline" text="Opening your binders…" loading /> : null}
        {error ? <StateLine icon="alert-circle-outline" text={error} danger /> : null}

        {closest ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${closest.setName || 'closest set'} binder`}
            onPress={() => router.push({ pathname: '/binder/[setId]', params: { setId: closest.setId, setName: closest.setName || undefined } })}
            style={({ pressed }) => [styles.closestCard, pressed && styles.pressed]}
          >
            <View style={styles.closestTop}>
              <FateCollectionsArt kind="binders" size={104} />
              <View style={styles.closestMain}>
                <Text style={styles.closestEyebrow}>CLOSEST TO COMPLETION</Text>
                <Text style={styles.closestName}>{closest.setName || 'Verified set'}</Text>
                <Text style={styles.closestPercent}>{pct(closest.completionPercent)}</Text>
                <Text style={styles.closestOwned}>{closest.ownedCount ?? '—'} / {closest.totalCount ?? '—'} cards owned</Text>
              </View>
              <View style={styles.closestSide}>
                <Text style={styles.missingBig}>{closest.missingCount ?? '—'}</Text>
                <Text style={styles.missingLabel}>cards missing</Text>
                <Text style={styles.missingValue}>{money(closest.value?.missingValue, currency)}</Text>
                <Text style={styles.missingValueLabel}>verified missing value</Text>
              </View>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, closest.completionPercent || 0))}%` }]} /></View>
            <View style={styles.topNeeded}>
              <View style={styles.topNeededHead}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.topNeededTitle}>Top 3 still needed</Text></View>
              <View style={styles.topNeededRow}>
                {topNeeded.length ? topNeeded.map((card) => (
                  <View key={card.fateCardId} style={styles.neededMini}>
                    <View style={styles.neededMiniArt}><Ionicons name="sparkles-outline" size={14} color={FateDropColors.echo} /></View>
                    <View style={styles.flex}><Text style={styles.neededMiniName} numberOfLines={1}>{card.name || 'Verified card'}</Text><Text style={styles.neededMiniMeta}>#{card.collectorNumber || '—'}</Text></View>
                  </View>
                )) : <Text style={styles.noNeeded}>No verified missing-card detail yet.</Text>}
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.filterRail}>
          <FilterButton label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterButton label="In progress" selected={filter === 'progress'} onPress={() => setFilter('progress')} />
          <FilterButton label="Completed" selected={filter === 'complete'} onPress={() => setFilter('complete')} />
        </View>

        <View style={styles.listHeader}><View><Text style={styles.listTitle}>Your Set Binders</Text><Text style={styles.listCopy}>Tap a binder to view your needed and owned cards.</Text></View><View style={styles.sortPill}><Text style={styles.sortText}>Sort: Progress</Text><Ionicons name="chevron-down" size={13} color={FateDropColors.secondary} /></View></View>

        <View style={styles.list}>
          {visible.map((binder) => <BinderRow key={binder.setId} binder={binder} />)}
          {!loading && !error && !visible.length ? <StateLine icon="albums-outline" text={filter === 'complete' ? 'No completed binders yet.' : filter === 'progress' ? 'No binders are currently in progress.' : 'Add a raw exact card from FatePrice to begin a binder.'} /> : null}
        </View>

        <View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Completion uses verified raw printings only. Graded slabs never fill binder slots, as they are tracked separately.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.summaryMetric}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function FilterButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterButton, selected && styles.filterButtonActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable>;
}

function BinderRow({ binder }: { binder: FateCollectorSetBinder }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${binder.setName || 'set'} binder`} onPress={() => router.push({ pathname: '/binder/[setId]', params: { setId: binder.setId, setName: binder.setName || undefined } })} style={({ pressed }) => [styles.binderRow, pressed && styles.pressed]}>
      <View style={styles.binderThumb}><FateCollectionsArt kind="binders" size={58} /></View>
      <View style={styles.binderText}><Text style={styles.binderName} numberOfLines={1}>{binder.setName || 'Verified set'}</Text><Text style={styles.binderMeta}>{binder.ownedCount ?? '—'} / {binder.totalCount ?? '—'} cards</Text><View style={styles.rowTrack}><View style={[styles.rowFill, { width: `${Math.min(100, Math.max(0, binder.completionPercent || 0))}%` }]} /></View></View>
      <Text style={styles.binderPct}>{pct(binder.completionPercent)}</Text>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function StateLine({ danger = false, icon, loading = false, text }: { danger?: boolean; icon: keyof typeof Ionicons.glyphMap; loading?: boolean; text: string }) {
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name={icon} size={18} color={danger ? FateDropColors.vanished : FateDropColors.muted} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.58)' },
  content: { paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 32, lineHeight: 37, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 6 },
  summaryRow: { minHeight: 92, marginTop: 18, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', backgroundColor: 'rgba(4,8,21,.62)' },
  summaryMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 56, backgroundColor: 'rgba(226,197,141,.24)' },
  summaryValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, marginTop: 3 },
  summaryLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .75, marginTop: 2, textAlign: 'center' },
  closestSummary: { flex: 1.25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  closestSummaryName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13, lineHeight: 15, textAlign: 'center', marginTop: 3 },
  closestCard: { marginTop: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.68)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.78)', overflow: 'hidden' },
  closestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closestMain: { flex: 1 },
  closestEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 },
  closestName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19, marginTop: 4 },
  closestPercent: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 40, lineHeight: 44, marginTop: 2 },
  closestOwned: { color: FateDropColors.secondary, fontSize: 9.5 },
  closestSide: { width: 98, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  missingBig: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 25 },
  missingLabel: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 1 },
  missingValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 11 },
  missingValueLabel: { color: FateDropColors.muted, fontSize: 6.8, lineHeight: 10, marginTop: 2 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.10)', marginTop: 13, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  topNeeded: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)', marginTop: 14, paddingTop: 11 },
  topNeededHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topNeededTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15 },
  topNeededRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  neededMini: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  neededMiniArt: { width: 30, height: 42, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  neededMiniName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 9.5 },
  neededMiniMeta: { color: FateDropColors.muted, fontSize: 7, marginTop: 2 },
  noNeeded: { color: FateDropColors.muted, fontSize: 8.5 },
  filterRail: { flexDirection: 'row', marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 20, overflow: 'hidden' },
  filterButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: 'rgba(226,197,141,.11)', borderWidth: 1, borderColor: 'rgba(226,197,141,.62)', borderRadius: 20 },
  filterText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 12 },
  filterTextActive: { color: FateDropColors.ivory },
  listHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 21, marginBottom: 11 },
  listTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24 },
  listCopy: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 3 },
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 10 },
  list: { gap: 9 },
  binderRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.68)' },
  binderThumb: { width: 64, alignItems: 'center', justifyContent: 'center' },
  binderText: { flex: 1 },
  binderName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16 },
  binderMeta: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 2 },
  rowTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.10)', marginTop: 7 },
  rowFill: { height: 4, borderRadius: 2, backgroundColor: FateDropColors.goldBright },
  binderPct: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 16 },
  stateLine: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  stateText: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  truth: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 15, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .72 },
});
