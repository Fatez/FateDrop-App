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
type MarketSegment = 'major' | 'indies';
type Presence = 'all' | 'online' | 'physical';

type SegmentOption = { value: MarketSegment; label: string };
type PresenceOption = { value: Presence; label: string };

const segmentOptions: SegmentOption[] = [
  { value: 'major', label: 'RRP / Major' },
  { value: 'indies', label: 'Independents' },
];

const presenceOptions: PresenceOption[] = [
  { value: 'all', label: 'All indies' },
  { value: 'online', label: 'Online' },
  { value: 'physical', label: 'Physical stores' },
];

const categories: { label: string; value?: ProductCategory }[] = [
  { label: 'All' },
  { label: 'Sealed', value: 'SEALED' },
  { label: 'Preorders', value: 'PREORDER' },
  { label: 'Singles', value: 'SINGLE' },
  { label: 'Accessories', value: 'ACCESSORY' },
];

function isMajor(retailer: NetworkRetailer) {
  return retailer.retailerClass === 'national';
}

function isIndependent(retailer: NetworkRetailer) {
  return ['independent', 'specialist', 'regional'].includes(retailer.retailerClass);
}

function matchesPresence(retailer: NetworkRetailer, presence: Presence) {
  if (presence === 'online') return retailer.online;
  if (presence === 'physical') return retailer.physicalStores === true;
  return true;
}

function classLabel(value: string) {
  if (value === 'national') return 'Major retail';
  if (value === 'independent') return 'Independent';
  if (value === 'specialist') return 'Specialist';
  if (value === 'regional') return 'Regional';
  return value.replaceAll('_', ' ');
}

function presenceLabel(retailer: NetworkRetailer) {
  if (retailer.online && retailer.physicalStores === true) {
    return retailer.physicalLocations && retailer.physicalLocations > 0
      ? `ONLINE + ${retailer.physicalLocations} PHYSICAL LOCATION${retailer.physicalLocations === 1 ? '' : 'S'}`
      : 'ONLINE + PHYSICAL STORE';
  }
  if (retailer.physicalStores === true) return 'PHYSICAL STORE';
  if (retailer.online && retailer.physicalStores === false) return 'ONLINE';
  if (retailer.online) return 'ONLINE · PHYSICAL STATUS UNVERIFIED';
  return 'PRESENCE UNVERIFIED';
}

function relative(epoch: number | null) {
  if (!epoch) return 'No successful scan recorded';
  const mins = Math.max(0, Math.floor((Date.now() - epoch * 1000) / 60_000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  if (mins < 1440) return `Updated ${Math.floor(mins / 60)}h ago`;
  return `Updated ${Math.floor(mins / 1440)}d ago`;
}

function RetailerCard({ retailer, segment }: { retailer: NetworkRetailer; segment: MarketSegment }) {
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
        <Text style={styles.presence}>{presenceLabel(retailer)}</Text>
      </View>
      <Ionicons name="open-outline" size={15} color={retailer.websiteUrl ? FateDropColors.secondary : FateDropColors.muted} />
    </View>
    {segment === 'major' ? <View style={styles.infoStrip}><Ionicons name="analytics-outline" size={13} color={FateDropColors.cyan} /><Text style={styles.infoStripText}>RRP/reference is FateDrop's comparison baseline — this retailer can still price above or below it.</Text></View> : null}
    <View style={styles.retailerHealth}>
      <View style={styles.healthText}><View style={[styles.healthDot, { backgroundColor: healthColor }]} /><Text style={[styles.healthLabel, { color: healthColor }]}>{retailer.monitoring.healthy ? 'MONITOR HEALTHY' : retailer.monitoring.stale ? 'MONITOR STALE' : 'MONITOR CHECK'}</Text></View>
      <Text style={styles.healthMeta}>{retailer.monitoring.productsSeen == null ? 'Product count unavailable' : `${retailer.monitoring.productsSeen.toLocaleString()} products seen`} · {relative(retailer.monitoring.lastSuccessAt)}</Text>
    </View>
  </Pressable>;
}

export default function IndiesScreenV2() {
  const [mode, setMode] = useState<Mode>('retailers');
  const [segment, setSegment] = useState<MarketSegment>('major');
  const [presence, setPresence] = useState<Presence>('all');
  const [directory, setDirectory] = useState<NetworkRetailer[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [offerQuery, setOfferQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [retailerId, setRetailerId] = useState<string>();
  const [watched, setWatched] = useState<string[]>([]);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const result = await fetchRetailerDirectory();
      setDirectory(result.retailers.filter((retailer) => isMajor(retailer) || isIndependent(retailer)));
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

  const majorRetailers = useMemo(() => directory.filter(isMajor), [directory]);
  const independentRetailers = useMemo(() => directory.filter(isIndependent), [directory]);
  const segmentRetailers = useMemo(() => {
    const source = segment === 'major' ? majorRetailers : independentRetailers;
    return segment === 'indies' ? source.filter((retailer) => matchesPresence(retailer, presence)) : source;
  }, [independentRetailers, majorRetailers, presence, segment]);

  const shownRetailers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return segmentRetailers;
    return segmentRetailers.filter((retailer) => `${retailer.name} ${retailer.tcgs.join(' ')} ${classLabel(retailer.retailerClass)}`.toLowerCase().includes(term));
  }, [query, segmentRetailers]);

  const selectSegment = useCallback((next: MarketSegment) => {
    setSegment(next);
    setRetailerId(undefined);
    if (next === 'major') setPresence('all');
  }, []);

  const catalogue = useCatalogue({
    query: offerQuery,
    category,
    retailerId,
    inStockOnly: true,
    limit: 50,
  });
  const allowedRetailerIds = useMemo(() => new Set(segmentRetailers.map((retailer) => retailer.id)), [segmentRetailers]);
  const visibleOffers = useMemo(() => catalogue.offers.filter((offer) => allowedRetailerIds.has(offer.retailerId)), [allowedRetailerIds, catalogue.offers]);

  const activeLabel = segment === 'major' ? 'RRP / MAJOR RETAILERS' : presence === 'physical' ? 'INDEPENDENT PHYSICAL STORES' : presence === 'online' ? 'INDEPENDENT ONLINE RETAILERS' : 'INDEPENDENT RETAILERS';
  const heroCopy = segment === 'major'
    ? 'Major and national retailers are kept separate from the independent network. RRP/reference is used to judge value; it is not a promise that these shops sell at RRP.'
    : 'Support independent and specialist retailers without losing stock intelligence. Online and physical presence come from FateDrop retailer evidence rather than being guessed from a website.';

  const header = <>
    <FateDropHeader title="Retailers" subtitle="MAJOR RRP COMPARISON + INDEPENDENT DISCOVERY" />
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.eyebrow}>{activeLabel}</Text>
      <Text style={styles.heroTitle}>{segment === 'major' ? 'Compare the big retailers properly.' : 'Find the independent shops worth knowing.'}</Text>
      <Text style={styles.heroCopy}>{heroCopy}</Text>
      <View style={styles.heroStats}>
        <View><Text style={styles.statValue}>{majorRetailers.length || '—'}</Text><Text style={styles.statLabel}>RRP / MAJOR</Text></View>
        <View><Text style={styles.statValue}>{independentRetailers.length || '—'}</Text><Text style={styles.statLabel}>INDEPENDENTS</Text></View>
        <View><Text style={styles.statValue}>{independentRetailers.filter((item) => item.physicalStores === true).length || '—'}</Text><Text style={styles.statLabel}>PHYSICAL</Text></View>
      </View>
    </View>
    <View style={styles.segmentRow}>{segmentOptions.map((item) => <FilterChip key={item.value} label={item.label} active={segment === item.value} onPress={() => selectSegment(item.value)} />)}</View>
    {segment === 'indies' ? <View style={styles.presenceRow}>{presenceOptions.map((item) => <FilterChip key={item.value} label={item.label} active={presence === item.value} onPress={() => { setPresence(item.value); setRetailerId(undefined); }} />)}</View> : null}
    <View style={styles.modeRow}><FilterChip label="Retailer directory" active={mode === 'retailers'} onPress={() => setMode('retailers')} /><FilterChip label="Live offers" active={mode === 'offers'} onPress={() => setMode('offers')} /></View>
  </>;

  if (mode === 'retailers') {
    return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList
      data={shownRetailers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={directoryLoading} onRefresh={() => void loadDirectory()} tintColor={FateDropColors.violetLight} />}
      ListHeaderComponent={<>{header}<View style={styles.search}><Ionicons name="search" size={17} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder={segment === 'major' ? 'Search major retailers' : 'Search independent retailers'} placeholderTextColor={FateDropColors.muted} style={styles.input} /></View><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{shownRetailers.length} retailers</Text><Text style={styles.sectionMeta}>{activeLabel}</Text></View>{directoryError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><Text style={styles.errorText}>{directoryError}</Text></View> : null}</>}
      ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
      ListEmptyComponent={!directoryLoading && !directoryError ? <View style={styles.empty}><Text style={styles.emptyTitle}>No retailers match</Text><Text style={styles.emptyCopy}>{segment === 'indies' && presence === 'physical' ? 'FateDrop only shows a retailer here when physical presence is explicitly known.' : 'Adjust the retailer filters. FateDrop does not substitute demo retailers into the live directory.'}</Text></View> : null}
      renderItem={({ item }) => <RetailerCard retailer={item} segment={segment} />}
    /></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList
    data={visibleOffers}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<>{header}<View style={styles.search}><Ionicons name="search" size={17} color={FateDropColors.muted} /><TextInput value={offerQuery} onChangeText={setOfferQuery} placeholder={`Search ${segment === 'major' ? 'major' : 'independent'} offers`} placeholderTextColor={FateDropColors.muted} style={styles.input} /></View><FlatList horizontal data={categories} keyExtractor={(item) => item.label} renderItem={({ item }) => <FilterChip label={item.label} active={category === item.value} onPress={() => setCategory(item.value)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} /><FlatList horizontal data={[{ id: undefined, name: segment === 'major' ? 'All major retailers' : 'All independents' }, ...segmentRetailers]} keyExtractor={(item) => item.id || 'all'} renderItem={({ item }) => <FilterChip label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} /><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{visibleOffers.length} loaded offers</Text><Text style={styles.sectionMeta}>IN STOCK</Text></View></>}
    ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
    onEndReached={() => void catalogue.loadMore()}
    onEndReachedThreshold={0.5}
    ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.loading} /> : null}
    ListEmptyComponent={catalogue.loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.loading} /> : <View style={styles.empty}><Text style={styles.emptyTitle}>No matching retailer offers</Text><Text style={styles.emptyCopy}>{catalogue.error || 'No connected offer currently matches these retailer filters.'}</Text></View>}
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
        onOpenProduct={item.productUrl ? () => void openTrackedRetailerLink({ destinationUrl: item.productUrl!, retailerId: item.retailerId, offerId: item.id, placement: 'retailers-v2' }) : undefined}
        inWatchlist={watched.includes(item.id)}
        onToggleWatchlist={() => void toggleWatchlist(item.id, watched).then(setWatched)}
      />;
    }}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(103,232,249,.16)', backgroundColor: 'rgba(9,10,17,.94)', marginBottom: 11 },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -80, top: -95, backgroundColor: 'rgba(103,232,249,.08)' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: FateDropColors.text, fontSize: 25, lineHeight: 28, fontWeight: '900', letterSpacing: -0.65, marginTop: 7, maxWidth: 330 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: FateDropColors.border, marginTop: 15, paddingTop: 12 },
  statValue: { color: FateDropColors.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: .7, marginTop: 2 },
  segmentRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  presenceRow: { flexDirection: 'row', gap: 7, marginBottom: 8, flexWrap: 'wrap' },
  modeRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginBottom: 9 },
  input: { flex: 1, color: FateDropColors.text, fontSize: 12 },
  filters: { gap: 7, paddingBottom: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginVertical: 7 },
  sectionTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900' },
  sectionMeta: { flex: 1, textAlign: 'right', color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  retailerCard: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' },
  retailerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retailerMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}12`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}28` },
  retailerInitials: { color: FateDropColors.violetLight, fontSize: 11, fontWeight: '900' },
  retailerCopy: { flex: 1 },
  retailerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  retailerName: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' },
  retailerClass: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '800', letterSpacing: .7, marginTop: 3 },
  presence: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '800', letterSpacing: .55, marginTop: 4 },
  infoStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 12, padding: 10, borderRadius: 11, backgroundColor: 'rgba(103,232,249,.045)', borderWidth: 1, borderColor: 'rgba(103,232,249,.1)' },
  infoStripText: { flex: 1, color: FateDropColors.secondary, fontSize: 8, lineHeight: 12 },
  retailerHealth: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: FateDropColors.border },
  healthText: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthDot: { width: 6, height: 6, borderRadius: 3 },
  healthLabel: { fontSize: 7, fontWeight: '900', letterSpacing: .75 },
  healthMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 4 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.amber}33`, padding: 12, marginBottom: 10 },
  errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 10 },
  empty: { paddingVertical: 42, alignItems: 'center' },
  emptyTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', maxWidth: 300, marginTop: 6 },
  loading: { marginVertical: 28 },
  pressed: { opacity: .76 },
});
