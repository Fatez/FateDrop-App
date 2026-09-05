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

type BinderView = 'needed' | 'owned' | 'all';
type ArtFields = { imageUrl?: string | null; thumbnailUrl?: string | null };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function money(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || 'GBP'}`;
  }
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
      setOwned(collection.items.filter((item) => item.copyState === 'raw' && item.card?.setId === setId).sort(sortOwned));
    } catch {
      setError('This binder could not be read safely right now.');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const missing = useMemo(() => [...(binder?.missingCards || [])].sort(sortMissing), [binder?.missingCards]);
  const setName = binder?.setName || routeSetName || 'Set binder';
  const currency = binder?.value?.currencyCode || 'GBP';

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · BINDERS</Text>
            <Text style={styles.title}>{setName}</Text>
            <Text style={styles.copy}>Track every verified raw card in this set. Add missing cards, review owned copies, and keep graded slabs separate.</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressArt}>
            <View style={styles.artOrbit} />
            <Ionicons name="albums-outline" size={40} color={FateDropColors.goldBright} />
            <Text style={styles.artSetLabel} numberOfLines={2}>{setName}</Text>
          </View>
          <View style={styles.progressMain}>
            <Text style={styles.progressEyebrow}>SET COMPLETION</Text>
            <Text style={styles.progressPct}>{pct(binder?.completionPercent)}</Text>
            <Text style={styles.progressOwned}>{binder?.ownedCount ?? '—'} / {binder?.totalCount ?? '—'} cards owned</Text>
          </View>
          <View style={styles.progressSide}>
            <Text style={styles.missingCount}>{binder?.missingCount ?? '—'}</Text>
            <Text style={styles.sideLabel}>cards missing</Text>
            <Text style={styles.missingValue}>{money(binder?.value?.missingValue, currency)}</Text>
            <Text style={styles.sideLabel}>verified missing value</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, binder?.completionPercent || 0))}%` }]} /></View>
          <View style={styles.progressTruth}>
            <Ionicons name="information-circle-outline" size={15} color={FateDropColors.goldBright} />
            <Text style={styles.progressTruthText}>Completion uses verified raw printings only · Graded cards do not fill binder slots.</Text>
          </View>
        </View>

        <View style={styles.switcher}>
          <ViewButton label="NEEDED" value={missing.length} selected={view === 'needed'} onPress={() => setView('needed')} />
          <ViewButton label="OWNED" value={owned.length} selected={view === 'owned'} onPress={() => setView('owned')} />
          <ViewButton label="ALL" value={missing.length + owned.length} selected={view === 'all'} onPress={() => setView('all')} />
        </View>

        <View style={styles.listHead}>
          <Text style={styles.listTitle}>{view === 'needed' ? `${missing.length} missing cards` : view === 'owned' ? `${owned.length} owned lines` : `${missing.length + owned.length} binder lines`}</Text>
          <View style={styles.sortPill}><Text style={styles.sortText}>Sort: Number</Text><Ionicons name="chevron-down" size={13} color={FateDropColors.secondary} /></View>
        </View>

        {message ? <View style={styles.message}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.messageText}>{message}</Text></View> : null}
        {error ? <StateLine danger text={error} /> : null}
        {loading && !binder ? <StateLine loading text="Opening your binder…" /> : null}
        {!error && binder?.status === 'unavailable' ? <StateLine text="The verified checklist is still building. FateDrop will not invent a completion percentage." /> : null}

        <View style={styles.grid}>
          {(view === 'needed' || view === 'all') ? missing.map((card) => (
            <MissingCard key={`missing:${card.fateCardId}`} card={card} adding={addingId === card.fateCardId} disabled={Boolean(addingId)} onAdd={() => void addMissing(card)} />
          )) : null}
          {(view === 'owned' || view === 'all') ? owned.map((item) => (
            <OwnedCard key={`owned:${item.id}`} item={item} setId={setId} setName={setName} />
          )) : null}
        </View>

        {!loading && !error && view === 'needed' && !missing.length ? <StateLine success text="Nothing missing. Every verified checklist printing is represented." /> : null}
        {!loading && !error && view === 'owned' && !owned.length ? <StateLine text="No raw cards are recorded in this binder yet." /> : null}

        <View style={styles.truth}>
          <Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>Duplicates increase copy count, not completion. One verified raw printing fills one checklist slot. Graded cards remain separate.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ViewButton({ label, onPress, selected, value }: { label: string; onPress: () => void; selected: boolean; value: number }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.viewButton, selected && styles.viewButtonActive]}><Text style={[styles.viewValue, selected && styles.viewValueActive]}>{value}</Text><Text style={[styles.viewLabel, selected && styles.viewLabelActive]}>{label}</Text></Pressable>;
}

function MissingCard({ adding, card, disabled, onAdd }: { adding: boolean; card: FateCollectorMissingCard; disabled: boolean; onAdd: () => void }) {
  const withArt = card as FateCollectorMissingCard & ArtFields;
  const art = withArt.thumbnailUrl || withArt.imageUrl || null;
  return (
    <View style={styles.card}>
      {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={24} color={FateDropColors.echo} /></View>}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{card.name || 'Verified card'}</Text>
        <Text style={styles.cardNumber}>#{card.collectorNumber || '—'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{card.rarity || card.variantCode || 'Exact printing'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: card.fateCardId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setId: card.setId, setName: card.setName || undefined, tcg: card.tcgCode || undefined } })} style={styles.priceButton}>
          <Ionicons name="analytics-outline" size={12} color={FateDropColors.echo} /><Text style={styles.priceButtonText}>FATEPRICE</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${card.name || 'card'} as owned`} disabled={disabled} onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
        {adding ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <><Ionicons name="add" size={15} color={FateDropColors.background} /><Text style={styles.addText}>ADD OWNED</Text></>}
      </Pressable>
    </View>
  );
}

function OwnedCard({ item, setId, setName }: { item: FateCollectorItem; setId: string; setName: string }) {
  const card = item.card as (NonNullable<FateCollectorItem['card']> & ArtFields) | null | undefined;
  const art = card?.thumbnailUrl || card?.imageUrl || null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, collectorNumber: card?.collectorNumber || undefined, setId, setName, tcg: card?.tcgCode || undefined } })} style={({ pressed }) => [styles.card, styles.ownedCard, pressed && styles.pressed]}>
      {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[styles.cardArtPlaceholder, styles.ownedArt]}><Ionicons name="checkmark-circle-outline" size={24} color={FateDropColors.manifested} /></View>}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{card?.name || 'Verified card'}</Text>
        <Text style={styles.cardNumber}>#{card?.collectorNumber || '—'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.conditionCode?.replaceAll('_', ' ') || 'condition unknown'} · ×{item.quantity}</Text>
        <Text style={styles.ownedLabel}>OWNED</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function StateLine({ danger = false, loading = false, success = false, text }: { danger?: boolean; loading?: boolean; success?: boolean; text: string }) {
  const color = danger ? FateDropColors.vanished : success ? FateDropColors.manifested : FateDropColors.muted;
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : success ? 'checkmark-circle-outline' : 'time-outline'} size={19} color={color} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.58)' },
  content: { paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 32, lineHeight: 37, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 6 },
  progressCard: { marginTop: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.66)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.76)', overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  progressArt: { width: 92, minHeight: 116, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artOrbit: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)' },
  artSetLabel: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 9.5, textAlign: 'center', marginTop: 8 },
  progressMain: { flex: 1, minWidth: 120 },
  progressEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 },
  progressPct: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 42, lineHeight: 48, marginTop: 2 },
  progressOwned: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  progressSide: { width: 92, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  missingCount: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 25 },
  sideLabel: { color: FateDropColors.secondary, fontSize: 7.5, lineHeight: 10, marginTop: 1 },
  missingValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 10 },
  track: { width: '100%', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.10)', marginTop: 2 },
  fill: { height: 5, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  progressTruth: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 10, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.22)' },
  progressTruthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8, lineHeight: 12 },
  switcher: { flexDirection: 'row', marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 21, overflow: 'hidden' },
  viewButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  viewButtonActive: { borderWidth: 1, borderColor: FateDropColors.goldBright, borderRadius: 21, backgroundColor: 'rgba(226,197,141,.09)' },
  viewValue: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 15 },
  viewValueActive: { color: FateDropColors.ivory },
  viewLabel: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .8, marginTop: 1 },
  viewLabelActive: { color: FateDropColors.goldBright },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, marginBottom: 9 },
  listTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19 },
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 9.5 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
  messageText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.4%', minHeight: 250, padding: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.76)', overflow: 'hidden' },
  ownedCard: { minHeight: 220, borderColor: 'rgba(124,110,255,.48)' },
  cardArt: { width: '100%', aspectRatio: .72, borderRadius: 7, backgroundColor: 'rgba(124,110,255,.08)' },
  cardArtPlaceholder: { width: '100%', aspectRatio: .72, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  ownedArt: { borderColor: 'rgba(66,225,151,.36)' },
  cardBody: { flex: 1, paddingTop: 8 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14, lineHeight: 17 },
  cardNumber: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 2 },
  cardMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 3 },
  priceButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7, paddingHorizontal: 8, height: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', borderRadius: 13 },
  priceButtonText: { color: FateDropColors.echo, fontSize: 6.5, fontWeight: '900', letterSpacing: .7 },
  addButton: { minHeight: 37, marginTop: 9, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: FateDropColors.goldBright },
  addText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .8 },
  ownedLabel: { color: FateDropColors.manifested, fontSize: 7, fontWeight: '900', letterSpacing: .8, marginTop: 9 },
  stateLine: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  truth: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 15, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .72 },
});
