import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { FateCollectionsArt } from '@/components/fate-collections-art';
import { CollectionsScreen } from '@/components/fate-collections-ui';
import { useCollectionsResource } from '@/hooks/use-collections-resource';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchFateCollectorCollection, fetchFateCollectorDashboard, type FateCollectorItem } from '@/services/fate-collector';

type ArtFields = { imageUrl?: string | null; thumbnailUrl?: string | null };

type SortKey = 'grader' | 'grade' | 'name';

function money(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; }
}

const readGraded = async () => {
  const [collection, dashboard] = await Promise.all([fetchFateCollectorCollection(), fetchFateCollectorDashboard({ force: true })]);
  return { collection, dashboard };
};

export default function FateGradedCollectionScreen() {
  const { data, loading, error, load } = useCollectionsResource(readGraded);
  const slabs = useMemo(() => data?.collection.items.filter((item) => item.copyState === 'graded') || [], [data]);
  const valuation = data?.dashboard.summary.gradedCollection;
  const [sort, setSort] = useState<SortKey>('grader');


  const graders = useMemo(() => new Set(slabs.map((item) => item.grading?.gradingCompany).filter(Boolean)).size, [slabs]);
  const knownValue = valuation && valuation.pricedUnits > 0 ? money(valuation.knownValue, valuation.currencyCode) : '—';
  const visibleSlabs = useMemo(() => [...slabs].sort((a, b) => {
    if (sort === 'grade') return Number(b.grading?.gradeValue || 0) - Number(a.grading?.gradeValue || 0) || String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
    if (sort === 'name') return String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
    return String(a.grading?.gradingCompany || '').localeCompare(String(b.grading?.gradingCompany || '')) || Number(b.grading?.gradeValue || 0) - Number(a.grading?.gradeValue || 0);
  }), [slabs, sort]);

  return (
    <CollectionsScreen>

      <FlatList data={visibleSlabs} keyExtractor={(item) => item.id} initialNumToRender={10} windowSize={5}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}
        ListHeaderComponent={<>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/collections')} style={styles.back}><Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · GRADED</Text>
            <Text style={styles.title}>A higher standard of glory.</Text>
            <Text style={styles.copy}>Your proudest graded cards, each with its own recorded grader and grade. A cabinet for the cards that mean the most.</Text>
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
          <Metric icon="id-card-outline" value={data ? String(slabs.length) : '—'} label="TOTAL SLABS" />
          <View style={styles.metricDivider} />
          <Metric icon="shield-checkmark-outline" value={data ? String(graders) : '—'} label="GRADERS REPRESENTED" />
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={FateDropColors.goldBright} />
          <Text style={styles.noticeText}>Raw-card FatePrice is never reused for slabs. Each graded card requires exact card + grader + grade evidence for value verification.</Text>
        </View>

        <View style={styles.performanceRow}>
          <PerformanceCard positive label="BEST PERFORMERS" />
          <PerformanceCard label="BIGGEST DROPS" />
        </View>

        <View style={styles.listHeader}>
          <View><Text style={styles.listTitle}>Your Slabs</Text><Text style={styles.listCopy}>Your graded cards, kept together and valued separately.</Text></View>
          <Pressable accessibilityRole="button" onPress={() => setSort((value) => value === 'grader' ? 'grade' : value === 'grade' ? 'name' : 'grader')} style={styles.sortPill}>
            <Text style={styles.sortText}>{slabs.length} slabs · {sort === 'grader' ? 'Grader' : sort === 'grade' ? 'Grade' : 'Name'}</Text>
            <Ionicons name="chevron-down" size={13} color={FateDropColors.secondary} />
          </Pressable>
        </View>

        {loading && !slabs.length ? <StateLine loading text="Opening the graded cabinet…" /> : null}
        {error ? <StateLine danger text={error} /> : null}
        {!loading && !error && !slabs.length ? <StateLine text="No graded cards yet. Import your graded cards from Personal Collection with their grader and grade to see them here." /> : null}

        </>}
        renderItem={({ item }) => <SlabCard item={item} />}
        ListFooterComponent={<>

        <View style={styles.truth}>
          <Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>Graded value contributes to your overall collection value. Slabs never fill binder slots or increase an ungraded set’s value.</Text>
        </View>
        </>}
      />
    </CollectionsScreen>
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
      <Text style={styles.performanceCopy}>Your top 3 appear when the exact card, grader and grade have trustworthy historical evidence.</Text>
    </View>
  );
}

function SlabCard({ item }: { item: FateCollectorItem }) {
  const card = item.card as (NonNullable<FateCollectorItem['card']> & ArtFields) | null | undefined;
  const art = card?.thumbnailUrl || card?.imageUrl || null;
  return (
    <View style={styles.slab}>
      <View style={styles.slabArtFrame}>
        {art ? <Image source={{ uri: art }} style={styles.slabArt} contentFit="contain" cachePolicy="memory-disk" /> : <View style={styles.slabArtPlaceholder}><Ionicons name="diamond-outline" size={22} color={FateDropColors.echo} /></View>}
      </View>
      <View style={styles.slabText}>
        <View style={styles.gradeRow}>
          <View style={styles.graderBadge}><Text style={styles.graderText}>{item.grading?.gradingCompany || 'GRADER'}</Text></View>
          <View style={styles.gradeBadge}><Text style={styles.gradeText}>{item.grading?.gradeLabel || '—'}</Text></View>
          <Text style={styles.cert} numberOfLines={1}>{item.grading?.certificationNumber ? `#${item.grading.certificationNumber}` : 'CERT NOT SUPPLIED'}</Text>
        </View>
        <Text style={styles.cardName} numberOfLines={1}>{card?.name || 'Verified card'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{card?.setName || 'Verified set'} · #{card?.collectorNumber || '—'}</Text>
        <Text style={styles.slabValue}>Graded price unavailable</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ungraded reference for ${card?.name || 'card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, setId: card?.setId || undefined, setName: card?.setName || undefined, collectorNumber: card?.collectorNumber || undefined, tcg: card?.tcgCode || undefined } })} style={styles.referenceLink}><Text style={styles.referenceText}>View ungraded reference</Text><Ionicons name="arrow-forward" size={14} color={FateDropColors.goldBright} /></Pressable>
      </View>
    </View>
  );
}

function StateLine({ danger = false, loading = false, text }: { danger?: boolean; loading?: boolean; text: string }) {
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : 'ribbon-outline'} size={20} color={danger ? FateDropColors.vanished : FateDropColors.muted} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  referenceLink: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  referenceText: { fontSize: 11, color: FateDropColors.goldBright },
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.60)' },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 8 },
  back: { width: 44, height: 44, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  valuePanel: { minHeight: 160, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.66)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.74)' },
  valueOrbit: { position: 'absolute', width: 300, height: 130, borderRadius: 150, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)' },
  valueLabel: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 41, lineHeight: 47, marginTop: 4 },
  valueCopy: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  metricsRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 45, backgroundColor: 'rgba(226,197,141,.25)' },
  metricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, marginTop: 3 },
  metricLabel: { color: FateDropColors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: .75, marginTop: 2 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 13, backgroundColor: 'rgba(4,8,21,.64)' },
  noticeText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  performanceRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  performanceCard: { flex: 1, minHeight: 220, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.72)' },
  performanceHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  performanceLabel: { fontSize: 11, fontWeight: '900', letterSpacing: .9 },
  performanceSlab: { height: 92, alignItems: 'center', justifyContent: 'center', marginTop: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)', borderRadius: 9, backgroundColor: 'rgba(124,110,255,.07)' },
  performanceTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13.5, marginTop: 8 },
  performanceCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  listHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 19, marginBottom: 10 },
  listTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24 },
  listCopy: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
  sortPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 17 },
  sortText: { color: FateDropColors.secondary, fontSize: 11 },
  gallery: { gap: 8 },
  slab: { marginBottom: 10, minHeight: 105, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.74)' },
  slabArtFrame: { width: 62, height: 89, padding: 4, borderWidth: 1, borderColor: 'rgba(226,197,141,.45)', borderRadius: 7, backgroundColor: 'rgba(205,220,245,.07)' },
  slabArt: { flex: 1, borderRadius: 4, backgroundColor: 'rgba(124,110,255,.08)' },
  slabArtPlaceholder: { flex: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)', backgroundColor: 'rgba(124,110,255,.08)' },
  slabText: { flex: 1, minWidth: 0 },
  gradeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  graderBadge: { paddingHorizontal: 6, height: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)', borderRadius: 5 },
  graderText: { color: FateDropColors.echo, fontSize: 11, fontWeight: '900' },
  gradeBadge: { paddingHorizontal: 6, height: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.62)', borderRadius: 5 },
  gradeText: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 11 },
  cert: { flex: 1, color: FateDropColors.secondary, fontSize: 11, textAlign: 'right' },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14, marginTop: 7 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  slabValue: { color: FateDropColors.secondary, fontSize: 11, marginTop: 7, fontWeight: '800' },
  stateLine: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  truth: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 15, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: .72 },
});
