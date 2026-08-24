import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader, FilterChip, ProductCard } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
import { loadWatchlist, toggleWatchlist } from '@/lib/watchlist';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { fetchRetailerDirectory, type NetworkRetailer } from '@/services/retailer-directory';
import type { ProductCategory } from '@/types/domain';

type Mode = 'retailers' | 'offers';
type DirectoryFilter = 'all' | 'independent' | 'specialist' | 'regional' | 'healthy';

const categories: { label: string; value?: ProductCategory }[] = [
  { label: 'All' },
  { label: 'Sealed', value: 'SEALED' },
  { label: 'Preorders', value: 'PREORDER' },
  { label: 'Singles', value: 'SINGLE' },
  { label: 'Accessories', value: 'ACCESSORY' },
];

function classLabel(value: string) {
  if (value === 'independent') return 'Independent';
  if (value === 'specialist') return 'Specialist';
  if (value === 'regional') return 'Regional';
  return value.replaceAll('_', ' ');
}

function relative(epoch: number | null) {
  if (!epoch) return 'No successful scan recorded';
  const mins = Math.max(0, Math.floor((Date.now() - epoch * 1000) / 60_000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  if (mins < 1440) return `Updated ${Math.floor(mins / 60)}h ago`;
  return `Updated ${Math.floor(mins / 1440)}d ago`;
}

function RetailerCard({ retailer }: { retailer: NetworkRetailer }) {
  const healthColor = retailer.monitoring.healthy ? FateDropColors.mint : retailer.monitoring.stale ? FateDropColors.amber : FateDropColors.secondary;
  return <Pressable
    disabled={!retailer.websiteUrl}
    onPress={() => retailer.websiteUrl ? void Linking.openURL(retailer.websiteUrl) : undefined}
    style={({ pressed }) => [styles.retailerCard, pressed && styles.pressed]}
  >
    <View style={styles.retailerTop}>
      <View style={styles.retailerMark}><Text style={styles.retailerInitials}>{retailer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
      <View style={styles.retailerCopy}>
        <View style={styles.retailerNameRow}><Text style={styles.retailerName}>{retailer.name}</Text>{retailer.verification === 'verified' ? <Ionicons name="checkmark-circle" size={15} color={FateDropColors.mint} /> : null}</View>
        <Text style={styles.retailerClass}>{classLabel(retailer.retailerClass).toUpperCase()} · {retailer.tcgs.map((tcg) => tcg.toUpperCase()).join(' · ')}</Text>
      </View>
      <Ionicons name="open-outline" size={15} color={retailer.websiteUrl ? FateDropColors.secondary : FateDropColors.muted} />
    </View>
    <View style={styles.retailerHealth}>
      <View style={styles.healthText}><View style={[styles.healthDot, { backgroundColor: healthColor }]} /><Text style={[styles.healthLabel, { color: healthColor }]}>{retailer.monitoring.healthy ? 'MONITOR HEALTHY' : retailer.monitoring.stale ? 'MONITOR STALE' : 'MONITOR CHECK'}</Text></View>
      <Text style={styles.healthMeta}>{retailer.monitoring.productsSeen == null ? 'Product count unavailable' : `${retailer.monitoring.productsSeen.toLocaleString()} products seen`} · {relative(retailer.monitoring.lastSuccessAt)}</Text>
    </View>
  </Pressable>;
}

export default function IndiesScreenV2() {
  const [mode, setMode] = useState<Mode>('retailers');
  const [directory, setDirectory] = useState<NetworkRetailer[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [offerQuery, setOfferQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [retailerId, setRetailerId] = useState<string>();
  const [watched, setWatched] = useState<string[]>([]);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const result = await fetchRetailerDirectory();
      setDirectory(result.retailers.filter((retailer) => ['independent', 'specialist', 'regional'].includes(retailer.retailerClass)));
    } catch (cause) {
      setDirectory([]);
      setDirectoryError(cause instanceof Error ? cause.message : 'Retailer network is unavailable.');
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadDirectory();
    void loadWatchlist().then(setWatched);
  }, [loadDirectory]));

  const shownRetailers = useMemo(() => directory.filter((retailer) => {
    const term = query.trim().toLowerCase();
    if (term && !`${retailer.name} ${retailer.tcgs.join(' ')}`.toLowerCase().includes(term)) return false;
    if (filter === 'healthy') return retailer.monitoring.healthy;
    if (filter !== 'all') return retailer.retailerClass === filter;
    return true;
  }), [directory, filter, query]);

  const catalogue = useCatalogue({
    query: offerQuery,
    category,
    retailerId,
    inStockOnly: true,
    limit: 50,
  });
  const directoryIds = useMemo(() => new Set(directory.map((retailer) => retailer.id)), [directory]);
  const indieOffers = useMemo(() => catalogue.offers.filter((offer) => directoryIds.has(offer.retailerId)), [catalogue.offers, directoryIds]);

  const header = <>
    <FateDropHeader title="Indies" subtitle="SUPPORT THE RETAILER BEHIND THE STOCK" />
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.eyebrow}>FATEDROP INDEPENDENT NETWORK</Text>
      <Text style={styles.heroTitle}>Discover the shops collectors should know.</Text>
      <Text style={styles.heroCopy}>Retailer identity comes from the live FateDrop Cloud directory. Monitor health tells you whether FateDrop is currently receiving evidence — it does not pretend every shop has stock.</Text>
      <View style={styles.heroStats}>
        <View><Text style={styles.statValue}>{directory.length || '—'}</Text><Text style={styles.statLabel}>CONNECTED INDIES</Text></View>
        <View><Text style={styles.statValue}>{directory.filter((item) => item.monitoring.healthy).length || '—'}</Text><Text style={styles.statLabel}>HEALTHY MONITORS</Text></View>
        <View><Text style={styles.statValue}>{new Set(directory.flatMap((item) => item.tcgs)).size || '—'}</Text><Text style={styles.statLabel}>TCGS</Text></View>
      </View>
    </View>
    <View style={styles.modeRow}><FilterChip label="Retailers" active={mode === 'retailers'} onPress={() => setMode('retailers')} /><FilterChip label="Live offers" active={mode === 'offers'} onPress={() => setMode('offers')} /></View>
  </>;

  if (mode === 'retailers') {
    return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList
      data={shownRetailers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={directoryLoading} onRefresh={() => void loadDirectory()} tintColor={FateDropColors.violetLight} />}
      ListHeaderComponent={<>{header}<View style={styles.search}><Ionicons name="search" size={17} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search independent retailers" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View><FlatList horizontal data={['all', 'independent', 'specialist', 'regional', 'healthy'] as DirectoryFilter[]} keyExtractor={(item) => item} renderItem={({ item }) => <FilterChip label={item === 'all' ? 'All' : item === 'healthy' ? 'Healthy now' : classLabel(item)} active={filter === item} onPress={() => setFilter(item)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} /><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{shownRetailers.length} retailers</Text><Text style={styles.sectionMeta}>LIVE DIRECTORY</Text></View>{directoryError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><Text style={styles.errorText}>{directoryError}</Text></View> : null}</>}
      ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
      ListEmptyComponent={!directoryLoading && !directoryError ? <View style={styles.empty}><Text style={styles.emptyTitle}>No retailers match</Text><Text style={styles.emptyCopy}>Adjust the directory filters. FateDrop does not substitute demo retailers into the live network.</Text></View> : null}
      renderItem={({ item }) => <RetailerCard retailer={item} />}
    /></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList
    data={indieOffers}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<>{header}<View style={styles.search}><Ionicons name="search" size={17} color={FateDropColors.muted} /><TextInput value={offerQuery} onChangeText={setOfferQuery} placeholder="Search live indie offers" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View><FlatList horizontal data={categories} keyExtractor={(item) => item.label} renderItem={({ item }) => <FilterChip label={item.label} active={category === item.value} onPress={() => setCategory(item.value)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} /><FlatList horizontal data={[{ id: undefined, name: 'All indies' }, ...directory]} keyExtractor={(item) => item.id || 'all'} renderItem={({ item }) => <FilterChip label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} /><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{indieOffers.length} loaded offers</Text><Text style={styles.sectionMeta}>IN STOCK</Text></View></>}
    ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
    onEndReached={() => void catalogue.loadMore()}
    onEndReachedThreshold={0.5}
    ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.loading} /> : null}
    ListEmptyComponent={catalogue.loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.loading} /> : <View style={styles.empty}><Text style={styles.emptyTitle}>No matching indie offers</Text><Text style={styles.emptyCopy}>{catalogue.error || 'No connected indie offer currently matches these filters.'}</Text></View>}
    renderItem={({ item }) => {
      const retailer = directory.find((candidate) => candidate.id === item.retailerId);
      const delivery = item.shippingOptions.find((option) => !option.collection)?.priceGbp;
      return <ProductCard
        title={item.title}
        retailer={retailer?.name || item.retailerId}
        details={`${item.condition.replaceAll('_', ' ')} · ${delivery === undefined ? 'Delivery unknown' : `Delivery £${delivery.toFixed(2)}`}`}
        price={item.priceGbp === undefined ? 'Price unavailable' : `£${item.priceGbp.toFixed(2)}`}
        stockLabel={item.preorder ? 'Preorder' : 'In stock'}
        stockTone="mint"
        fateLabel={item.pulseLabels?.[0]?.replaceAll('_', ' ')}
        fateTone={item.pulseLabels?.includes('PRICE_DROPPED') ? 'mint' : 'violet'}
        imageSource={item.imageUrl ? { uri: item.imageUrl } : undefined}
        productUrl={item.productUrl}
        onOpenProduct={item.productUrl ? () => void openTrackedRetailerLink({ destinationUrl: item.productUrl!, retailerId: item.retailerId, offerId: item.id, placement: 'indies-v2' }) : undefined}
        inWatchlist={watched.includes(item.id)}
        onToggleWatchlist={() => void toggleWatchlist(item.id, watched).then(setWatched)}
      />;
    }}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(103,232,249,.16)', backgroundColor: 'rgba(9,10,17,.94)', marginBottom: 11 }, heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -80, top: -95, backgroundColor: 'rgba(103,232,249,.08)' }, eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: FateDropColors.text, fontSize: 25, lineHeight: 28, fontWeight: '900', letterSpacing: -0.65, marginTop: 7, maxWidth: 330 }, heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 }, heroStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: FateDropColors.border, marginTop: 15, paddingTop: 12 }, statValue: { color: FateDropColors.text, fontSize: 18, fontWeight: '900' }, statLabel: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: .7, marginTop: 2 },
  modeRow: { flexDirection: 'row', gap: 7, marginBottom: 12 }, search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginBottom: 9 }, input: { flex: 1, color: FateDropColors.text, fontSize: 12 }, filters: { gap: 7, paddingBottom: 10 }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 7 }, sectionTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900' }, sectionMeta: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  retailerCard: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' }, retailerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, retailerMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}12`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}28` }, retailerInitials: { color: FateDropColors.violetLight, fontSize: 11, fontWeight: '900' }, retailerCopy: { flex: 1 }, retailerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, retailerName: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' }, retailerClass: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '800', letterSpacing: .6, marginTop: 4 }, retailerHealth: { borderTopWidth: 1, borderTopColor: FateDropColors.border, marginTop: 11, paddingTop: 9 }, healthText: { flexDirection: 'row', alignItems: 'center', gap: 6 }, healthDot: { width: 6, height: 6, borderRadius: 3 }, healthLabel: { fontSize: 7, fontWeight: '900', letterSpacing: .8 }, healthMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 4 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, marginBottom: 9, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.amber}45`, backgroundColor: `${FateDropColors.amber}0A` }, errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 }, empty: { alignItems: 'center', padding: 25, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, emptyTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 }, loading: { margin: 30 }, pressed: { opacity: .78, transform: [{ scale: .99 }] },
});
