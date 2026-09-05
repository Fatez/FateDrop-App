import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchFateCollectorCollection, fetchFateCollectorDashboard, type FateCollectorItem, type FateCollectorValueCoverage } from '@/services/fate-collector';

function money(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; }
}

export default function FateGradedCollectionScreen() {
  const [slabs, setSlabs] = useState<FateCollectorItem[]>([]);
  const [valuation, setValuation] = useState<FateCollectorValueCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [collection, dashboard] = await Promise.all([fetchFateCollectorCollection(), fetchFateCollectorDashboard({ force: true })]);
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

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><FateDropBackground /><Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" /><View style={styles.veil} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={19} color={FateDropColors.ivory} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>FATE COLLECTIONS · GRADED</Text><Text style={styles.title}>Your cabinet of distinction.</Text><Text style={styles.copy}>Every slab is one individual asset with its own card, grader, grade and certification identity.</Text></View></View>

      <View style={styles.cabinet}>
        <View style={styles.orbit} />
        <Ionicons name="ribbon-outline" size={28} color={FateDropColors.goldBright} />
        <Text style={styles.cabinetLabel}>GRADED COLLECTION</Text>
        <Text style={styles.cabinetCount}>{slabs.length}</Text>
        <Text style={styles.cabinetSub}>{slabs.length === 1 ? 'individual slab' : 'individual slabs'} · {graders} {graders === 1 ? 'grader' : 'graders'}</Text>
      </View>

      <View style={styles.valueLine}><View><Text style={styles.valueLabel}>KNOWN GRADED VALUE</Text><Text style={styles.value}>{knownValue}</Text></View><View style={styles.valueCopy}><Text style={styles.valueNote}>{valuation?.pricedUnits || 0} of {valuation?.totalUnits ?? slabs.length} slabs valued</Text><Text style={styles.valueNote}>Exact grade evidence only</Text></View></View>
      {!valuation || valuation.status !== 'available' ? <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.noticeText}>Raw-card FatePrice is never reused for a slab. Graded value remains unavailable until evidence matches the exact card, grading company and grade.</Text></View> : null}

      {loading && !slabs.length ? <View style={styles.state}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.stateText}>Opening the graded cabinet…</Text></View> : null}
      {error ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={19} color={FateDropColors.vanished} /><Text style={styles.stateText}>{error}</Text></View> : null}
      {!loading && !error && !slabs.length ? <View style={styles.state}><Ionicons name="ribbon-outline" size={24} color={FateDropColors.muted} /><Text style={styles.stateTitle}>No graded cards yet</Text><Text style={styles.stateText}>Graded cards imported or added with exact grading details will appear here—never inside a set binder.</Text></View> : null}

      <View style={styles.gallery}>
        {slabs.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.card?.name || 'graded card'} identity`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: item.card?.name || undefined, collectorNumber: item.card?.collectorNumber || undefined, setId: item.card?.setId || undefined, setName: item.card?.setName || undefined, tcg: item.card?.tcgCode || undefined } })} style={({ pressed }) => [styles.slab, pressed && styles.pressed]}>
          <View style={styles.slabLabel}><Text style={styles.grader}>{item.grading?.gradingCompany || 'GRADER'}</Text><Text style={styles.grade}>{item.grading?.gradeLabel || '—'}</Text></View>
          <View style={styles.slabCard}><Ionicons name="diamond-outline" size={25} color={FateDropColors.echo} /><Text style={styles.cardName} numberOfLines={2}>{item.card?.name || 'Verified card'}</Text><Text style={styles.cardMeta}>{item.card?.setName || 'Verified set'} · #{item.card?.collectorNumber || '—'}</Text></View>
          <View style={styles.slabFooter}><Text style={styles.cert} numberOfLines={1}>{item.grading?.certificationNumber ? `CERT ${item.grading.certificationNumber}` : 'CERT NOT SUPPLIED'}</Text><Ionicons name="chevron-forward" size={13} color={FateDropColors.goldBright} /></View>
        </Pressable>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.64)' }, content: { paddingHorizontal: 18, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 }, back: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' }, flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.08 }, title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 29, lineHeight: 34, marginTop: 4 }, copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  cabinet: { minHeight: 235, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)' }, orbit: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.45)' }, cabinetLabel: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 10 }, cabinetCount: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 48, lineHeight: 56 }, cabinetSub: { color: FateDropColors.secondary, fontSize: 9.5 },
  valueLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.22)' }, valueLabel: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: .65 }, value: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23, marginTop: 3 }, valueCopy: { alignItems: 'flex-end' }, valueNote: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 14 }, noticeText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 }, state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28 }, stateTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18 }, stateText: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  gallery: { gap: 14, marginTop: 8 }, slab: { padding: 9, borderWidth: 1, borderColor: 'rgba(226,197,141,.42)', borderRadius: 14, backgroundColor: 'rgba(210,220,235,.08)' }, slabLabel: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 7, backgroundColor: 'rgba(226,197,141,.10)' }, grader: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, grade: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 22 }, slabCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', margin: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)', borderRadius: 9, backgroundColor: 'rgba(4,8,20,.72)' }, cardName: { maxWidth: 220, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, lineHeight: 24, textAlign: 'center', marginTop: 12 }, cardMeta: { color: FateDropColors.muted, fontSize: 8.5, marginTop: 6 }, slabFooter: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 }, cert: { flex: 1, color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: .45 }, pressed: { opacity: .72 },
});
