import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { ApiCatalogueRepository } from '@/services/catalogue';
import { fetchRetailerDirectory, type NetworkRetailer } from '@/services/retailer-directory';
import type { ProductOffer } from '@/types/domain';

type RetailerResult = {
  retailer: NetworkRetailer;
  matchingOffers: ProductOffer[];
};

const catalogueRepository = new ApiCatalogueRepository();
const MAX_STOCK_SEARCH_PAGES = 5;

function hasRetailerStorefront(retailer: NetworkRetailer) {
  return retailer.retailerClass !== 'event_vendor';
}

function classLabel(value: string) {
  if (value === 'national') return 'Major retailer';
  if (value === 'independent') return 'Independent retailer';
  if (value === 'specialist') return 'TCG specialist';
  if (value === 'regional') return 'Regional retailer';
  return value.replaceAll('_', ' ');
}

function presenceLabel(retailer: NetworkRetailer) {
  if (retailer.online && retailer.physicalStores === true) {
    return retailer.physicalLocations && retailer.physicalLocations > 0
      ? `Online · ${retailer.physicalLocations} physical location${retailer.physicalLocations === 1 ? '' : 's'}`
      : 'Online · Physical stores';
  }
  if (retailer.physicalStores === true) return 'Physical stores';
  if (retailer.online && retailer.physicalStores === false) return 'Online';
  if (retailer.online) return 'Online · Physical status unknown';
  return 'Retail presence unknown';
}

function retailerSearchText(retailer: NetworkRetailer) {
  return `${retailer.name} ${retailer.tcgs.join(' ')} ${classLabel(retailer.retailerClass)}`.toLowerCase();
}

function strictInStock(offer: ProductOffer) {
  return offer.stockStatus === 'IN_STOCK' && !offer.preorder;
}

function priceLabel(offer: ProductOffer) {
  return offer.priceGbp === undefined ? 'Price unavailable' : `£${offer.priceGbp.toFixed(2)}`;
}

function RetailerCard({ result, searchTerm }: { result: RetailerResult; searchTerm: string }) {
  const { retailer, matchingOffers } = result;
  const shownOffers = matchingOffers.slice(0, 2);
  const openStorefront = () => router.push({
    pathname: '/retailers/[id]',
    params: matchingOffers.length > 0 ? { id: retailer.id, q: searchTerm } : { id: retailer.id },
  });

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Open ${retailer.name} retailer storefront`}
    onPress={openStorefront}
    style={({ pressed }) => [styles.retailerCard, pressed && styles.pressed]}
  >
    <View style={styles.retailerTop}>
      <View style={styles.retailerMark}>
        <Text style={styles.retailerInitials}>{retailer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text>
      </View>
      <View style={styles.retailerCopy}>
        <View style={styles.retailerNameRow}>
          <Text style={styles.retailerName}>{retailer.name}</Text>
          {String(retailer.verification || '').toLowerCase() === 'verified' ? <Ionicons name="checkmark-circle" size={15} color={FateDropColors.mint} /> : null}
        </View>
        <Text style={styles.retailerClass}>{classLabel(retailer.retailerClass).toUpperCase()}</Text>
        <Text style={styles.presence}>{presenceLabel(retailer)}</Text>
        {retailer.tcgs.length ? <Text style={styles.tcgs}>{retailer.tcgs.map((tcg) => tcg.toUpperCase()).join(' · ')}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.secondary} />
    </View>

    {matchingOffers.length > 0 ? <View style={styles.stockBlock}>
      <View style={styles.stockHead}>
        <Ionicons name="checkmark-circle-outline" size={15} color={FateDropColors.mint} />
        <Text style={styles.stockHeadText}>{matchingOffers.length} MATCHING IN-STOCK {matchingOffers.length === 1 ? 'PRODUCT' : 'PRODUCTS'}</Text>
      </View>
      {shownOffers.map((offer) => <View key={offer.id} style={styles.offerRow}>
        <Text style={styles.offerTitle} numberOfLines={2}>{offer.title}</Text>
        <Text style={styles.offerPrice}>{priceLabel(offer)}</Text>
      </View>)}
      {matchingOffers.length > shownOffers.length ? <Text style={styles.moreMatches}>+{matchingOffers.length - shownOffers.length} more matching in-stock {matchingOffers.length - shownOffers.length === 1 ? 'product' : 'products'} in this storefront</Text> : null}
    </View> : null}
  </Pressable>;
}

export default function IndiesScreenV2() {
  const [directory, setDirectory] = useState<NetworkRetailer[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [stockOffers, setStockOffers] = useState<ProductOffer[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const result = await fetchRetailerDirectory();
      setDirectory(result.retailers.filter(hasRetailerStorefront));
    } catch (cause) {
      setDirectory([]);
      setDirectoryError(cause instanceof Error ? cause.message : 'Retailer network is unavailable.');
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadDirectory();
  }, [loadDirectory]));

  const storefrontRetailers = useMemo(() => [...directory].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [directory]);
  const storefrontIds = useMemo(() => new Set(storefrontRetailers.map((retailer) => retailer.id)), [storefrontRetailers]);
  const storefrontIdsKey = useMemo(() => storefrontRetailers.map((retailer) => retailer.id).join('|'), [storefrontRetailers]);
  const searchTerm = query.trim();
  const stockSearchActive = searchTerm.length >= 2;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setStockOffers([]);
    setStockError('');

    if (!stockSearchActive || storefrontRetailers.length === 0) {
      setStockLoading(false);
      return () => { cancelled = true; };
    }

    timer = setTimeout(() => {
      void (async () => {
        setStockLoading(true);
        try {
          const collected: ProductOffer[] = [];
          const seenOfferIds = new Set<string>();
          const matchedRetailerIds = new Set<string>();
          let cursor: string | undefined;
          let pages = 0;

          do {
            const page = await catalogueRepository.list({
              query: searchTerm,
              inStockOnly: true,
              limit: 100,
              cursor,
            });
            for (const offer of page.offers) {
              if (!storefrontIds.has(offer.retailerId) || !strictInStock(offer) || seenOfferIds.has(offer.id)) continue;
              seenOfferIds.add(offer.id);
              matchedRetailerIds.add(offer.retailerId);
              collected.push(offer);
            }
            cursor = page.nextCursor;
            pages += 1;
          } while (cursor && pages < MAX_STOCK_SEARCH_PAGES && matchedRetailerIds.size < storefrontRetailers.length);

          if (!cancelled) setStockOffers(collected);
        } catch {
          if (!cancelled) {
            setStockOffers([]);
            setStockError('Live stock search is temporarily unavailable. Retailer-name search still works.');
          }
        } finally {
          if (!cancelled) setStockLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [searchTerm, stockSearchActive, storefrontIds, storefrontIdsKey, storefrontRetailers]);

  const offersByRetailer = useMemo(() => {
    const grouped = new Map<string, ProductOffer[]>();
    for (const offer of stockOffers) {
      const existing = grouped.get(offer.retailerId) || [];
      existing.push(offer);
      grouped.set(offer.retailerId, existing);
    }
    for (const offers of grouped.values()) offers.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    return grouped;
  }, [stockOffers]);

  const retailerResults = useMemo<RetailerResult[]>(() => {
    if (!searchTerm) return storefrontRetailers.map((retailer) => ({ retailer, matchingOffers: [] }));

    const term = searchTerm.toLowerCase();
    return storefrontRetailers
      .filter((retailer) => retailerSearchText(retailer).includes(term) || offersByRetailer.has(retailer.id))
      .map((retailer) => ({ retailer, matchingOffers: offersByRetailer.get(retailer.id) || [] }));
  }, [offersByRetailer, searchTerm, storefrontRetailers]);

  const retailersWithStock = useMemo(() => retailerResults.filter((result) => result.matchingOffers.length > 0).length, [retailerResults]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FateDropBackground />
    <FlatList
      data={retailerResults}
      keyExtractor={(item) => item.retailer.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={directoryLoading} onRefresh={() => void loadDirectory()} tintColor={FateDropColors.violetLight} />}
      ListHeaderComponent={<>
        <FateDropHeader title="Retailers" subtitle="FATE NETWORK STOREFRONTS" />
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>FATE NETWORK · RETAILERS</Text>
          <Text style={styles.heroTitle}>Find a retailer or search what is in stock.</Text>
          <Text style={styles.heroCopy}>Browse retailer storefronts across the Fate Network. Search a product to see which storefronts currently have a matching in-stock offer.</Text>
          <View style={styles.neutralNote}><Ionicons name="swap-vertical-outline" size={14} color={FateDropColors.goldBright} /><Text style={styles.neutralText}>Retailers are shown alphabetically. This page does not rank shops.</Text></View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={FateDropColors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a retailer or product"
            placeholderTextColor={FateDropColors.muted}
            style={styles.input}
            returnKeyType="search"
            accessibilityLabel="Search Fate Network retailer storefronts and in-stock products"
          />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear retailer search" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={FateDropColors.secondary} /></Pressable> : null}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{searchTerm ? `${retailerResults.length} matching storefront${retailerResults.length === 1 ? '' : 's'}` : `${storefrontRetailers.length} storefronts`}</Text>
          <Text style={styles.sectionMeta}>{searchTerm && stockSearchActive ? `${retailersWithStock} WITH STOCK` : 'A–Z'}</Text>
        </View>

        {searchTerm.length === 1 ? <Text style={styles.helper}>Type one more character to search live product stock. Retailer-name matching is already active.</Text> : null}
        {stockLoading ? <View style={styles.searching}><ActivityIndicator size="small" color={FateDropColors.violetLight} /><Text style={styles.searchingText}>Checking connected storefront stock…</Text></View> : null}
        {stockError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><Text style={styles.errorText}>{stockError}</Text></View> : null}
        {directoryError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><Text style={styles.errorText}>{directoryError}</Text></View> : null}
      </>}
      ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
      ListEmptyComponent={!directoryLoading && !directoryError && !stockLoading ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{searchTerm ? 'No storefronts match' : 'No retailer storefronts available'}</Text>
        <Text style={styles.emptyCopy}>{searchTerm ? 'No retailer name or currently verified in-stock storefront offer matches this search.' : 'FateDrop does not substitute demo retailers when the live retailer directory has no storefronts to show.'}</Text>
      </View> : null}
      renderItem={({ item }) => <RetailerCard result={item} searchTerm={searchTerm} />}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(103,232,249,.16)', backgroundColor: 'rgba(9,10,17,.94)', marginBottom: 11 },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -80, top: -95, backgroundColor: 'rgba(103,232,249,.08)' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: FateDropColors.text, fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.65, marginTop: 7, maxWidth: 330 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  neutralNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: FateDropColors.border },
  neutralText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginBottom: 10 },
  input: { flex: 1, color: FateDropColors.text, fontSize: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginVertical: 7 },
  sectionTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900' },
  sectionMeta: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  helper: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginBottom: 9 },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, marginBottom: 9, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  searchingText: { color: FateDropColors.secondary, fontSize: 9 },
  retailerCard: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' },
  retailerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retailerMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}12`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}28` },
  retailerInitials: { color: FateDropColors.violetLight, fontSize: 11, fontWeight: '900' },
  retailerCopy: { flex: 1 },
  retailerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  retailerName: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' },
  retailerClass: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '800', letterSpacing: .7, marginTop: 3 },
  presence: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '800', marginTop: 4 },
  tcgs: { color: FateDropColors.muted, fontSize: 7, fontWeight: '800', letterSpacing: .55, marginTop: 4 },
  stockBlock: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: FateDropColors.border },
  stockHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  stockHeadText: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: .75 },
  offerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  offerTitle: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 13 },
  offerPrice: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' },
  moreMatches: { color: FateDropColors.muted, fontSize: 8, marginTop: 4 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.amber}33`, padding: 12, marginBottom: 10 },
  errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  empty: { paddingVertical: 42, alignItems: 'center' },
  emptyTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', maxWidth: 300, marginTop: 6 },
  pressed: { opacity: .76 },
});