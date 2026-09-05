import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateCollectionsArt } from '@/components/fate-collections-art';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchFateCollectorCollection, fetchFateCollectorDashboard, type FateCollectorItem, type FateCollectorValueCoverage } from '@/services/fate-collector';

type ArtFields = { imageUrl?: string | null; thumbnailUrl?: string | null };

type SortKey = 'value' | 'grade' | 'name';

function money(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; }
}

export default function FateGradedCollectionScreen() {
  const [slabs, setSlabs] = useState<FateCollectorItem[]>([]);
  const [valuation, setValuation] = useState<FateCollectorValueCoverage | null>(null);
  const [sort, setSort] = useState<SortKey>('value');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [collection, dashboard] = await Promise.all([
        fetchFateCollectorCollection(),
        fetchFateCollectorDashboard({ force: true }),
      ]);
      setSlabs(collection.items.filter((item) => item.copyState === 'graded'));
      setValuation(dashboard.summary.gradedCollection || null);
    } catch {
      setError('Your graded collection could not be read safely right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const graders = useMemo(() => new Set(slabs.map((item) => item.grading?.gradingCompany).filter(Boolean)).size, [slabs]);
  const knownValue = valuation && valuation.pricedUnits > 0 ? money(valuation.knownValue, valuation.currencyCode) : '—';
  const visibleSlabs = useMemo(() => [...slabs].sort((a, b) => {
    if (sort === 'grade') return Number(b.grading?.gradeValue || 0) - Number(a.grading?.gradeValue || 0) || String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
    if (sort === 'name') return String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
    return String(a.grading?.gradingCompany || '').localeCompare(String(b.grading?.gradingCompany || '')) || Number(b.grading?.gradeValue || 0) - Number(a.grading?.gradeValue || 0);
  }), [slabs, sort]);

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
            <Text style={styles.eyebrow}>FATE COLLECTIONS · GRADED</Text>
            <Text style={styles.title}>A higher standard of glory.</Text>
            <Text style={styles.copy}>Authenticated. Graded. Eternal. Your slabbed cards live here, each one a verified piece of your story.</Text>
          </View>
          <FateCollectionsArt kind="graded" size={92} />
        </View>

        <View style={styles.valuePanel}>
          <View style={styles.valueOrbit} />
          <Text style={styles.valueLabel}>KNOWN GRADED VALUE</Text>
          <Text style={styles.valueMain}>{knownValue}</Text>
          <Text style={styles.valueCopy}>Verified slab value only · exact card + grader + grade evidence</Text>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon="id-card-outline" value={String(slabs.length)} label="TOTAL SLABS" />
          <View style={styles.metricDivider} />
          <Metric icon="shield-checkmark-outline" value={String(graders)} label="GRADERS REPRESENTED" />
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={FateDropColors.goldBright} />
          <Text style={styles.noticeText}>Raw-card FatePrice is never reused for slabs. Each graded card requires exact card + grader + grade evidence for value verification.</Text>
        </View>

        <View style={styles.performanceRow}>
          <PerformanceCard positive label="BEST PERFORMER" />
          <PerformanceCard label="BIGGEST DROP" />
        </View>

        <View style={styles.listHeader}>
          <View><Text style={styles.listTitle}>Your Slabs</Text><Text style={styles.listCopy}>Verified. Valued. A cabinet of distinction.</Text></View>
          <Pressable accessibilityRole="button" onPress={() => setSort((value) => value === 'value' ? 'grade' : value === 'grade' ? 'name' : 'value')} style={styles.sortPill}>
            <Text style={styles.sortText}>{slabs.length} slabs · {sort === 'value' ? 'Value' : sort === 'grade' ? 'Grade' : 'Name'}</Text>
            <Ionicons name="chevron-down" size={13} color={FateDropColors.secondary} />
          </Pressable>
        </View>

        {loading && !slabs.length ? <StateLine loading text="Opening the graded cabinet…" /> : null}
        {error ? <StateLine danger text={error} /> : null}
        {!loading && !error && !slabs.length ? <StateLine text="No graded cards yet. Add or import a slab with exact grading details and it will appear here." /> : null}

        <View style={styles.gallery}>
          {visibleSlabs.map((item) => <SlabCard key={item.id} item={item} />)}
        </View>

        <View style={styles.truth}>
          <Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>Graded cards live separately from raw binders and raw-card totals. They are valued independently and never fill binder completion slots.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.metric}><Ionicons name={icon} size={20} color={FateDropColors.goldBright} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function PerformanceCard({ label, positive = false }: { label: string; positive?: boolean }) {
  const accent = positive ? FateDropColors.manifested : FateDropColors.vanished;
  return (
    <View style={styles.performanceCard}>
      <View style={styles.performanceHead}><Ionicons name={positive ? 'trending-up-outline' : 'trending-down-outline'} size={22} color={accent} /><Text style={[styles.performanceLabel, { color: accent }]}>{label}</Text></View>
      <View style={styles.performanceSlab}><Ionicons name="diamond-outline" size={24} color={FateDropColors.echo} /></View>
      <Text style={styles.performanceTitle}>Building graded history</Text>
      <Text style={styles.performanceCopy}>Appears only when the exact card, grader and grade have trustworthy historical evidence.</Text>
    </View>
  );
}

function SlabCard({ item }: { item: FateCollectorItem }) {
  const card = item.card as (NonNullable<FateCollectorItem['card']> & ArtFields) | null | undefined;
  const art = card?.thumbnailUrl || card?.imageUrl || null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${card?.name || 'graded card'} identity`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, collectorNumber: card?.collectorNumber || undefined, setId: card?.setId || undefined, setName: card?.setName || undefined, tcg: card?.tcgCode || undefined } })} style={({ pressed }) => [styles.slab, pressed && styles.pressed]}>
      <View style={styles.slabArtFrame}>
        {art ? <Image source={{ uri: art }} style={styles.slabArt} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.slabArtPlaceholder}><Ionicons name="diamond-outline" size={22} color={FateDropColors.echo} /></View>}
      </View>
      <View style={styles.slabText}>
        <View style={styles.gradeRow}>
          <View style={styles.graderBadge}><Text style={styles.graderText}>{item.grading?.gradingCompany || 'GRADER'}</Text></View>
          <View style={styles.gradeBadge}><Text style={styles.gradeText}>{item.grading?.gradeLabel || '—'}</Text></View>
          <Text style={styles.cert} numberOfLines={1}>{item.grading?.certificationNumber ? `#${item.grading.certificationNumber}` : 'CERT NOT SUPPLIED'}</Text>
        </View>
        <Text style={styles.cardName} numberOfLines={1}>{card?.name || 'Verified card'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{card?.setName || 'Verified set'} · #{card?.collectorNumber || '—'}</Text>
        <Text style={styles.slabValue}>Exact graded value</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function StateLine({ danger = false, loading = false, text }: { danger?: boolean; loading?: boolean; text: string }) {
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : 'ribbon-outline'} size={20} color={danger ? FateDropColors.vanished : FateDropColors.muted} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.60)' },
  content: { paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 6 },
  valuePanel: { minHeight: 160, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.66)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.74)' },
  valueOrbit: { position: 'absolute', width: 300, height: 130, borderRadius: 150, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)' },
  valueLabel: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.4 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 41, lineHeight: 47, marginTop: 4 },
  valueCopy: { color: FateDropColors.secondary, fontSize: 8.7, marginTop: 2 },
  metricsRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 45, backgroundColor: 'rgba(226,197,141,.25)' },
  metricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, marginTop: 3 },
  metricLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .75, marginTop: 2 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 13, backgroundColor: 'rgba(4,8,21,.64)' },
  noticeText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.8, lineHeight: 13 },
  performanceRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  performanceCard: { flex: 1, minHeight: 220, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.72)' },
  performanceHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  performanceLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: .9 },
  performanceSlab: { height: 92, alignItems: 'center', justifyContent: 'center', marginTop: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)', borderRadius: 9, backgroundColor: 'rgba(124,110,255,.07)' },
  performanceTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13.5, marginTop: 8 },
  performanceCopy: { color: FateDropColors.muted, fontSize: 7.6, lineHeight: 11, marginTop: 4 },
  listHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 19, marginBottom: 10 },
  listTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24 },
  listCopy: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 3 },
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 34, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 17 },
  sortText: { color: FateDropColors.secondary, fontSize: 8.5 },
  gallery: { gap: 8 },
  slab: { minHeight: 105, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.74)' },
  slabArtFrame: { width: 62, height: 89, padding: 4, borderWidth: 1, borderColor: 'rgba(226,197,141,.45)', borderRadius: 7, backgroundColor: 'rgba(205,220,245,.07)' },
  slabArt: { flex: 1, borderRadius: 4, backgroundColor: 'rgba(124,110,255,.08)' },
  slabArtPlaceholder: { flex: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)', backgroundColor: 'rgba(124,110,255,.08)' },
  slabText: { flex: 1, minWidth: 0 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  graderBadge: { paddingHorizontal: 6, height: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)', borderRadius: 5 },
  graderText: { color: FateDropColors.echo, fontSize: 7.5, fontWeight: '900' },
  gradeBadge: { paddingHorizontal: 6, height: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.62)', borderRadius: 5 },
  gradeText: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 11 },
  cert: { flex: 1, color: FateDropColors.muted, fontSize: 6.7, textAlign: 'right' },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14, marginTop: 7 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 8, marginTop: 2 },
  slabValue: { color: FateDropColors.goldBright, fontSize: 8.5, marginTop: 7, fontWeight: '800' },
  stateLine: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  truth: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 15, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .72 },
});
