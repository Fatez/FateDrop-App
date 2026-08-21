import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FateDropHeader, FilterChip, ProductCard, StatusBadge } from '@/components/fatedrop-ui';
import { RetailerCard } from '@/components/retailer-card';
import { nationalRetailerKeys } from '@/constants/retailer-groups';
import { retailers } from '@/constants/retailers';
import { FateDropColors } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
import { useNetworkRetailers } from '@/hooks/use-network-retailers';
import { loadWatchlist, toggleWatchlist } from '@/lib/watchlist';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import type { ProductCategory } from '@/types/domain';

const categories: { label: string; value?: ProductCategory }[] = [
  { label: 'All' },
  { label: 'Sealed', value: 'SEALED' },
  { label: 'Singles', value: 'SINGLE' },
  { label: 'Graded', value: 'GRADED' },
  { label: 'Accessories', value: 'ACCESSORY' },
  { label: 'Preorders', value: 'PREORDER' },
];

type DirectoryFilter = 'all' | 'online' | 'physical' | 'verified' | 'collection';
type CatalogueSort = 'title' | 'price';

export default function IndiesScreen() {
  const [mode, setMode] = useState<'directory' | 'catalogue'>('directory');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [minimumPrice, setMinimumPrice] = useState('');
  const [maximumPrice, setMaximumPrice] = useState('');
  const [sort, setSort] = useState<CatalogueSort>('title');
  const [retailerId, setRetailerId] = useState<string>();
  const [watched, setWatched] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    void loadWatchlist().then(setWatched);
  }, []));

  const liveRetailers = useNetworkRetailers();
  const directoryNetworkRetailers = useMemo(() => retailers.filter((item) => item.id !== 'pokemon-center-uk' && !item.isDemo), []);
  const connectedRetailers = useMemo(() => liveRetailers.filter((item) => !nationalRetailerKeys.has(item.id)), [liveRetailers]);
  const connectedRetailerNames = useMemo(() => new Map(connectedRetailers.map((item) => [item.id, item.name])), [connectedRetailers]);
  const directoryRetailers = useMemo(() => directoryNetworkRetailers.filter((item) => {
    const term = directoryQuery.trim().toLowerCase();
    const location = item.locations.map((value) => `${value.townCity || ''} ${value.postcode || ''}`).join(' ').toLowerCase();
    if (term && !item.name.toLowerCase().includes(term) && !location.includes(term)) return false;
    if (directoryFilter === 'online') return item.onlineOnly;
    if (directoryFilter === 'physical') return !item.onlineOnly;
    if (directoryFilter === 'verified') return item.verification.status === 'VERIFIED';
    if (directoryFilter === 'collection') return item.locations.some((value) => value.collectionAvailable);
    return true;
  }), [directoryFilter, directoryNetworkRetailers, directoryQuery]);

  const catalogue = useCatalogue({
    query,
    category,
    minimumPriceGbp: minimumPrice ? Number(minimumPrice) : undefined,
    maximumPriceGbp: maximumPrice ? Number(maximumPrice) : undefined,
    sort,
    retailerId,
    excludedRetailerIds: [...nationalRetailerKeys],
    inStockOnly: true,
    limit: 50,
  });

  const commonHeader = <>
    <FateDropHeader title="Indies" rightAction={<StatusBadge label={mode === 'directory' ? `${directoryNetworkRetailers.length} listed` : `${connectedRetailers.length} connected`} color={FateDropColors.cyan} />} />
    <AbstractHero eyebrow="Independent network" title="Find the shop behind the stock." subtitle="Discover independent TCG retailers, browse connected offers and continue directly to the retailer to buy." icon="storefront" />
    <View style={styles.mode}>
      <FilterChip label="Retailers" active={mode === 'directory'} onPress={() => setMode('directory')} />
      <FilterChip label="Connected offers" active={mode === 'catalogue'} onPress={() => setMode('catalogue')} />
    </View>
  </>;

  if (mode === 'directory') {
    return (
      <SafeAreaView style={styles.safe}>
        <FateDropBackground />
        <FlatList
          data={directoryRetailers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={<>
            {commonHeader}
            <View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput value={directoryQuery} onChangeText={setDirectoryQuery} placeholder="Search name, town or postcode" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View>
            <FlatList horizontal data={['all', 'online', 'physical', 'verified', 'collection'] as DirectoryFilter[]} keyExtractor={(item) => item} renderItem={({ item }) => <FilterChip label={item === 'all' ? 'All' : item === 'online' ? 'Online only' : item === 'physical' ? 'Physical shops' : item === 'verified' ? 'Verified' : 'Collection'} active={directoryFilter === item} onPress={() => setDirectoryFilter(item)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
            <Text style={styles.resultCount}>{directoryRetailers.length} matching retailers</Text>
          </>}
          ListEmptyComponent={<Text style={styles.state}>No retailers match these filters.</Text>}
          renderItem={({ item }) => <RetailerCard retailer={item} />}
        />
      </SafeAreaView>
    );
  }

  const catalogueHeader = <>
    {commonHeader}
    <View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search connected indie offers" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View>
    <FlatList horizontal data={categories} keyExtractor={(item) => item.label} renderItem={({ item }) => <FilterChip label={item.label} active={category === item.value} onPress={() => setCategory(item.value)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
    <FlatList horizontal data={[{ id: undefined, name: 'All retailers' }, ...connectedRetailers]} keyExtractor={(item) => item.id || 'all'} renderItem={({ item }) => <FilterChip label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
    <Text style={styles.filterLabel}>Price</Text>
    <View style={styles.range}>
      <TextInput value={minimumPrice} onChangeText={setMinimumPrice} keyboardType="decimal-pad" placeholder="Min £" placeholderTextColor={FateDropColors.muted} style={styles.rangeInput} />
      <TextInput value={maximumPrice} onChangeText={setMaximumPrice} keyboardType="decimal-pad" placeholder="Max £" placeholderTextColor={FateDropColors.muted} style={styles.rangeInput} />
    </View>
    <Text style={styles.filterLabel}>Sort</Text>
    <View style={styles.chips}>
      <FilterChip label="Title" active={sort === 'title'} onPress={() => setSort('title')} />
      <FilterChip label="Item price" active={sort === 'price'} onPress={() => setSort('price')} />
    </View>
    <Text style={styles.cloudNote}>Connected offers are sourced from the live Signal Engine. National-chain retailers are kept in Search so the Indies view stays focused on specialist and independent stock.</Text>
    <View style={styles.summary}><Text style={styles.resultCount}>{catalogue.total.toLocaleString()} matching offers</Text><Text style={styles.note}>In-stock only</Text></View>
  </>;

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <FlatList
        data={catalogue.offers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={catalogueHeader}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        onEndReached={() => void catalogue.loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : null}
        ListEmptyComponent={catalogue.loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : <Text style={styles.state}>{catalogue.error || 'No matching connected indie offers.'}</Text>}
        renderItem={({ item }) => {
          const store = retailers.find((value) => value.id === item.retailerId);
          const retailerName = connectedRetailerNames.get(item.retailerId) || store?.name || item.retailerId;
          const shipping = item.shippingOptions.find((option) => !option.collection)?.priceGbp;
          const details = [item.condition.replaceAll('_', ' '), shipping === undefined ? 'Delivery unknown' : `Delivery £${shipping.toFixed(2)}`].filter(Boolean).join(' · ');
          return <ProductCard title={item.title} retailer={retailerName} details={details} price={item.priceGbp === undefined ? 'Price unavailable' : `£${item.priceGbp.toFixed(2)}`} stockLabel={item.preorder ? 'Preorder' : 'In stock'} stockTone="mint" fateLabel={item.pulseLabels?.[0]?.replaceAll('_', ' ')} fateTone={item.pulseLabels?.includes('PRICE_DROPPED') ? 'mint' : 'violet'} imageSource={item.imageUrl ? { uri: item.imageUrl } : undefined} productUrl={item.productUrl} onOpenProduct={item.productUrl ? () => void openTrackedRetailerLink({ destinationUrl: item.productUrl!, retailerId: item.retailerId, offerId: item.id, placement: 'indies-catalogue' }) : undefined} inWatchlist={watched.includes(item.id)} onToggleWatchlist={() => void toggleWatchlist(item.id, watched).then(setWatched)} />;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  mode: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 },
  input: { flex: 1, color: FateDropColors.text },
  filters: { gap: 8, paddingBottom: 12 },
  filterLabel: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  range: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  rangeInput: { flex: 1, color: FateDropColors.text, padding: 10, borderRadius: 12, backgroundColor: FateDropColors.cardElevated },
  cloudNote: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginBottom: 10 },
  resultCount: { color: FateDropColors.text, fontWeight: '800', marginBottom: 13 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: { color: FateDropColors.muted, fontSize: 10, marginBottom: 13 },
  state: { color: FateDropColors.muted, textAlign: 'center', margin: 35 },
});