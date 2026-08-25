import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader, FilterChip } from '@/components/fatedrop-ui';
import { retailers } from '@/constants/retailers';
import { FateDropColors } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
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
  offers: ProductOffer[];
};

function groupOffers(offers: ProductOffer[]): ProductGroup[] {
  const grouped = new Map<string, ProductGroup>();
  for (const offer of offers) {
    const id = offer.canonicalProductId || `title:${offer.category}:${normalise(offer.title)}`;
    const current = grouped.get(id);
    if (current) current.offers.push(offer);
    else grouped.set(id, { id, title: offer.title, category: offer.category, offers: [offer] });
  }
  return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function ProductResult({ group, saved, onToggle }: { group: ProductGroup; saved: boolean; onToggle: () => void }) {
  const retailerCount = new Set(group.offers.map((offer) => offer.retailerId)).size;
  const itemPrices = group.offers.map((offer) => offer.priceGbp).filter((value): value is number => value !== undefined);
  const truePrices = group.offers.map(deliveredFor).filter((value): value is number => value !== undefined);
  const lowestItem = itemPrices.length ? Math.min(...itemPrices) : undefined;
  const lowestTrue = truePrices.length ? Math.min(...truePrices) : undefined;
  const sortedOffers = [...group.offers].sort((a, b) => (deliveredFor(a) ?? a.priceGbp ?? Number.MAX_SAFE_INTEGER) - (deliveredFor(b) ?? b.priceGbp ?? Number.MAX_SAFE_INTEGER));

  return <View style={styles.productCard}>
    <View style={styles.productHead}>
      <View style={styles.productIdentity}>
        <Text style={styles.category}>{group.category}</Text>
        <Text style={styles.productTitle}>{group.title}</Text>
        <Text style={styles.productMeta}>{retailerCount} retailer{retailerCount === 1 ? '' : 's'} · {group.offers.length} offer{group.offers.length === 1 ? '' : 's'} loaded</Text>
      </View>
      <Pressable onPress={onToggle} accessibilityLabel={saved ? 'Remove from Wishlist' : 'Save to Wishlist'} style={[styles.save, saved && styles.saveActive]}>
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? FateDropColors.violetLight : FateDropColors.text} />
      </Pressable>
    </View>

    <View style={styles.valueBand}>
      <View><Text style={styles.valueLabel}>LOWEST ITEM</Text><Text style={styles.value}>{lowestItem === undefined ? '—' : `£${lowestItem.toFixed(2)}`}</Text></View>
      <View style={styles.valueDivider} />
      <View><Text style={styles.valueLabel}>LOWEST TRUE PRICE</Text><Text style={styles.trueValue}>{lowestTrue === undefined ? 'Delivery unknown' : `£${lowestTrue.toFixed(2)}`}</Text></View>
    </View>

    <View style={styles.offerList}>{sortedOffers.slice(0, 4).map((offer, index) => {
      const store = retailers.find((item) => item.id === offer.retailerId);
      const delivery = deliveryFor(offer);
      const truePrice = deliveredFor(offer);
      return <View key={offer.id} style={styles.offerRow}>
        <View style={[styles.rank, index === 0 && styles.rankBest]}><Text style={[styles.rankText, index === 0 && styles.rankTextBest]}>{index + 1}</Text></View>
        <View style={styles.offerCopy}>
          <Text style={styles.retailer}>{store?.name || offer.retailerId}</Text>
          <Text style={styles.offerDetail}>{offer.priceGbp === undefined ? 'Item price unavailable' : `£${offer.priceGbp.toFixed(2)} item`} · {delivery === undefined ? 'delivery unknown' : `£${delivery.toFixed(2)} delivery`}</Text>
        </View>
        <View style={styles.offerRight}>
          <Text style={styles.offerTotal}>{truePrice === undefined ? '—' : `£${truePrice.toFixed(2)}`}</Text>
          <Text style={styles.offerTotalLabel}>{truePrice === undefined ? 'TRUE PRICE N/A' : 'TRUE PRICE'}</Text>
        </View>
        {offer.productUrl ? <Pressable onPress={() => void openTrackedRetailerLink({ destinationUrl: offer.productUrl!, retailerId: offer.retailerId, offerId: offer.id, placement: 'retail-search-v2' })} style={styles.open}><Ionicons name="open-outline" size={14} color={FateDropColors.text} /></Pressable> : null}
      </View>;
    })}</View>

    <View style={styles.productActions}>
      <Pressable onPress={() => router.push({ pathname: '/fatefind', params: { query: group.title } })} style={styles.secondary}><Ionicons name="telescope-outline" size={14} color={FateDropColors.goldBright} /><Text style={styles.secondaryText}>RUN FATEFIND</Text></Pressable>
      <Pressable onPress={() => router.push({ pathname: '/fate-match', params: { query: group.title } })} style={styles.secondary}><Ionicons name="radio-outline" size={14} color={FateDropColors.gold} /><Text style={styles.secondaryText}>WATCH WITH FATEMATCH</Text></Pressable>
    </View>
  </View>;
}

export default function SearchScreenV2() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [retailerId, setRetailerId] = useState<string>();
  const [inStock, setInStock] = useState(true);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    void wishlist.list().then((items) => setSavedProducts(items.filter((item) => item.targetType === 'PRODUCT').map((item) => item.targetId)));
  }, []));

  const retailerOptions = retailers.filter((item) => !item.isDemo);
  const catalogue = useCatalogue({ query, category, retailerId, inStockOnly: inStock, limit: 50 });
  const groups = useMemo(() => groupOffers(catalogue.offers), [catalogue.offers]);

  const toggleProduct = async (group: ProductGroup) => {
    const storageId = `product:${group.id}`;
    if (savedProducts.includes(group.id)) {
      await wishlist.remove(storageId);
      setSavedProducts((current) => current.filter((id) => id !== group.id));
      return;
    }
    await wishlist.save({ id: storageId, targetType: 'PRODUCT', targetId: group.id, label: group.title, alertsEnabled: true, createdAt: new Date().toISOString() });
    setSavedProducts((current) => [...current, group.id]);
  };

  const header = <>
    <FateDropHeader title="Search" subtitle="DISCOVER · STOCK · LIVE OFFERS" rightAction={<Pressable onPress={() => router.push('/fatefind')} style={styles.headerButton}><Ionicons name="telescope-outline" size={18} color={FateDropColors.goldBright} /></Pressable>} />
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>FATEDROP NETWORK SEARCH</Text>
      <Text style={styles.heroTitle}>Find the product. Then find the fairest route to it.</Text>
      <Text style={styles.heroCopy}>Search connected retailer evidence first, then compare item price, known delivery and RRP without pretending missing costs are free.</Text>
    </View>
    <View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Product, set, SKU…" placeholderTextColor={FateDropColors.muted} style={styles.input} autoCapitalize="none" /></View>
    <FlatList horizontal data={categories} keyExtractor={(item) => item.label} renderItem={({ item }) => <FilterChip label={item.label} active={category === item.value} onPress={() => setCategory(item.value)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
    <FlatList horizontal data={[{ id: undefined, name: 'All retailers' }, ...retailerOptions]} keyExtractor={(item) => item.id || 'all'} renderItem={({ item }) => <FilterChip label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />} contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} />
    <View style={styles.resultHeader}><Pressable onPress={() => setInStock((value) => !value)} style={[styles.stockToggle, inStock && styles.stockToggleActive]}><View style={[styles.stockDot, inStock && styles.stockDotActive]} /><Text style={[styles.stockText, inStock && styles.stockTextActive]}>{inStock ? 'IN STOCK ONLY' : 'ALL STOCK STATES'}</Text></Pressable><View><Text style={styles.resultValue}>{catalogue.total.toLocaleString()}</Text><Text style={styles.resultLabel}>NETWORK OFFERS</Text></View></View>
    <View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>PRODUCT GROUPS</Text><Text style={styles.sectionTitle}>{groups.length ? `${groups.length} loaded results` : 'Search results'}</Text></View></View>
  </>;

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList data={groups} keyExtractor={(item) => item.id} ListHeaderComponent={header} contentContainerStyle={styles.content} ItemSeparatorComponent={() => <View style={{ height: 11 }} />} onEndReached={() => void catalogue.loadMore()} onEndReachedThreshold={0.5} ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : null} ListEmptyComponent={catalogue.loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : <View style={styles.empty}><Ionicons name="search-outline" size={22} color={FateDropColors.secondary} /><Text style={styles.emptyTitle}>No products match</Text><Text style={styles.emptyCopy}>{catalogue.error || 'Adjust the product, retailer or stock filters.'}</Text></View>} renderItem={({ item }) => <ProductResult group={item} saved={savedProducts.includes(item.id)} onToggle={() => void toggleProduct(item)} />} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 120 },
  headerButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  hero: { padding: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(103,232,249,.16)', backgroundColor: 'rgba(9,10,17,.92)', marginBottom: 11 }, heroEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 }, heroTitle: { color: FateDropColors.text, fontSize: 24, lineHeight: 27, fontWeight: '900', letterSpacing: -0.6, marginTop: 7 }, heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, height: 49, borderRadius: 16, backgroundColor: 'rgba(17,19,29,.92)', borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 10 }, input: { flex: 1, color: FateDropColors.text, fontSize: 13 }, filters: { gap: 7, paddingBottom: 9 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3, marginBottom: 20 }, stockToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, stockToggleActive: { borderColor: `${FateDropColors.mint}45`, backgroundColor: `${FateDropColors.mint}0D` }, stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.muted }, stockDotActive: { backgroundColor: FateDropColors.mint }, stockText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, stockTextActive: { color: FateDropColors.mint }, resultValue: { color: FateDropColors.text, fontSize: 17, fontWeight: '900', textAlign: 'right' }, resultLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  sectionHead: { marginBottom: 9 }, sectionEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, sectionTitle: { color: FateDropColors.text, fontSize: 19, fontWeight: '900', marginTop: 3 },
  productCard: { padding: 15, borderRadius: 19, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' }, productHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, productIdentity: { flex: 1 }, category: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: 1 }, productTitle: { color: FateDropColors.text, fontSize: 15, lineHeight: 19, fontWeight: '900', marginTop: 3 }, productMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 4 }, save: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, saveActive: { borderColor: `${FateDropColors.violetLight}55`, backgroundColor: `${FateDropColors.violetLight}12` },
  valueBand: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FateDropColors.border }, valueDivider: { width: 1, height: 32, backgroundColor: FateDropColors.border, marginHorizontal: 20 }, valueLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, value: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 3 }, trueValue: { color: FateDropColors.cyan, fontSize: 16, fontWeight: '900', marginTop: 3 },
  offerList: { marginTop: 2 }, offerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 57, borderBottomWidth: 1, borderBottomColor: FateDropColors.border }, rank: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.cardElevated }, rankBest: { backgroundColor: `${FateDropColors.mint}14` }, rankText: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900' }, rankTextBest: { color: FateDropColors.mint }, offerCopy: { flex: 1 }, retailer: { color: FateDropColors.text, fontSize: 10, fontWeight: '900' }, offerDetail: { color: FateDropColors.secondary, fontSize: 8, marginTop: 3 }, offerRight: { alignItems: 'flex-end' }, offerTotal: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' }, offerTotalLabel: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', marginTop: 2 }, open: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.violet },
  productActions: { flexDirection: 'row', gap: 7, marginTop: 12 }, secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 41, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, secondaryText: { color: FateDropColors.text, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  state: { margin: 35 }, empty: { alignItems: 'center', padding: 28, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, emptyTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900', marginTop: 8 }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9, marginTop: 4, textAlign: 'center' },
});
