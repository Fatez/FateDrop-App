import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollectionsScreen } from '@/components/fate-collections-ui';
import { useCollectionCardPrice } from '@/hooks/use-collection-card-price';
import { useCollectionsResource } from '@/hooks/use-collections-resource';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  fetchFateCollectorCollection,
  fetchFateCollectorDashboard,
  type FateCollectorItem,
} from '@/services/fate-collector';

type FilterKey = 'all' | 'pokemon' | 'one-piece';
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

const readCollection = async () => {
  const [collection, dashboard] = await Promise.all([fetchFateCollectorCollection(), fetchFateCollectorDashboard({ force: true })]);
  return { collection, dashboard };
};

export default function FateCollectionBrowserScreen() {
  const { data, loading, error, load } = useCollectionsResource(readCollection);
  const items = useMemo(() => data?.collection.items.filter((item) => item.copyState === 'raw') || [], [data]);
  const dashboard = data?.dashboard;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('set');

  const filtered = useMemo(() => {
    const q = normalise(query);
    const next = items.filter((item) => {
      const card = item.card;
      const haystack = [card?.name, card?.setName, card?.collectorNumber, card?.rarity, card?.variantCode, card?.tcgCode, item.fateCardId].map(normalise).join(' ');
      if (q && !haystack.includes(q)) return false;
      if (filter === 'pokemon' && normalise(card?.tcgCode) !== 'pokemon') return false;
      if (filter === 'one-piece' && !['one_piece', 'one-piece', 'onepiece'].includes(normalise(card?.tcgCode))) return false;
      return true;
    });
    next.sort((a, b) => {
      if (sort === 'quantity') return Number(b.quantity || 0) - Number(a.quantity || 0) || String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
      if (sort === 'name') return String(a.card?.name || '').localeCompare(String(b.card?.name || ''));
      return String(a.card?.setName || '').localeCompare(String(b.card?.setName || '')) || String(a.card?.collectorNumber || '').localeCompare(String(b.card?.collectorNumber || ''), undefined, { numeric: true });
    });
    return next;
  }, [filter, items, query, sort]);

  const rawValue = dashboard?.summary.rawCollection;
  const currency = rawValue?.currencyCode || dashboard?.summary.currencyCode || 'GBP';
  const copies = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  const setsRepresented = new Set(items.map((item) => item.card?.setId).filter(Boolean)).size;

  return (
    <CollectionsScreen>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}
        ListHeaderComponent={<>

        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/collections')} style={styles.back}><Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · PERSONAL COLLECTION</Text>
            <Text style={styles.title}>Your owned cards. Real value. Real stories.</Text>
            <Text style={styles.copy}>Your ungraded cards, in one place. Explore exact card prices and add your latest finds.</Text>
          </View>
        </View>

        <View style={styles.valueCard}>
          <View style={styles.valueOrbit} />
          <Text style={styles.valueLabel}>{rawValue?.totalUnits && rawValue.unpricedUnits === 0 ? 'UNGRADED VALUE' : 'KNOWN UNGRADED VALUE'}</Text>
          <Text style={styles.valueMain}>{rawValue && rawValue.pricedUnits > 0 ? money(rawValue.unpricedUnits === 0 ? rawValue.totalValue : rawValue.knownValue, currency) : '—'}</Text>
          <View style={styles.valueMetrics}>
            <ValueMetric icon="layers-outline" value={data ? String(copies) : '—'} label="TOTAL COPIES" />
            <View style={styles.valueDivider} />
            <ValueMetric icon="albums-outline" value={data ? String(setsRepresented) : '—'} label="SETS REPRESENTED" />
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={FateDropColors.secondary} />
          <TextInput accessibilityLabel="Search your collection" value={query} onChangeText={setQuery} placeholder="Search your collection…" placeholderTextColor={FateDropColors.muted} style={styles.searchInput} autoCorrect={false} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          <FilterChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Pokémon" selected={filter === 'pokemon'} onPress={() => setFilter('pokemon')} />
          <FilterChip label="One Piece" selected={filter === 'one-piece'} onPress={() => setFilter('one-piece')} />
          <FilterChip label="By set" selected={sort === 'set'} onPress={() => setSort('set')} />
        </ScrollView>

        <View style={styles.actionRow}>
          <ActionCard icon="pricetag-outline" title="Add from FatePrice" onPress={() => router.push('/fate-price')} />
        </View>

        <View style={styles.listHead}>
          <Text style={styles.listCount}>{filtered.length} {filtered.length === 1 ? 'OWNED ENTRY' : 'OWNED ENTRIES'}</Text>
          <Pressable accessibilityRole="button" onPress={() => setSort((value) => value === 'set' ? 'name' : value === 'name' ? 'quantity' : 'set')} style={styles.sortButton}>
            <Ionicons name="swap-vertical-outline" size={15} color={FateDropColors.secondary} />
            <Text style={styles.sortText}>Sort: {sort === 'set' ? 'Set' : sort === 'name' ? 'Name' : 'Quantity'}</Text>
          </Pressable>
        </View>

        {loading && !items.length ? <StateLine loading text="Reading your collection…" /> : null}
        {error ? <StateLine danger text={error} /> : null}
        {!loading && !error && !filtered.length ? <StateLine text="No ungraded cards match this view. Try another search or add a card from FatePrice." /> : null}

        </>}
        renderItem={({ item }) => <CollectionRow item={item} refreshKey={data} />}
        ListFooterComponent={<>

        <View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Prices are exact-card market guides in pounds, not condition appraisals. Tap a card to inspect its FatePrice. Graded cards have their own cabinet.</Text></View>
        </>}
      />
    </CollectionsScreen>
  );
}

function ValueMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.valueMetric}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /><View><Text style={styles.valueMetricLabel}>{label}</Text><Text style={styles.valueMetricValue}>{value}</Text></View></View>;
}

function FilterChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text></Pressable>;
}

function ActionCard({ icon, loading = false, onPress, title }: { icon: keyof typeof Ionicons.glyphMap; loading?: boolean; onPress: () => void; title: string }) {
  return <Pressable accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading, busy: loading }} onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>{loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name={icon} size={19} color={FateDropColors.goldBright} />}<Text style={styles.actionTitle} numberOfLines={2}>{title}</Text><Ionicons name="chevron-forward" size={15} color={FateDropColors.ivory} /></Pressable>;
}

function CollectionRow({ item, refreshKey }: { item: FateCollectorItem; refreshKey: unknown }) {
  const price = useCollectionCardPrice(item.fateCardId, refreshKey);
  const card = item.card as CardWithArt | null | undefined;
  const art = card?.thumbnailUrl || card?.imageUrl || null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${card?.name || 'owned card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, collectorNumber: card?.collectorNumber || undefined, setId: card?.setId || undefined, setName: card?.setName || undefined, tcg: card?.tcgCode || undefined } })} style={({ pressed }) => [styles.cardRow, pressed && styles.pressed]}>
      {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={18} color={FateDropColors.echo} /></View>}
      <View style={styles.cardText}>
        <Text style={styles.cardName} numberOfLines={1}>{card?.name || 'Verified card'}</Text>
        <Text style={styles.cardSet} numberOfLines={1}>{card?.setName || 'Verified set'}</Text>
        <Text style={styles.cardMeta}>#{card?.collectorNumber || '—'} · {card?.rarity || card?.variantCode || 'exact printing'}</Text>
      </View>
      <View style={styles.quantityPill}><Text style={styles.quantityText}>Qty: {item.quantity}</Text></View>
      <View style={styles.priceColumn}><Text style={styles.cardPrice}>{price ? money(price.amount * item.quantity, price.currencyCode) : 'FatePrice'}</Text>{price && item.quantity > 1 ? <Text style={styles.eachPrice}>{money(price.amount, price.currencyCode)} each</Text> : null}</View>
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
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 44, height: 44, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  valueCard: { minHeight: 170, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.62)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.70)' },
  valueOrbit: { position: 'absolute', width: 300, height: 130, borderRadius: 150, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)' },
  valueLabel: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.25 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 39, lineHeight: 45, marginTop: 4 },
  valueMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  valueMetric: { minWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  valueMetricLabel: { color: FateDropColors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: .7 },
  valueMetricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 2 },
  valueDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: 'rgba(226,197,141,.28)' },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.70)' },
  searchInput: { flex: 1, color: FateDropColors.ivory, fontSize: 13 },
  filterRail: { gap: 8, paddingTop: 11, paddingBottom: 5 },
  filterChip: { height: 38, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', borderRadius: 20, backgroundColor: 'rgba(4,8,21,.58)' },
  filterChipActive: { borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(226,197,141,.09)' },
  filterChipText: { color: FateDropColors.secondary, fontSize: 11 },
  filterChipTextActive: { color: FateDropColors.ivory },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  actionCard: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.58)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.72)' },
  actionTitle: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  previewCard: { marginTop: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.78)' },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  previewCount: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  previewCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  confirmButton: { minHeight: 44, marginTop: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: FateDropColors.goldBright },
  confirmText: { color: FateDropColors.background, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  importMessage: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 8 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 9 },
  listCount: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  sortButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: FateDropColors.secondary, fontSize: 11 },
  list: { gap: 8 },
  cardRow: { marginBottom: 10, minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.72)' },
  cardArt: { width: 48, height: 66, borderRadius: 5, backgroundColor: 'rgba(124,110,255,.10)' },
  cardArtPlaceholder: { width: 48, height: 66, borderRadius: 5, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14 },
  cardSet: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  quantityPill: { minWidth: 48, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 14 },
  quantityText: { color: FateDropColors.secondary, fontSize: 11 },
  priceColumn: { minWidth: 62, alignItems: 'flex-end' },
  cardPrice: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  eachPrice: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  stateLine: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  truth: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 15, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: .72 },
});
