import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader, FilterChip, ProductCard, StatusBadge } from '@/components/fatedrop-ui';
import { retailers } from '@/constants/retailers';
import { FateDropColors } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
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

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [retailerId, setRetailerId] = useState<string>();
  const [inStock, setInStock] = useState(true);
  const [watched, setWatched] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    void loadWatchlist().then(setWatched);
  }, []));

  const retailerOptions = retailers.filter((item) => !item.isDemo);
  const catalogue = useCatalogue({
    query,
    category,
    retailerId,
    inStockOnly: inStock,
    limit: 50,
  });

  const header = <>
    <FateDropHeader
      title="Search"
      rightAction={
        <Pressable accessibilityLabel="Open True Price" onPress={() => router.push('/true-price')}>
          <Ionicons name="pricetags" size={19} color={FateDropColors.cyan} />
        </Pressable>
      }
    />
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={FateDropColors.muted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search products or SKU"
        placeholderTextColor={FateDropColors.muted}
        style={styles.input}
      />
    </View>
    <Text style={styles.networkNote}>Connected network · major retailers + participating independents</Text>
    <FlatList
      horizontal
      data={categories}
      keyExtractor={(item) => item.label}
      renderItem={({ item }) => <FilterChip label={item.label} active={category === item.value} onPress={() => setCategory(item.value)} />}
      contentContainerStyle={styles.filters}
      showsHorizontalScrollIndicator={false}
    />
    <FlatList
      horizontal
      data={[{ id: undefined, name: 'All retailers' }, ...retailerOptions]}
      keyExtractor={(item) => item.id || 'all'}
      renderItem={({ item }) => <FilterChip label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />}
      contentContainerStyle={styles.filters}
      showsHorizontalScrollIndicator={false}
    />
    <View style={styles.controls}>
      <FilterChip label="In stock only" active={inStock} onPress={() => setInStock((value) => !value)} />
      <StatusBadge label={`${catalogue.total.toLocaleString()} offers`} color={FateDropColors.mint} />
    </View>
  </>;

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <FlatList
        data={catalogue.offers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        onEndReached={() => void catalogue.loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : null}
        ListEmptyComponent={catalogue.loading
          ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} />
          : <Text style={styles.state}>{catalogue.error || 'No products match these filters.'}</Text>}
        renderItem={({ item }) => {
          const retailer = retailers.find((value) => value.id === item.retailerId);
          const available = item.stockStatus === 'IN_STOCK';
          return (
            <ProductCard
              title={item.title}
              retailer={retailer?.name || item.retailerId}
              price={item.priceGbp === undefined ? 'Price unavailable' : `£${item.priceGbp.toFixed(2)}`}
              stockLabel={available ? 'In stock' : item.stockStatus.replaceAll('_', ' ')}
              stockTone={available ? 'mint' : 'red'}
              fateLabel={item.pulseLabels?.[0]?.replaceAll('_', ' ')}
              fateTone={item.pulseLabels?.includes('PRICE_DROPPED') ? 'mint' : 'violet'}
              imageSource={item.imageUrl ? { uri: item.imageUrl } : undefined}
              productUrl={available ? item.productUrl : undefined}
              onOpenProduct={available && item.productUrl ? () => void openTrackedRetailerLink({
                destinationUrl: item.productUrl!,
                retailerId: item.retailerId,
                offerId: item.id,
                placement: 'retail-search',
              }) : undefined}
              inWatchlist={watched.includes(item.id)}
              onToggleWatchlist={() => void toggleWatchlist(item.id, watched).then(setWatched)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: FateDropColors.glass,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    marginBottom: 7,
  },
  input: { flex: 1, color: FateDropColors.text },
  networkNote: { color: FateDropColors.muted, fontSize: 9, marginBottom: 11, marginLeft: 3 },
  filters: { gap: 8, paddingBottom: 12 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  state: { color: FateDropColors.muted, textAlign: 'center', margin: 35 },
});
