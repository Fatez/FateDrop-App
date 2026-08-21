import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
import { useNetworkRetailers } from '@/hooks/use-network-retailers';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { LocalWishlistRepository } from '@/services/wishlist';
import type { ProductCategory, ProductOffer } from '@/types/domain';

const categories: { label: string; value?: ProductCategory }[] = [
  { label: 'All' },
  { label: 'Sealed', value: 'SEALED' },
  { label: 'Singles', value: 'SINGLE' },
  { label: 'Graded', value: 'GRADED' },
  { label: 'Accessories', value: 'ACCESSORY' },
  { label: 'Preorders', value: 'PREORDER' },
];

const wishlist = new LocalWishlistRepository();
const normalise = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const deliveryFor = (offer: ProductOffer) => offer.shippingOptions.find((option) => !option.collection)?.priceGbp;
const deliveredFor = (offer: ProductOffer) => {
  const delivery = deliveryFor(offer);
  return offer.priceGbp !== undefined && delivery !== undefined ? offer.priceGbp + delivery : undefined;
};

type ProductGroup = {
  id: string;
  title: string;
  category: ProductCategory;
  imageUrl?: string;
  offers: ProductOffer[];
};

function groupOffers(offers: ProductOffer[]): ProductGroup[] {
  const grouped = new Map<string, ProductGroup>();
  for (const offer of offers) {
    const id = offer.canonicalProductId || `title:${offer.category}:${normalise(offer.title)}`;
    const existing = grouped.get(id);
    if (existing) existing.offers.push(offer);
    else grouped.set(id, { id, title: offer.title, category: offer.category, imageUrl: offer.imageUrl, offers: [offer] });
  }
  return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [retailerId, setRetailerId] = useState<string>();
  const [inStock, setInStock] = useState(true);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    void wishlist.list().then((items) => setSavedProducts(items.filter((item) => item.targetType === 'PRODUCT').map((item) => item.targetId)));
  }, []));

  const retailerOptions = useNetworkRetailers();
  const retailerNames = useMemo(() => new Map(retailerOptions.map((item) => [item.id, item.name])), [retailerOptions]);
  const catalogue = useCatalogue({ query, category, retailerId, inStockOnly: inStock, limit: 50 });
  const groups = useMemo(() => groupOffers(catalogue.offers), [catalogue.offers]);

  const toggleProduct = async (group: ProductGroup) => {
    const storageId = `product:${group.id}`;
    if (savedProducts.includes(group.id)) {
      await wishlist.remove(storageId);
      setSavedProducts((current) => current.filter((id) => id !== group.id));
    } else {
      await wishlist.save({ id: storageId, targetType: 'PRODUCT', targetId: group.id, label: group.title, alertsEnabled: true, createdAt: new Date().toISOString() });
      setSavedProducts((current) => [...current, group.id]);
    }
  };

  const header = <>
    <FateDropHeader
      title="Search"
      rightAction={<Pressable accessibilityLabel="Open True Price" onPress={() => router.push('/true-price')}><Ionicons name="pricetags" size={19} color={FateDropColors.cyan} /></Pressable>}
    />
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={FateDropColors.muted} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Search products or SKU" placeholderTextColor={FateDropColors.muted} style={styles.input} />
    </View>
    <Text style={styles.networkNote}>Search → product → retailer offers → buy direct. Major retailers and participating independents share one network search.</Text>
    <FlatList horizontal data={categories} keyExtractor={(item) => item.label} renderItem={({ item }) => <FilterChip label={item.label} active={category === item.value} onPress={() => setCategory(item.value)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
    <FlatList horizontal data={[{ id: undefined, name: 'All retailers' }, ...retailerOptions]} keyExtractor={(item) => item.id || 'all'} renderItem={({ item }) => <FilterChip label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
    <View style={styles.controls}>
      <FilterChip label="In stock only" active={inStock} onPress={() => setInStock((value) => !value)} />
      <StatusBadge label={`${catalogue.total.toLocaleString()} network offers`} color={FateDropColors.mint} />
    </View>
    {groups.length ? <Text style={styles.loadedNote}>{groups.length} product group{groups.length === 1 ? '' : 's'} in the currently loaded results</Text> : null}
  </>;

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onEndReached={() => void catalogue.loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : null}
        ListEmptyComponent={catalogue.loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : <Text style={styles.state}>{catalogue.error || 'No products match these filters.'}</Text>}
        renderItem={({ item }) => <ProductGroupCard group={item} retailerNames={retailerNames} saved={savedProducts.includes(item.id)} onToggle={() => void toggleProduct(item)} />}
      />
    </SafeAreaView>
  );
}

function ProductGroupCard({ group, retailerNames, saved, onToggle }: { group: ProductGroup; retailerNames: ReadonlyMap<string, string>; saved: boolean; onToggle: () => void }) {
  const retailerCount = new Set(group.offers.map((offer) => offer.retailerId)).size;
  const itemPrices = group.offers.map((offer) => offer.priceGbp).filter((value): value is number => value !== undefined);
  const delivered = group.offers.map(deliveredFor).filter((value): value is number => value !== undefined);
  const lowestItem = itemPrices.length ? Math.min(...itemPrices) : undefined;
  const lowestDelivered = delivered.length ? Math.min(...delivered) : undefined;

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={styles.groupCopy}>
          <Text style={styles.category}>{group.category}</Text>
          <Text style={styles.title}>{group.title}</Text>
          <Text style={styles.meta}>{retailerCount} retailer{retailerCount === 1 ? '' : 's'} · {group.offers.length} loaded offer{group.offers.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable accessibilityLabel={saved ? 'Remove product from Wishlist' : 'Save product to Wishlist'} onPress={onToggle} style={[styles.save, saved && styles.saveActive]}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? FateDropColors.violetLight : FateDropColors.text} />
        </Pressable>
      </View>

      <View style={styles.priceSummary}>
        <View><Text style={styles.priceLabel}>LOWEST ITEM</Text><Text style={styles.priceValue}>{lowestItem === undefined ? '—' : `£${lowestItem.toFixed(2)}`}</Text></View>
        <View><Text style={styles.priceLabel}>LOWEST KNOWN TRUE PRICE</Text><Text style={styles.truePrice}>{lowestDelivered === undefined ? 'Delivery unknown' : `£${lowestDelivered.toFixed(2)}`}</Text></View>
      </View>

      <View style={styles.offerList}>
        {group.offers.map((offer) => {
          const retailerName = retailerNames.get(offer.retailerId) || offer.retailerId;
          const delivery = deliveryFor(offer);
          const truePrice = deliveredFor(offer);
          return (
            <View key={offer.id} style={styles.offer}>
              <View style={styles.offerCopy}>
                <Text style={styles.retailer}>{retailerName}</Text>
                <Text style={styles.offerPrice}>{offer.priceGbp === undefined ? 'Item price unavailable' : `£${offer.priceGbp.toFixed(2)} item`} · {delivery === undefined ? 'delivery unknown' : `£${delivery.toFixed(2)} delivery`}</Text>
                <Text style={styles.offerTotal}>{truePrice === undefined ? 'True Price unavailable' : `True Price £${truePrice.toFixed(2)}`}</Text>
              </View>
              {offer.productUrl ? <Pressable accessibilityLabel={`Buy at ${retailerName}`} onPress={() => void openTrackedRetailerLink({ destinationUrl: offer.productUrl!, retailerId: offer.retailerId, offerId: offer.id, placement: 'retail-search' })} style={styles.buy}><Ionicons name="open-outline" size={15} color={FateDropColors.text} /></Pressable> : null}
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => router.push({ pathname: '/true-price', params: { query: group.title } })} style={styles.secondaryAction}><Ionicons name="pricetags" size={14} color={FateDropColors.cyan} /><Text style={styles.secondaryText}>Compare True Price & RRP</Text></Pressable>
        <Pressable onPress={() => router.push({ pathname: '/fatefind', params: { query: group.title } })} style={styles.secondaryAction}><Ionicons name="telescope" size={14} color={FateDropColors.violetLight} /><Text style={styles.secondaryText}>Create FateFind</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 7 },
  input: { flex: 1, color: FateDropColors.text },
  networkNote: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginBottom: 11, marginLeft: 3 },
  filters: { gap: 8, paddingBottom: 12 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  loadedNote: { color: FateDropColors.muted, fontSize: 8, marginBottom: 13 },
  state: { color: FateDropColors.muted, textAlign: 'center', margin: 35 },
  group: { padding: 15, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  groupCopy: { flex: 1 },
  category: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', lineHeight: 21, marginTop: 3 },
  meta: { color: FateDropColors.muted, fontSize: 9, marginTop: 5 },
  save: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: FateDropColors.cardElevated, borderWidth: 1, borderColor: FateDropColors.border },
  saveActive: { borderColor: `${FateDropColors.violetLight}55`, backgroundColor: `${FateDropColors.violetLight}12` },
  priceSummary: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 13, marginTop: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FateDropColors.border },
  priceLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  priceValue: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 4 },
  truePrice: { color: FateDropColors.cyan, fontSize: 15, fontWeight: '900', marginTop: 4, textAlign: 'right' },
  offerList: { gap: 0 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: FateDropColors.border },
  offerCopy: { flex: 1 },
  retailer: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  offerPrice: { color: FateDropColors.secondary, fontSize: 9, marginTop: 3 },
  offerTotal: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '800', marginTop: 3 },
  buy: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.violet },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryAction: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated },
  secondaryText: { color: FateDropColors.text, fontSize: 8, fontWeight: '900', textAlign: 'center' },
});