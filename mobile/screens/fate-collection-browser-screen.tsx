import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  confirmCollectrCsv,
  FateCollectorApiError,
  fetchFateCollectorCollection,
  fetchFateCollectorDashboard,
  previewCollectrCsv,
  type CollectrPreview,
  type FateCollectorItem,
  type FateCollectorsDashboardSnapshot,
} from '@/services/fate-collector';

type FilterKey = 'all' | 'pokemon' | 'one-piece' | 'by-set' | 'high-value';
type SortKey = 'name' | 'set' | 'quantity';

type CardWithArt = NonNullable<FateCollectorItem['card']> & {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
};

function money(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; }
}

function normalise(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function importError(error: unknown) {
  if (error instanceof FateCollectorApiError && error.status === 404 && error.code === 'NOT_FOUND') return 'Confirmed imports are not enabled on this Cloud deployment yet.';
  return error instanceof Error ? error.message : 'Fate Collections could not complete that import.';
}

export default function FateCollectionBrowserScreen() {
  const [items, setItems] = useState<FateCollectorItem[]>([]);
  const [dashboard, setDashboard] = useState<FateCollectorsDashboardSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('set');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<CollectrPreview | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importName, setImportName] = useState('');
  const [importWorking, setImportWorking] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [collection, nextDashboard] = await Promise.all([
        fetchFateCollectorCollection(),
        fetchFateCollectorDashboard({ force: true }),
      ]);
      setItems(collection.items.filter((item) => item.copyState === 'raw'));
      setDashboard(nextDashboard);
    } catch {
      setError('Your collection could not be loaded safely right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const currentPriceById = useMemo(() => {
    const map = new Map<string, { value: number; currency: string | null }>();
    const pulse = dashboard?.personalPulse;
    if (!pulse) return map;
    for (const period of [pulse.periods.d7, pulse.periods.d30]) {
      for (const mover of [...period.risers, ...period.decliners]) {
        if (mover.currentPrice != null && Number.isFinite(mover.currentPrice)) map.set(mover.cardIdentityId, { value: mover.currentPrice, currency: mover.currencyCode });
      }
    }
    return map;
  }, [dashboard?.personalPulse]);

  const filtered = useMemo(() => {
    const q = normalise(query);
    const next = items.filter((item) => {
      const card = item.card;
      if (!card) return false;
      const haystack = [card.name, card.setName, card.collectorNumber, card.rarity, card.variantCode, card.tcgCode].map(normalise).join(' ');
      if (q && !haystack.includes(q)) return false;
      if (filter === 'pokemon' && normalise(card.tcgCode) !== 'pokemon') return false;
      if (filter === 'one-piece' && !['one_piece', 'one-piece', 'onepiece'].includes(normalise(card.tcgCode))) return false;
      return true;
    });
    next.sort((a, b) => {
      if (sort === 'quantity') return Number(b.quantity || 0) - Number(a.quantity || 0) || String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
      if (sort === 'name') return String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
      return String(a.card?.setName || '').localeCompare(String(b.card?.setName || '')) || String(a.card?.collectorNumber || '').localeCompare(String(b.card?.collectorNumber || ''), undefined, { numeric: true });
    });
    if (filter === 'high-value') next.sort((a, b) => Number(currentPriceById.get(b.fateCardId)?.value || -1) - Number(currentPriceById.get(a.fateCardId)?.value || -1));
    if (filter === 'by-set') next.sort((a, b) => String(a.card?.setName || '').localeCompare(String(b.card?.setName || '')) || String(a.card?.collectorNumber || '').localeCompare(String(b.card?.collectorNumber || ''), undefined, { numeric: true }));
    return next;
  }, [currentPriceById, filter, items, query, sort]);

  const rawValue = dashboard?.summary.rawCollection;
  const currency = rawValue?.currencyCode || dashboard?.summary.currencyCode || 'GBP';
  const copies = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  const setsRepresented = new Set(items.map((item) => item.card?.setId).filter(Boolean)).size;

  const chooseCsv = async () => {
    setImportWorking(true);
    setImportMessage('');
    try {
      const picked = await File.pickFileAsync({ multipleFiles: false, mimeTypes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'] });
      if (picked.canceled) return;
      const file = picked.result;
      if (file.size > 2_000_000) throw new Error('That CSV is larger than FateDrop’s 2 MB safe import limit.');
      const text = await file.text();
      const next = await previewCollectrCsv(text);
      setCsvText(text);
      setImportName(file.name || 'collection export.csv');
      setPreview(next);
      setImportMessage('Preview ready. Exact rows can be confirmed; ambiguous or unresolved rows remain held.');
    } catch (caught) {
      setImportMessage(importError(caught));
    } finally {
      setImportWorking(false);
    }
  };

  const confirmImport = async () => {
    if (!preview || !csvText) return;
    setImportWorking(true);
    setImportMessage('');
    try {
      const result = await confirmCollectrCsv(csvText, preview.confirmationToken || preview.preview.confirmationToken || '');
      setImportMessage(result.duplicate ? 'This exact export was already applied. Nothing was duplicated.' : `Import complete · ${result.summary.created} added · ${result.summary.updated} updated · ${result.summary.held} held.`);
      setPreview(null);
      setCsvText('');
      setImportName('');
      await load();
    } catch (caught) {
      setImportMessage(importError(caught));
    } finally {
      setImportWorking(false);
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
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · PERSONAL COLLECTION</Text>
            <Text style={styles.title}>Your owned cards. Real value. Real stories.</Text>
            <Text style={styles.copy}>Your personal collection, in one place. Track, value and explore your raw cards with verified exact-card data from FatePrice.</Text>
          </View>
        </View>

        <View style={styles.valueCard}>
          <View style={styles.valueOrbit} />
          <Text style={styles.valueLabel}>{rawValue?.totalUnits && rawValue.unpricedUnits === 0 ? 'RAW-CARD VALUE' : 'KNOWN RAW-CARD VALUE'}</Text>
          <Text style={styles.valueMain}>{rawValue && rawValue.pricedUnits > 0 ? money(rawValue.unpricedUnits === 0 ? rawValue.totalValue : rawValue.knownValue, currency) : '—'}</Text>
          <View style={styles.valueMetrics}>
            <ValueMetric icon="layers-outline" value={String(copies)} label="TOTAL COPIES" />
            <View style={styles.valueDivider} />
            <ValueMetric icon="albums-outline" value={String(setsRepresented)} label="SETS REPRESENTED" />
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={FateDropColors.secondary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search your collection…" placeholderTextColor={FateDropColors.muted} style={styles.searchInput} autoCorrect={false} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          <FilterChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Pokémon" selected={filter === 'pokemon'} onPress={() => setFilter('pokemon')} />
          <FilterChip label="One Piece" selected={filter === 'one-piece'} onPress={() => setFilter('one-piece')} />
          <FilterChip label="By set" selected={filter === 'by-set'} onPress={() => setFilter('by-set')} />
          <FilterChip label="High value" selected={filter === 'high-value'} onPress={() => setFilter('high-value')} />
        </ScrollView>

        <View style={styles.actionRow}>
          <ActionCard icon="pricetag-outline" title="Add from FatePrice" onPress={() => router.push('/fate-price')} />
          <ActionCard icon="document-attach-outline" title={importName || 'Import Collection CSV'} loading={importWorking} onPress={() => void chooseCsv()} />
        </View>

        {preview ? (
          <View style={styles.previewCard}>
            <View style={styles.previewTop}><Text style={styles.previewTitle}>SAFE IMPORT PREVIEW</Text><Text style={styles.previewCount}>{preview.preview.matched.exact} exact</Text></View>
            <Text style={styles.previewCopy}>{preview.preview.plan.create} add · {preview.preview.plan.update} update · {preview.preview.plan.hold} held · {preview.preview.matched.ambiguous} ambiguous · {preview.preview.matched.unresolved} unresolved.</Text>
            <Pressable accessibilityRole="button" disabled={importWorking || preview.preview.scale?.mayBeTruncated === true} onPress={() => void confirmImport()} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}>
              {importWorking ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name="checkmark-circle-outline" size={17} color={FateDropColors.background} />}
              <Text style={styles.confirmText}>CONFIRM EXACT IMPORT</Text>
            </Pressable>
          </View>
        ) : null}
        {importMessage ? <Text style={styles.importMessage}>{importMessage}</Text> : null}

        <View style={styles.listHead}>
          <Text style={styles.listCount}>{filtered.length} {filtered.length === 1 ? 'CARD' : 'CARDS'}</Text>
          <Pressable accessibilityRole="button" onPress={() => setSort((value) => value === 'set' ? 'name' : value === 'name' ? 'quantity' : 'set')} style={styles.sortButton}>
            <Ionicons name="swap-vertical-outline" size={15} color={FateDropColors.secondary} />
            <Text style={styles.sortText}>Sort: {sort === 'set' ? 'Set' : sort === 'name' ? 'Name' : 'Quantity'}</Text>
          </Pressable>
        </View>

        {loading && !items.length ? <StateLine loading text="Reading your collection…" /> : null}
        {error ? <StateLine danger text={error} /> : null}
        {!loading && !error && !filtered.length ? <StateLine text="No owned raw cards match this view yet." /> : null}

        <View style={styles.list}>
          {filtered.map((item) => <CollectionRow key={item.id} item={item} price={currentPriceById.get(item.fateCardId) || null} />)}
        </View>

        <View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Every card links back to FatePrice with verified exact-card identity. Missing price or artwork evidence remains visibly unavailable rather than being invented.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ValueMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.valueMetric}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /><View><Text style={styles.valueMetricLabel}>{label}</Text><Text style={styles.valueMetricValue}>{value}</Text></View></View>;
}

function FilterChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text></Pressable>;
}

function ActionCard({ icon, loading = false, onPress, title }: { icon: keyof typeof Ionicons.glyphMap; loading?: boolean; onPress: () => void; title: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>{loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name={icon} size={19} color={FateDropColors.goldBright} />}<Text style={styles.actionTitle} numberOfLines={2}>{title}</Text><Ionicons name="chevron-forward" size={15} color={FateDropColors.ivory} /></Pressable>;
}

function CollectionRow({ item, price }: { item: FateCollectorItem; price: { value: number; currency: string | null } | null }) {
  const card = item.card as CardWithArt | null | undefined;
  const art = card?.thumbnailUrl || card?.imageUrl || null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${card?.name || 'owned card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, collectorNumber: card?.collectorNumber || undefined, setId: card?.setId || undefined, setName: card?.setName || undefined, tcg: card?.tcgCode || undefined } })} style={({ pressed }) => [styles.cardRow, pressed && styles.pressed]}>
      {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={18} color={FateDropColors.echo} /></View>}
      <View style={styles.cardText}>
        <Text style={styles.cardName} numberOfLines={1}>{card?.name || 'Verified card'}</Text>
        <Text style={styles.cardSet} numberOfLines={1}>{card?.setName || 'Verified set'}</Text>
        <Text style={styles.cardMeta}>#{card?.collectorNumber || '—'} · {card?.rarity || card?.variantCode || 'exact printing'}</Text>
      </View>
      <View style={styles.quantityPill}><Text style={styles.quantityText}>Qty: {item.quantity}</Text></View>
      <View style={styles.priceColumn}><Text style={styles.cardPrice}>{price ? money(price.value * Math.max(1, item.quantity || 1), price.currency || 'GBP') : 'FatePrice'}</Text>{price && item.quantity > 1 ? <Text style={styles.eachPrice}>{money(price.value, price.currency || 'GBP')} each</Text> : null}</View>
      <Ionicons name="chevron-forward" size={15} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function StateLine({ danger = false, loading = false, text }: { danger?: boolean; loading?: boolean; text: string }) {
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : 'albums-outline'} size={19} color={danger ? FateDropColors.vanished : FateDropColors.muted} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.58)' },
  content: { paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 6 },
  valueCard: { minHeight: 170, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.62)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.70)' },
  valueOrbit: { position: 'absolute', width: 300, height: 130, borderRadius: 150, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)' },
  valueLabel: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.25 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 39, lineHeight: 45, marginTop: 4 },
  valueMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  valueMetric: { minWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  valueMetricLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .7 },
  valueMetricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 2 },
  valueDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: 'rgba(226,197,141,.28)' },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.70)' },
  searchInput: { flex: 1, color: FateDropColors.ivory, fontSize: 13 },
  filterRail: { gap: 8, paddingTop: 11, paddingBottom: 5 },
  filterChip: { height: 38, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', borderRadius: 20, backgroundColor: 'rgba(4,8,21,.58)' },
  filterChipActive: { borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(226,197,141,.09)' },
  filterChipText: { color: FateDropColors.secondary, fontSize: 9.5 },
  filterChipTextActive: { color: FateDropColors.ivory },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  actionCard: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.58)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.72)' },
  actionTitle: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  previewCard: { marginTop: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.78)' },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: .8 },
  previewCount: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  previewCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 6 },
  confirmButton: { minHeight: 40, marginTop: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: FateDropColors.goldBright },
  confirmText: { color: FateDropColors.background, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  importMessage: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 8 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 9 },
  listCount: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: FateDropColors.secondary, fontSize: 9 },
  list: { gap: 8 },
  cardRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.72)' },
  cardArt: { width: 48, height: 66, borderRadius: 5, backgroundColor: 'rgba(124,110,255,.10)' },
  cardArtPlaceholder: { width: 48, height: 66, borderRadius: 5, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14 },
  cardSet: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 2 },
  cardMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 2 },
  quantityPill: { minWidth: 48, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 14 },
  quantityText: { color: FateDropColors.secondary, fontSize: 7.5 },
  priceColumn: { minWidth: 62, alignItems: 'flex-end' },
  cardPrice: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  eachPrice: { color: FateDropColors.muted, fontSize: 6.8, marginTop: 2 },
  stateLine: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  truth: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 15, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .72 },
});
