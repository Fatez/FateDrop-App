import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateJourneyRail, FateMetricStrip, FateSectionHeading } from '@/components/fate-polish-ui';
import { FateDropBackground, FateDropHeader, FilterChip } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { TCG_REGISTRY, type TcgCode } from '@/constants/tcg-registry';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { useCatalogue } from '@/hooks/use-catalogue';
import { fetchFatePriceSets, type FatePriceSet } from '@/services/fate-market';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { fetchRetailerDirectory, type NetworkRetailer } from '@/services/retailer-directory';
import { LocalWishlistRepository } from '@/services/wishlist';
import type { ProductCategory, ProductOffer } from '@/types/domain';

const categories: { label: string; value?: ProductCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'All', icon: 'grid-outline' }, { label: 'Sealed', value: 'SEALED', icon: 'cube-outline' }, { label: 'Singles', value: 'SINGLE', icon: 'albums-outline' },
  { label: 'Graded', value: 'GRADED', icon: 'ribbon-outline' }, { label: 'Accessories', value: 'ACCESSORY', icon: 'bag-handle-outline' }, { label: 'Preorders', value: 'PREORDER', icon: 'time-outline' },
];

const wishlist = new LocalWishlistRepository();
const normalise = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const deliveryFor = (offer: ProductOffer) => offer.shippingOptions.find((option) => !option.collection)?.priceGbp;
const deliveredFor = (offer: ProductOffer) => { const delivery = deliveryFor(offer); return offer.priceGbp !== undefined && delivery !== undefined ? offer.priceGbp + delivery : undefined; };

type SearchTcgScope = 'all' | TcgCode;
type ProductGroup = { id: string; title: string; category: ProductCategory; setName?: string; imageUrl?: string; offers: ProductOffer[] };

function groupOffers(offers: ProductOffer[]): ProductGroup[] {
  const grouped = new Map<string, ProductGroup>();
  for (const offer of offers) {
    const id = offer.canonicalProductId || `title:${offer.category}:${normalise(offer.title)}`;
    const current = grouped.get(id);
    if (current) {
      current.offers.push(offer);
      if (!current.imageUrl && offer.imageUrl) current.imageUrl = offer.imageUrl;
      if (!current.setName && offer.setName) current.setName = offer.setName;
    } else grouped.set(id, { id, title: offer.title, category: offer.category, setName: offer.setName, imageUrl: offer.imageUrl, offers: [offer] });
  }
  return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export default function SearchScreenV3() {
  const { snapshot } = useFateDropId();
  const selectedTcgCodes = useMemo<TcgCode[]>(() => snapshot?.tcgPreferences?.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences?.selectedTcgCodes]);
  const [query, setQuery] = useState('');
  const [tcgScope, setTcgScope] = useState<SearchTcgScope>('all');
  const [category, setCategory] = useState<ProductCategory>();
  const [setId, setSetId] = useState('');
  const [setOptions, setSetOptions] = useState<FatePriceSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [setsError, setSetsError] = useState('');
  const [retailerId, setRetailerId] = useState<string>();
  const [inStock, setInStock] = useState(true);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);
  const [retailerDirectory, setRetailerDirectory] = useState<NetworkRetailer[]>([]);
  const [retailerDirectoryError, setRetailerDirectoryError] = useState('');

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void wishlist.list().then((items) => { if (!cancelled) setSavedProducts(items.filter((item) => item.targetType === 'PRODUCT').map((item) => item.targetId)); });
    void fetchRetailerDirectory().then((result) => {
      if (!cancelled) { setRetailerDirectory(result.retailers.filter((item) => item.retailerClass !== 'event_vendor')); setRetailerDirectoryError(''); }
    }).catch(() => { if (!cancelled) { setRetailerDirectory([]); setRetailerDirectoryError('Retailer filters are temporarily unavailable. Live product evidence can still load.'); } });
    return () => { cancelled = true; };
  }, []));

  useEffect(() => {
    if (tcgScope === 'all') { setSetOptions([]); setSetId(''); setSetsError(''); setSetsLoading(false); return; }
    let active = true;
    setSetsLoading(true); setSetsError(''); setSetId('');
    void fetchFatePriceSets({ tcgCode: tcgScope, limit: 1000 })
      .then((result) => { if (active) setSetOptions(result.sets.filter((set) => set.verificationStatus !== 'rejected').sort((a, b) => Number(b.releasedAt || 0) - Number(a.releasedAt || 0))); })
      .catch(() => { if (active) { setSetOptions([]); setSetsError('Verified set navigation is unavailable for this TCG right now.'); } })
      .finally(() => { if (active) setSetsLoading(false); });
    return () => { active = false; };
  }, [tcgScope]);

  const selectedSet = setOptions.find((set) => set.id === setId);
  const discoveryReady = tcgScope === 'all' || Boolean(selectedSet);
  const retailerNames = useMemo(() => new Map(retailerDirectory.map((item) => [item.id, item.name])), [retailerDirectory]);
  const catalogue = useCatalogue({ query, category, retailerId, setName: selectedSet?.name, inStockOnly: inStock, limit: 50, enabled: discoveryReady });
  const groups = useMemo(() => groupOffers(catalogue.offers), [catalogue.offers]);

  const toggleProduct = async (group: ProductGroup) => {
    const storageId = `product:${group.id}`;
    if (savedProducts.includes(group.id)) { await wishlist.remove(storageId); setSavedProducts((current) => current.filter((id) => id !== group.id)); return; }
    await wishlist.save({ id: storageId, targetType: 'PRODUCT', targetId: group.id, label: group.title, alertsEnabled: false, createdAt: new Date().toISOString() });
    setSavedProducts((current) => [...current, group.id]);
  };

  const guideSteps = [
    { label: 'TCG', detail: tcgScope === 'all' ? 'All network' : TCG_REGISTRY.find((entry) => entry.code === tcgScope)?.shortName || tcgScope, icon: 'layers-outline' as const, state: 'done' as const },
    { label: 'PRODUCT', detail: categories.find((item) => item.value === category)?.label || 'All types', icon: 'cube-outline' as const, state: 'done' as const },
    { label: 'SET', detail: tcgScope === 'all' ? 'Optional' : selectedSet?.name || 'Choose set', icon: 'albums-outline' as const, state: tcgScope === 'all' || selectedSet ? 'done' as const : 'active' as const },
    { label: 'RESULTS', detail: discoveryReady ? `${groups.length} groups` : 'Waiting', icon: 'search-outline' as const, state: discoveryReady && groups.length ? 'done' as const : discoveryReady ? 'active' as const : 'idle' as const },
  ];

  const header = <>
    <FateDropHeader title="Search" subtitle="DISCOVER · NARROW · FIND" rightAction={<Pressable accessibilityLabel="Open FateFind" onPress={() => router.push('/fatefind')} style={styles.headerButton}><Ionicons name="telescope-outline" size={18} color={FateDropColors.goldBright} /></Pressable>} />
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.heroEyebrow}>FATEDROP DISCOVERY</Text>
      <Text style={styles.heroTitle}>Get to the right product before you compare the deal.</Text>
      <Text style={styles.heroCopy}>Start broad or choose a TCG, product type and verified set. Search only shows connected evidence; FateFind owns the intelligent value verdict and persistent hunt.</Text>
    </View>

    <FateJourneyRail steps={guideSteps} />

    <FateSectionHeading eyebrow="1 · CHOOSE THE GAME" title="Trading card game" copy="All network searches stay broad. Selecting a TCG uses FatePrice's verified set library so the next step is precise rather than pretending raw catalogue rows carry a TCG identity they do not have." />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <FilterChip label="All TCGs" active={tcgScope === 'all'} onPress={() => setTcgScope('all')} />
      {TCG_REGISTRY.filter((entry) => selectedTcgCodes.includes(entry.code)).map((entry) => <FilterChip key={entry.code} label={entry.shortName} active={tcgScope === entry.code} onPress={() => setTcgScope(entry.code)} />)}
    </ScrollView>

    <FateSectionHeading eyebrow="2 · NARROW THE PRODUCT" title="Product type" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{categories.map((item) => {
      const active = category === item.value;
      return <Pressable key={item.label} onPress={() => setCategory(item.value)} style={[styles.categoryChip, active && styles.categoryChipActive]}><Ionicons name={item.icon} size={15} color={active ? FateDropColors.goldBright : FateDropColors.secondary} /><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text></Pressable>;
    })}</ScrollView>

    {tcgScope !== 'all' ? <>
      <FateSectionHeading eyebrow="3 · VERIFIED SET" title={selectedSet ? selectedSet.name : 'Choose the set'} copy="This set choice becomes the real catalogue set filter. Nothing is labelled as TCG-filtered until an exact verified set supplies that boundary." action={selectedSet ? 'CLEAR' : undefined} onAction={selectedSet ? () => setSetId('') : undefined} />
      {setsLoading ? <View style={styles.inlineState}><ActivityIndicator size="small" color={FateDropColors.goldBright} /><Text style={styles.inlineStateText}>Loading verified sets…</Text></View> : setsError ? <View style={styles.warning}><Ionicons name="warning-outline" size={15} color={FateDropColors.echo} /><Text style={styles.warningText}>{setsError}</Text></View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.setRail}>{setOptions.slice(0, 80).map((set) => <Pressable key={set.id} onPress={() => setSetId(set.id)} style={[styles.setChip, setId === set.id && styles.setChipActive]}><Text style={[styles.setName, setId === set.id && styles.setNameActive]} numberOfLines={1}>{set.name}</Text><Text style={styles.setMeta}>{set.seriesName || 'Verified set'}{set.total ? ` · ${set.total}` : ''}</Text></Pressable>)}</ScrollView>}
    </> : null}

    <FateSectionHeading eyebrow={tcgScope === 'all' ? '3 · SEARCH' : '4 · SEARCH'} title="Find the product" />
    <View style={[styles.search, !discoveryReady && styles.searchDisabled]}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput editable={discoveryReady} value={query} onChangeText={setQuery} placeholder={discoveryReady ? 'Product, set, SKU…' : 'Choose a verified set first'} placeholderTextColor={FateDropColors.muted} style={styles.input} autoCapitalize="none" /></View>

    <View style={styles.secondaryFilters}>
      <Pressable onPress={() => setInStock((value) => !value)} style={[styles.stockToggle, inStock && styles.stockToggleActive]}><View style={[styles.stockDot, inStock && styles.stockDotActive]} /><Text style={[styles.stockText, inStock && styles.stockTextActive]}>{inStock ? 'IN STOCK ONLY' : 'ALL STOCK STATES'}</Text></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.retailerRail}><FilterChip label="All retailers" active={!retailerId} onPress={() => setRetailerId(undefined)} />{retailerDirectory.slice(0, 20).map((item) => <FilterChip key={item.id} label={item.name} active={retailerId === item.id} onPress={() => setRetailerId(item.id)} />)}</ScrollView>
    </View>
    {retailerDirectoryError ? <Text style={styles.directoryWarning}>{retailerDirectoryError}</Text> : null}

    <FateMetricStrip items={[
      { icon: 'cube-outline', value: discoveryReady ? catalogue.total.toLocaleString() : '—', label: 'NETWORK OFFERS', color: FateDropColors.cyan },
      { icon: 'layers-outline', value: discoveryReady ? String(groups.length) : '—', label: 'PRODUCT GROUPS', color: FateDropColors.goldBright },
      { icon: 'storefront-outline', value: retailerId ? '1' : String(retailerDirectory.length || '—'), label: 'RETAILER SCOPE', color: FateDropColors.violetLight },
    ]} />
    <FateSectionHeading eyebrow="RESULTS" title={discoveryReady ? (groups.length ? `${groups.length} product groups` : 'Live catalogue results') : 'Choose a set to continue'} copy={discoveryReady ? 'Offers are grouped conservatively. True Price stays unavailable when delivery is unknown.' : 'The app deliberately pauses catalogue requests here rather than showing cross-TCG noise under a TCG label.'} />
  </>;

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList
    data={discoveryReady ? groups : []} keyExtractor={(item) => item.id} ListHeaderComponent={header} contentContainerStyle={styles.content}
    ItemSeparatorComponent={() => <View style={{ height: 11 }} />} onEndReached={() => { if (discoveryReady) void catalogue.loadMore(); }} onEndReachedThreshold={.5}
    ListFooterComponent={catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.goldBright} style={styles.state} /> : null}
    ListEmptyComponent={!discoveryReady ? <GuidedState icon="albums-outline" title="Choose a verified set" copy="FateDrop will not fake a TCG filter. Pick the set, then the catalogue uses that exact set boundary." /> : catalogue.loading ? <View style={styles.loadingState}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Searching connected retailer evidence…</Text></View> : catalogue.error ? <GuidedState icon="cloud-offline-outline" title="Catalogue evidence unavailable" copy={catalogue.error} action="TRY AGAIN" onAction={() => void catalogue.retry()} /> : <GuidedState icon="search-outline" title="No products match" copy="Adjust the product, set, retailer or stock filters. FateDrop leaves an empty result empty rather than broadening it behind your back." />}
    renderItem={({ item }) => <ProductResult group={item} saved={savedProducts.includes(item.id)} onToggle={() => void toggleProduct(item)} retailerNames={retailerNames} />}
  /></SafeAreaView>;
}

function ProductResult({ group, saved, onToggle, retailerNames }: { group: ProductGroup; saved: boolean; onToggle: () => void; retailerNames: Map<string, string> }) {
  const retailerCount = new Set(group.offers.map((offer) => offer.retailerId)).size;
  const liveCount = group.offers.filter((offer) => offer.stockStatus === 'IN_STOCK').length;
  const itemPrices = group.offers.map((offer) => offer.priceGbp).filter((value): value is number => value !== undefined);
  const truePrices = group.offers.map(deliveredFor).filter((value): value is number => value !== undefined);
  const lowestItem = itemPrices.length ? Math.min(...itemPrices) : undefined;
  const lowestTrue = truePrices.length ? Math.min(...truePrices) : undefined;
  const sortedOffers = [...group.offers].sort((a, b) => (deliveredFor(a) ?? a.priceGbp ?? Infinity) - (deliveredFor(b) ?? b.priceGbp ?? Infinity));
  return <View style={styles.productCard}>
    <View style={styles.productHead}>
      <View style={styles.productMedia}>{group.imageUrl ? <Image source={{ uri: group.imageUrl }} style={styles.productImage} contentFit="contain" cachePolicy="memory-disk" /> : <Ionicons name="cube-outline" size={23} color={FateDropColors.goldBright} />}</View>
      <View style={styles.productIdentity}><Text style={styles.category}>{group.category}{group.setName ? ` · ${group.setName}` : ''}</Text><Text style={styles.productTitle}>{group.title}</Text><Text style={styles.productMeta}>{retailerCount} retailer{retailerCount === 1 ? '' : 's'} · {liveCount} live · {group.offers.length} observed offers loaded</Text></View>
      <Pressable onPress={onToggle} accessibilityLabel={saved ? 'Remove from Wishlist' : 'Save to Wishlist'} style={[styles.save, saved && styles.saveActive]}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? FateDropColors.violetLight : FateDropColors.ivory} /></Pressable>
    </View>
    <View style={styles.valueBand}><View style={styles.valueCell}><Text style={styles.valueLabel}>LOWEST ITEM</Text><Text style={styles.value}>{lowestItem === undefined ? '—' : `£${lowestItem.toFixed(2)}`}</Text></View><View style={styles.valueDivider} /><View style={styles.valueCell}><Text style={styles.valueLabel}>LOWEST TRUE PRICE</Text><Text style={styles.trueValue}>{lowestTrue === undefined ? 'Delivery unknown' : `£${lowestTrue.toFixed(2)}`}</Text></View></View>
    <View style={styles.offerList}>{sortedOffers.slice(0, 4).map((offer, index) => { const delivery = deliveryFor(offer); const truePrice = deliveredFor(offer); return <View key={offer.id} style={styles.offerRow}><View style={[styles.rank, index === 0 && styles.rankBest]}><Text style={[styles.rankText, index === 0 && styles.rankTextBest]}>{index + 1}</Text></View><View style={styles.offerCopy}><Pressable onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: offer.retailerId } })}><Text style={styles.retailer}>{retailerNames.get(offer.retailerId) || offer.retailerId}</Text></Pressable><Text style={styles.offerDetail}>{offer.priceGbp === undefined ? 'Item price unavailable' : `£${offer.priceGbp.toFixed(2)} item`} · {delivery === undefined ? 'delivery unknown' : `£${delivery.toFixed(2)} delivery`}</Text></View><View style={styles.offerRight}><Text style={styles.offerTotal}>{truePrice === undefined ? '—' : `£${truePrice.toFixed(2)}`}</Text><Text style={styles.offerTotalLabel}>{truePrice === undefined ? 'TRUE PRICE PENDING' : 'TRUE PRICE'}</Text></View>{offer.productUrl ? <Pressable onPress={() => void openTrackedRetailerLink({ destinationUrl: offer.productUrl!, retailerId: offer.retailerId, offerId: offer.id, placement: 'retail-search-v3' })} style={styles.open}><Ionicons name="open-outline" size={14} color={FateDropColors.ivory} /></Pressable> : null}</View>; })}</View>
    <View style={styles.productActions}><Pressable onPress={() => router.push({ pathname: '/fatefind', params: { query: group.title } })} style={styles.primaryAction}><Ionicons name="telescope-outline" size={14} color={FateDropColors.background} /><Text style={styles.primaryActionText}>RUN FATEFIND</Text></Pressable><Pressable onPress={onToggle} style={styles.secondaryAction}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color={FateDropColors.violetLight} /><Text style={styles.secondaryActionText}>{saved ? 'SAVED' : 'SAVE'}</Text></Pressable></View>
  </View>;
}

function GuidedState({ icon, title, copy, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string; action?: string; onAction?: () => void }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={22} color={FateDropColors.goldBright} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{copy}</Text>{action && onAction ? <Pressable onPress={onAction} style={styles.retry}><Text style={styles.retryText}>{action}</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 120 }, headerButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.goldBright}30`, backgroundColor: `${FateDropColors.goldBright}0A` },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,197,141,.22)', backgroundColor: 'rgba(7,12,20,.88)', marginBottom: 11 }, heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -85, top: -105, backgroundColor: `${FateDropColors.violetLight}0C` }, heroEyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.3 }, heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 27, lineHeight: 31, marginTop: 7, maxWidth: 340 }, heroCopy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 8 },
  filters: { gap: 7, paddingBottom: 2 }, categoryRail: { gap: 7, paddingBottom: 2 }, categoryChip: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,17,25,.82)' }, categoryChipActive: { borderColor: `${FateDropColors.goldBright}58`, backgroundColor: `${FateDropColors.goldBright}0D` }, categoryText: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '800' }, categoryTextActive: { color: FateDropColors.ivory },
  setRail: { gap: 8, paddingBottom: 3 }, setChip: { width: 168, minHeight: 57, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(12,17,25,.86)' }, setChipActive: { borderColor: `${FateDropColors.goldBright}65`, backgroundColor: `${FateDropColors.goldBright}0D` }, setName: { color: FateDropColors.secondary, fontSize: 10.5, fontWeight: '900' }, setNameActive: { color: FateDropColors.ivory }, setMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 4 }, inlineState: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, inlineStateText: { color: FateDropColors.secondary, fontSize: 10 }, warning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.echo}38`, backgroundColor: `${FateDropColors.echo}08` }, warningText: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, height: 49, borderRadius: 16, backgroundColor: 'rgba(14,19,28,.92)', borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 10 }, searchDisabled: { opacity: .5 }, input: { flex: 1, color: FateDropColors.ivory, fontSize: 13 }, secondaryFilters: { gap: 8, marginBottom: 9 }, retailerRail: { gap: 7 }, stockToggle: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, stockToggleActive: { borderColor: `${FateDropColors.manifested}45`, backgroundColor: `${FateDropColors.manifested}0D` }, stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.muted }, stockDotActive: { backgroundColor: FateDropColors.manifested }, stockText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .7 }, stockTextActive: { color: FateDropColors.manifested }, directoryWarning: { color: FateDropColors.echo, fontSize: 8.5, lineHeight: 13, marginBottom: 9 },
  productCard: { padding: 14, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(10,15,23,.92)' }, productHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, productMedia: { width: 52, height: 65, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.goldBright}24`, backgroundColor: FateDropColors.card }, productImage: { width: '100%', height: '100%' }, productIdentity: { flex: 1 }, category: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .8 }, productTitle: { color: FateDropColors.ivory, fontSize: 15, lineHeight: 19, fontWeight: '900', marginTop: 3 }, productMeta: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 }, save: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.card }, saveActive: { borderColor: `${FateDropColors.violetLight}55`, backgroundColor: `${FateDropColors.violetLight}12` },
  valueBand: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FateDropColors.border }, valueCell: { flex: 1 }, valueDivider: { width: 1, height: 32, backgroundColor: FateDropColors.border, marginHorizontal: 16 }, valueLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .7 }, value: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900', marginTop: 3 }, trueValue: { color: FateDropColors.cyan, fontSize: 14, fontWeight: '900', marginTop: 3 }, offerList: { marginTop: 2 }, offerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 57, borderBottomWidth: 1, borderBottomColor: FateDropColors.border }, rank: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.card }, rankBest: { backgroundColor: `${FateDropColors.manifested}14` }, rankText: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900' }, rankTextBest: { color: FateDropColors.manifested }, offerCopy: { flex: 1 }, retailer: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900' }, offerDetail: { color: FateDropColors.secondary, fontSize: 8, marginTop: 3 }, offerRight: { alignItems: 'flex-end' }, offerTotal: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900' }, offerTotalLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', marginTop: 2 }, open: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}2A` }, productActions: { flexDirection: 'row', gap: 7, marginTop: 12 }, primaryAction: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 41, borderRadius: 11, backgroundColor: FateDropColors.goldBright }, primaryActionText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .5 }, secondaryAction: { flex: .7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 41, borderRadius: 11, borderWidth: 1, borderColor: `${FateDropColors.violetLight}35`, backgroundColor: `${FateDropColors.violetLight}08` }, secondaryActionText: { color: FateDropColors.violetLight, fontSize: 7.5, fontWeight: '900' },
  state: { margin: 35 }, loadingState: { alignItems: 'center', gap: 9, padding: 28 }, loadingText: { color: FateDropColors.secondary, fontSize: 9.5 }, empty: { alignItems: 'center', padding: 28, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.goldBright}22`, backgroundColor: 'rgba(8,13,21,.72)' }, emptyIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.goldBright}30`, backgroundColor: `${FateDropColors.goldBright}09` }, emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 10 }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 5, textAlign: 'center', maxWidth: 330 }, retry: { marginTop: 12, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: FateDropColors.goldBright }, retryText: { color: FateDropColors.background, fontSize: 8, fontWeight: '900' },
});
