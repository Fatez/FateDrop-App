import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  addExactCardToCollector,
  fetchFateCollectorCollection,
  fetchFateCollectorDashboard,
  type FateCollectorItem,
  type FateCollectorMissingCard,
  type FateCollectorSetBinder,
} from '@/services/fate-collector';

type BinderView = 'needed' | 'owned';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function percent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function sortOwned(left: FateCollectorItem, right: FateCollectorItem) {
  return String(left.card?.collectorNumber || '').localeCompare(String(right.card?.collectorNumber || ''), undefined, { numeric: true })
    || String(left.card?.name || '').localeCompare(String(right.card?.name || ''));
}

function sortMissing(left: FateCollectorMissingCard, right: FateCollectorMissingCard) {
  return String(left.collectorNumber || '').localeCompare(String(right.collectorNumber || ''), undefined, { numeric: true })
    || String(left.name || '').localeCompare(String(right.name || ''));
}

export default function FateBinderScreen() {
  const params = useLocalSearchParams<{ setId?: string | string[]; setName?: string | string[] }>();
  const setId = first(params.setId)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const [binder, setBinder] = useState<FateCollectorSetBinder | null>(null);
  const [owned, setOwned] = useState<FateCollectorItem[]>([]);
  const [view, setView] = useState<BinderView>('needed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!setId) {
      setError('This binder does not have an exact set identity.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [dashboard, collection] = await Promise.all([
        fetchFateCollectorDashboard({ force: true }),
        fetchFateCollectorCollection(),
      ]);
      setBinder(dashboard.summary.sets?.find((item) => item.setId === setId) || null);
      setOwned(collection.items
        .filter((item) => item.copyState === 'raw' && item.card?.setId === setId)
        .sort(sortOwned));
    } catch {
      setError('This binder could not be read safely right now.');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const missing = useMemo(() => [...(binder?.missingCards || [])].sort(sortMissing), [binder?.missingCards]);
  const setName = binder?.setName || routeSetName || 'Set binder';

  const addMissing = async (card: FateCollectorMissingCard) => {
    if (addingId) return;
    setAddingId(card.fateCardId);
    setMessage('');
    try {
      await addExactCardToCollector(card.fateCardId);
      setMessage(`${card.name || 'Card'} added to your raw collection.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'That card could not be added safely.');
    } finally {
      setAddingId('');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
        <View style={styles.veil} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.echo} />}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={19} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.flex}><Text style={styles.eyebrow}>FATE COLLECTIONS · SET BINDER</Text><Text style={styles.title}>{setName}</Text><Text style={styles.copy}>A raw-card checklist for completing this set. Slabs live separately in your Graded Collection.</Text></View>
        </View>

        <View style={styles.book}>
          <View style={styles.bookSpine} />
          <View style={styles.bookOrbit} />
          <Ionicons name="albums-outline" size={30} color={FateDropColors.echo} />
          <Text style={styles.bookLabel}>COLLECTION PROGRESS</Text>
          <Text style={styles.bookPercent}>{percent(binder?.completionPercent)}</Text>
          <Text style={styles.bookCount}>{binder?.ownedCount ?? '—'} of {binder?.totalCount ?? '—'} checklist cards</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, binder?.completionPercent || 0))}%` }]} /></View>
          <Text style={styles.missingCount}>{binder?.missingCount == null ? 'Checklist still building' : binder.missingCount === 0 ? 'Set complete' : `${binder.missingCount} cards still needed`}</Text>
        </View>

        <View style={styles.switcher}>
          <ViewButton label="NEEDED" value={missing.length} selected={view === 'needed'} onPress={() => setView('needed')} />
          <ViewButton label="OWNED" value={owned.length} selected={view === 'owned'} onPress={() => setView('owned')} />
        </View>

        {message ? <View accessibilityLiveRegion="polite" style={styles.message}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.echo} /><Text style={styles.messageText}>{message}</Text></View> : null}
        {error ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={20} color={FateDropColors.vanished} /><Text style={styles.stateText}>{error}</Text></View> : null}
        {loading && !binder ? <View style={styles.state}><ActivityIndicator color={FateDropColors.echo} /><Text style={styles.stateText}>Opening your binder…</Text></View> : null}

        {!error && binder?.status === 'unavailable' ? <View style={styles.state}><Ionicons name="time-outline" size={20} color={FateDropColors.muted} /><Text style={styles.stateText}>The verified checklist is still building. FateDrop will not invent a completion percentage.</Text></View> : null}

        <View style={styles.cardGrid}>
          {view === 'needed' ? missing.map((card) => (
            <View key={card.fateCardId} style={styles.cardSleeve}>
              <View style={styles.cardGlow} />
              <View style={styles.cardNumber}><Text style={styles.cardNumberText}>#{card.collectorNumber || '—'}</Text></View>
              <Ionicons name="sparkles-outline" size={22} color={FateDropColors.echo} />
              <Text style={styles.cardName} numberOfLines={2}>{card.name || 'Verified card'}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{card.rarity || card.variantCode || 'Exact printing'}</Text>
              <View style={styles.cardActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${card.name || 'missing card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: card.fateCardId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setId: card.setId, setName: card.setName || undefined, tcg: card.tcgCode || undefined } })} style={styles.priceAction}><Ionicons name="pricetag-outline" size={14} color={FateDropColors.goldBright} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${card.name || 'card'} as owned`} disabled={Boolean(addingId)} onPress={() => void addMissing(card)} style={({ pressed }) => [styles.addAction, pressed && styles.pressed]}>{addingId === card.fateCardId ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <><Ionicons name="add" size={15} color={FateDropColors.background} /><Text style={styles.addText}>ADD OWNED</Text></>}</Pressable>
              </View>
            </View>
          )) : owned.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${item.card?.name || 'owned card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: item.card?.name || undefined, collectorNumber: item.card?.collectorNumber || undefined, setId, setName, tcg: item.card?.tcgCode || undefined } })} style={({ pressed }) => [styles.cardSleeve, styles.ownedCard, pressed && styles.pressed]}>
              <View style={styles.cardGlow} />
              <View style={styles.cardNumber}><Text style={styles.cardNumberText}>#{item.card?.collectorNumber || '—'}</Text></View>
              <Ionicons name="checkmark-circle-outline" size={22} color={FateDropColors.manifested} />
              <Text style={styles.cardName} numberOfLines={2}>{item.card?.name || 'Verified card'}</Text>
              <Text style={styles.cardMeta}>{item.conditionCode?.replaceAll('_', ' ') || 'condition unknown'} · ×{item.quantity}</Text>
              <Text style={styles.ownedLabel}>OWNED</Text>
            </Pressable>
          ))}
        </View>

        {!loading && !error && view === 'needed' && !missing.length ? <View style={styles.state}><Ionicons name="ribbon-outline" size={24} color={FateDropColors.manifested} /><Text style={styles.stateTitle}>Nothing missing</Text><Text style={styles.stateText}>Every verified checklist printing is already represented.</Text></View> : null}
        {!loading && !error && view === 'owned' && !owned.length ? <View style={styles.state}><Text style={styles.stateText}>No raw cards are recorded in this binder yet.</Text></View> : null}

        <View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Duplicates increase copy count, never completion. One verified raw printing fills one checklist slot. Graded slabs never fill binder slots.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ViewButton({ label, onPress, selected, value }: { label: string; onPress: () => void; selected: boolean; value: number }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.viewButton, selected && styles.viewButtonActive]}><Text style={[styles.viewValue, selected && styles.viewValueActive]}>{value}</Text><Text style={[styles.viewLabel, selected && styles.viewLabelActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.61)' },
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: 1.08 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 29, lineHeight: 34, marginTop: 4 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  book: { minHeight: 264, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 20, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.46)', borderRadius: 7, backgroundColor: 'rgba(5,8,22,.78)' },
  bookSpine: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(226,197,141,.28)' },
  bookOrbit: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)' },
  bookLabel: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 12 },
  bookPercent: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 46, lineHeight: 54, marginTop: 2 },
  bookCount: { color: FateDropColors.secondary, fontSize: 10 },
  track: { width: '72%', height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(255,255,255,.09)', marginTop: 15 },
  fill: { height: 4, borderRadius: 2, backgroundColor: FateDropColors.echo },
  missingCount: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '800', marginTop: 10 },
  switcher: { flexDirection: 'row', marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  viewButton: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', opacity: .58 },
  viewButtonActive: { opacity: 1, borderBottomWidth: 2, borderBottomColor: FateDropColors.echo },
  viewValue: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 18 },
  viewValueActive: { color: FateDropColors.ivory },
  viewLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .8, marginTop: 3 },
  viewLabelActive: { color: FateDropColors.echo },
  message: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  messageText: { flex: 1, color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  cardSleeve: { width: '48.4%', minHeight: 218, overflow: 'hidden', padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', borderRadius: 9, backgroundColor: 'rgba(5,9,22,.78)' },
  ownedCard: { borderColor: 'rgba(124,110,255,.55)' },
  cardGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -54, top: -50, backgroundColor: 'rgba(124,110,255,.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.24)' },
  cardNumber: { alignSelf: 'flex-end' },
  cardNumberText: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900' },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15, lineHeight: 18, marginTop: 15 },
  cardMeta: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, textTransform: 'capitalize', marginTop: 5 },
  cardActions: { marginTop: 'auto', flexDirection: 'row', gap: 7, paddingTop: 14 },
  priceAction: { width: 38, minHeight: 35, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 8 },
  addAction: { flex: 1, minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, backgroundColor: FateDropColors.echo },
  addText: { color: FateDropColors.background, fontSize: 7, fontWeight: '900', letterSpacing: .35 },
  ownedLabel: { color: FateDropColors.manifested, fontSize: 7, fontWeight: '900', letterSpacing: .7, marginTop: 'auto', paddingTop: 14 },
  state: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 25 },
  stateTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18 },
  stateText: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  truth: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 24, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.muted, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .72 },
});
