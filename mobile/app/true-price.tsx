import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { LocalWishlistRepository } from '@/services/wishlist';
import type { TruePriceGroup, TruePriceOffer, TruePriceResponse } from '@/types/true-price';

type SortMode = 'item' | 'delivered';
const wishlist = new LocalWishlistRepository();
const money = (value?: number) => value === undefined ? 'Unknown' : `£${value.toFixed(2)}`;
const sortedOffers = (offers: TruePriceOffer[], sort: SortMode) => [...offers].sort((a, b) => sort === 'item' ? (a.priceGbp ?? Infinity) - (b.priceGbp ?? Infinity) : (a.totalDeliveredGbp ?? Infinity) - (b.totalDeliveredGbp ?? Infinity));
const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function percentDelta(value: number, rrp: number) { return ((value - rrp) / rrp) * 100; }
function deltaLabel(value: number | undefined, rrp: number | undefined) {
  if (value === undefined || rrp === undefined || rrp <= 0) return undefined;
  const difference = value - rrp;
  const percent = percentDelta(value, rrp);
  const sign = difference > 0 ? '+' : difference < 0 ? '−' : '';
  const percentSign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  return `${sign}£${Math.abs(difference).toFixed(2)} · ${percentSign}${Math.abs(percent).toFixed(1)}% vs RRP`;
}

export default function TruePriceScreen() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const incomingQuery = firstParam(params.query) || '';
  const [query, setQuery] = useState(incomingQuery);
  const [groups, setGroups] = useState<TruePriceGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortMode>('item');
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => { if (incomingQuery) setQuery(incomingQuery); }, [incomingQuery]);
  useFocusEffect(useCallback(() => { void wishlist.list().then((items) => setSaved(items.filter((item) => item.targetType === 'PRODUCT').map((item) => item.targetId))); }, []));

  useEffect(() => {
    if (query.trim().length < 2) { setGroups([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const response = await fetch(`${SIGNAL_ENGINE_URL}/api/true-price?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error();
        const data = await response.json() as TruePriceResponse;
        setGroups(data.groups);
      } catch { setError('Price comparison could not be loaded from FateDrop Cloud.'); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const displayed = useMemo(() => groups.map((group) => ({ ...group, offers: sortedOffers(group.offers, sort) })), [groups, sort]);
  const toggleProduct = async (group: TruePriceGroup) => {
    const id = `product:${group.id}`;
    if (saved.includes(group.id)) { await wishlist.remove(id); setSaved((current) => current.filter((value) => value !== group.id)); }
    else { await wishlist.save({ id, targetType: 'PRODUCT', targetId: group.id, label: group.title, alertsEnabled: true, createdAt: new Date().toISOString() }); setSaved((current) => [...current, group.id]); }
  };

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
    <AbstractHero eyebrow="True Price" title="Know the markup before you buy." subtitle="FateDrop compares the current item price with an authoritative RRP when one is available. Delivery-aware True Price is shown as an enhancement when postage is known." icon="pricetag" />
    <View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search a product to compare" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View>
    <Text style={styles.label}>Sort offers</Text>
    <View style={styles.sorts}><FilterChip label="Item price" active={sort === 'item'} onPress={() => setSort('item')} /><FilterChip label="Delivered price" active={sort === 'delivered'} onPress={() => setSort('delivered')} /></View>
    <Text style={styles.disclaimer}>RRP percentages are only calculated when FateDrop Cloud has an observed authoritative reference for the canonical product. Unknown delivery never blocks item-vs-RRP comparison and is never treated as free.</Text>
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground /><FlatList data={displayed} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={header} ListEmptyComponent={loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : <Text style={styles.state}>{error || 'Enter at least two characters to find comparable offers.'}</Text>} renderItem={({ item }) => <ComparisonGroup group={item} saved={saved.includes(item.id)} onToggle={() => void toggleProduct(item)} />} /></SafeAreaView>;
}

function ComparisonGroup({ group, saved, onToggle }: { group: TruePriceGroup; saved: boolean; onToggle: () => void }) {
  return <View style={styles.group}>
    <View style={styles.groupTop}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{group.title}</Text>
        <Text style={styles.meta}>{group.retailerCount} retailer{group.retailerCount === 1 ? '' : 's'} · {Math.round(group.matchingConfidence * 100)}% conservative match</Text>
        {group.rrpGbp !== undefined ? <View style={styles.rrpRow}><Text style={styles.rrp}>Official RRP {money(group.rrpGbp)}</Text>{group.rrpSource ? <Text style={styles.rrpSource}>{group.rrpSource}{group.rrpObservedAt ? ` · observed ${new Date(group.rrpObservedAt).toLocaleDateString()}` : ''}</Text> : null}</View> : <Text style={styles.rrpUnknown}>Authoritative RRP unavailable · no markup percentage shown</Text>}
      </View>
      <StatusBadge label={group.category} color={FateDropColors.cyan} />
      <Pressable accessibilityLabel={saved ? 'Remove canonical product from wishlist' : 'Save canonical product to wishlist'} onPress={onToggle} style={styles.bookmark}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? FateDropColors.violetLight : FateDropColors.text} /></Pressable>
    </View>
    {group.offers.map((offer) => {
      const itemDelta = deltaLabel(offer.priceGbp, group.rrpGbp);
      const deliveredDelta = offer.deliveryKnown ? deltaLabel(offer.totalDeliveredGbp, group.rrpGbp) : undefined;
      const belowRrp = offer.priceGbp !== undefined && group.rrpGbp !== undefined && offer.priceGbp < group.rrpGbp;
      return <View key={offer.id} style={styles.offer}>
        <View style={{ flex: 1 }}><Text style={styles.retailer}>{offer.retailerName}</Text><Text style={styles.itemPrice}>Current price {money(offer.priceGbp)}</Text>{itemDelta ? <Text style={belowRrp ? styles.deltaGood : styles.delta}>{itemDelta}</Text> : <Text style={styles.noDelta}>No authoritative RRP comparison</Text>}<Text style={styles.delivery}>{offer.deliveryKnown ? `Delivered True Price ${money(offer.totalDeliveredGbp)} · delivery ${money(offer.shippingGbp)}` : 'Delivery not yet verified · item comparison remains valid'}</Text>{deliveredDelta ? <Text style={styles.deliveredDelta}>{deliveredDelta} delivered</Text> : null}{offer.freeShippingThresholdGbp !== undefined ? <Text style={styles.collection}>Free delivery from {money(offer.freeShippingThresholdGbp)}</Text> : null}{offer.collectionAvailable ? <Text style={styles.collection}>Collection available</Text> : null}</View>
        {belowRrp ? <StatusBadge label="Below RRP" color={FateDropColors.mint} /> : offer.isLowestKnownDelivered ? <StatusBadge label="Lowest delivered" color={FateDropColors.mint} /> : null}
        {offer.productUrl ? <Pressable accessibilityLabel={`Buy at ${offer.retailerName}`} onPress={() => void openTrackedRetailerLink({ destinationUrl: offer.productUrl!, retailerId: offer.retailerId, offerId: offer.id, placement: 'true-price' })} style={styles.buy}><Ionicons name="open-outline" size={16} color={FateDropColors.text} /></Pressable> : null}
      </View>;
    })}
    <Pressable onPress={() => router.push({ pathname: '/fatefind', params: { query: group.title } })} style={styles.fateFindButton}><Ionicons name="telescope" size={15} color={FateDropColors.violetLight} /><Text style={styles.fateFindText}>Create a pre-filled FateFind</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 20, paddingBottom: 80 }, back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }, backText: { color: FateDropColors.text, fontWeight: '800' },
  search: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 }, input: { flex: 1, color: FateDropColors.text }, label: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 10 }, disclaimer: { color: FateDropColors.muted, fontSize: 11, lineHeight: 17, marginBottom: 14 }, state: { color: FateDropColors.muted, textAlign: 'center', margin: 40 },
  group: { padding: 15, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 }, groupTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 }, title: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' }, meta: { color: FateDropColors.muted, fontSize: 10, marginTop: 5 }, rrpRow: { marginTop: 8 }, rrp: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' }, rrpSource: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 }, rrpUnknown: { color: FateDropColors.muted, fontSize: 9, marginTop: 7 }, bookmark: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.cardElevated },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: FateDropColors.border }, retailer: { color: FateDropColors.text, fontWeight: '800' }, itemPrice: { color: FateDropColors.text, fontSize: 11, fontWeight: '800', marginTop: 4 }, delta: { color: FateDropColors.amber, fontSize: 10, fontWeight: '900', marginTop: 3 }, deltaGood: { color: FateDropColors.mint, fontSize: 10, fontWeight: '900', marginTop: 3 }, noDelta: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 }, delivery: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '700', marginTop: 6 }, deliveredDelta: { color: FateDropColors.secondary, fontSize: 9, marginTop: 2 }, collection: { color: FateDropColors.mint, fontSize: 9, marginTop: 3 }, buy: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.violet },
  fateFindButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.violetLight}44`, marginTop: 8 }, fateFindText: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '900' },
});
