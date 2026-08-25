import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { rrpBasisLabel } from '@/lib/value-compare';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { LocalWishlistRepository } from '@/services/wishlist';
import type {
  FatePairVerdict,
  FateRankVerdict,
  FateVerdictPosition,
  FateVerdictResponse,
  TruePriceGroup,
  TruePriceOffer,
} from '@/types/true-price';

type SortMode = 'item' | 'delivered';
const wishlist = new LocalWishlistRepository();
const money = (value?: number | null) => value == null ? 'Unknown' : `£${value.toFixed(2)}`;
const sortedOffers = (offers: TruePriceOffer[], sort: SortMode) => [...offers].sort((a, b) => sort === 'item' ? (a.priceGbp ?? Infinity) - (b.priceGbp ?? Infinity) : (a.totalDeliveredGbp ?? Infinity) - (b.totalDeliveredGbp ?? Infinity));
const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function percentDelta(value: number, rrp: number) { return ((value - rrp) / rrp) * 100; }
function percentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}
function deltaLabel(value: number | undefined, rrp: number | undefined) {
  if (value === undefined || rrp === undefined || rrp <= 0) return undefined;
  const difference = value - rrp;
  const percent = percentDelta(value, rrp);
  const sign = difference > 0 ? '+' : difference < 0 ? '−' : '';
  const percentSign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  return `${sign}£${Math.abs(difference).toFixed(2)} · ${percentSign}${Math.abs(percent).toFixed(1)}% vs RRP/reference`;
}

async function requestCloudVerdict(query: string, leftId?: string, rightId?: string) {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/fatefind/matches`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'verdict', query, ...(leftId && rightId ? { leftId, rightId } : {}) }),
  });
  if (!response.ok) throw new Error('fatefind-cloud-unavailable');
  const data = await response.json() as FateVerdictResponse;
  if (data.mode !== 'verdict' || data.source !== 'FATEDROP_CLOUD') throw new Error('fatefind-cloud-contract-invalid');
  return data;
}

export default function FateFindLiveScreen() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const incomingQuery = firstParam(params.query) || '';
  const [query, setQuery] = useState(incomingQuery);
  const [groups, setGroups] = useState<TruePriceGroup[]>([]);
  const [verdict, setVerdict] = useState<FateRankVerdict | null>(null);
  const [pairVerdict, setPairVerdict] = useState<FatePairVerdict | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortMode>('item');
  const [saved, setSaved] = useState<string[]>([]);
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');

  useEffect(() => { if (incomingQuery) setQuery(incomingQuery); }, [incomingQuery]);
  useFocusEffect(useCallback(() => { void wishlist.list().then((items) => setSaved(items.filter((item) => item.targetType === 'PRODUCT').map((item) => item.targetId))); }, []));

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setGroups([]);
      setVerdict(null);
      setPairVerdict(null);
      setError('');
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await requestCloudVerdict(clean);
        setGroups(data.groups);
        setVerdict(data.verdict);
        setPairVerdict(null);
      } catch {
        setGroups([]);
        setVerdict(null);
        setPairVerdict(null);
        setError('FateFind could not load its canonical Fate Verdict from FateDrop Cloud.');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const options = groups.filter((group) => group.offers.length > 0);
    if (options.length < 2) {
      setCompareLeftId(options[0]?.id ?? '');
      setCompareRightId('');
      return;
    }
    setCompareLeftId((current) => options.some((group) => group.id === current) ? current : options[0].id);
    setCompareRightId((current) => options.some((group) => group.id === current) && current !== options[0].id ? current : options[1].id);
  }, [groups]);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2 || !compareLeftId || !compareRightId || compareLeftId === compareRightId) {
      setPairVerdict(null);
      setPairError('');
      setPairLoading(false);
      return;
    }
    let active = true;
    setPairLoading(true);
    setPairError('');
    void requestCloudVerdict(clean, compareLeftId, compareRightId)
      .then((data) => { if (active) setPairVerdict(data.pairVerdict); })
      .catch(() => { if (active) { setPairVerdict(null); setPairError('FateDrop Cloud could not return this head-to-head verdict.'); } })
      .finally(() => { if (active) setPairLoading(false); });
    return () => { active = false; };
  }, [query, compareLeftId, compareRightId]);

  const displayed = useMemo(() => groups.map((group) => ({ ...group, offers: sortedOffers(group.offers, sort) })), [groups, sort]);
  const toggleProduct = async (group: TruePriceGroup) => {
    const id = `product:${group.id}`;
    if (saved.includes(group.id)) { await wishlist.remove(id); setSaved((current) => current.filter((value) => value !== group.id)); }
    else { await wishlist.save({ id, targetType: 'PRODUCT', targetId: group.id, label: group.title, alertsEnabled: false, createdAt: new Date().toISOString() }); setSaved((current) => [...current, group.id]); }
  };

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
    <AbstractHero eyebrow="FateFind" title="Find the right deal now. Keep hunting if it is not there yet." subtitle="FateFind is FateDrop's intelligent value finder. It combines verified RRP/reference maths with visible True Price, returns one Cloud Fate Verdict, and can keep searching under your conditions until a qualifying offer becomes a FateMatch." icon="telescope" />
    <View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search a product to compare" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View>
    <Text style={styles.label}>Sort offers</Text>
    <View style={styles.sorts}><FilterChip label="Item price" active={sort === 'item'} onPress={() => setSort('item')} /><FilterChip label="True Price" active={sort === 'delivered'} onPress={() => setSort('delivered')} /></View>
    <Text style={styles.disclaimer}>RRP/reference percentage shows whether the item price is fair against the verified value baseline. True Price shows what you will actually pay when mandatory delivery/fees are known. Unknown delivery never becomes £0. FateDrop Cloud owns the ranking and Fate Verdict.</Text>
    <CloudVerdictSummary groups={displayed} verdict={verdict} />
    <MobileValueCompare groups={displayed} leftId={compareLeftId} rightId={compareRightId} onLeft={setCompareLeftId} onRight={setCompareRightId} result={pairVerdict} loading={pairLoading} error={pairError} />
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground /><FlatList data={displayed} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={header} ListEmptyComponent={loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : <Text style={styles.state}>{error || 'Search at least two characters to run FateFind across the live database.'}</Text>} renderItem={({ item }) => <ComparisonGroup group={item} saved={saved.includes(item.id)} onToggle={() => void toggleProduct(item)} />} /></SafeAreaView>;
}

function CloudVerdictSummary({ groups, verdict }: { groups: TruePriceGroup[]; verdict: FateRankVerdict | null }) {
  if (!verdict || groups.length < 2) return null;
  const winner = verdict.winnerId ? groups.find((group) => group.id === verdict.winnerId) : undefined;
  return <View style={winner ? styles.verdictWinner : styles.verdict}>
    <Text style={styles.verdictEyebrow}>{winner ? 'FATE VERDICT · BEST ACROSS THIS SEARCH' : 'FATEDROP NEEDS MORE EVIDENCE'}</Text>
    <Text style={styles.verdictText}>{verdict.reason}</Text>
    {winner ? <Text style={styles.verdictNote}>{winner.title} is the Cloud-ranked leader for this search · rules {verdict.basis === 'rrp_percent' ? 'RRP/reference value position first' : verdict.basis === 'unit_true_price' ? 'comparable unit cost' : 'verified evidence'}{verdict.provisional ? ' · delivered-cost evidence remains provisional for at least one ranked offer' : ''}.</Text> : null}
  </View>;
}

function MobileValueCompare({ groups, leftId, rightId, onLeft, onRight, result, loading, error }: { groups: TruePriceGroup[]; leftId: string; rightId: string; onLeft: (id: string) => void; onRight: (id: string) => void; result: FatePairVerdict | null; loading: boolean; error: string }) {
  const options = groups.filter((group) => group.offers.length > 0);
  if (options.length < 2) return null;
  const leftGroup = options.find((group) => group.id === leftId) ?? options[0];
  const rightGroup = options.find((group) => group.id === rightId) ?? options[1];
  const winner = result?.winnerId ? options.find((group) => group.id === result.winnerId) : undefined;

  return <View style={styles.comparePanel}>
    <View style={styles.compareHead}><View style={{ flex: 1 }}><Text style={styles.compareEyebrow}>FATEFIND COMPARE · CLOUD</Text><Text style={styles.compareTitle}>Compare two items</Text><Text style={styles.compareCopy}>This head-to-head uses the same canonical Fate Verdict engine as the website. RRP/reference position decides value first; True Price shows the known checkout cost.</Text></View>{winner ? <StatusBadge label="Best value" color={FateDropColors.mint} /> : null}</View>
    <CompareSelector label="ITEM A" groups={options} selectedId={leftGroup.id} onSelect={onLeft} />
    <CompareSelector label="ITEM B" groups={options} selectedId={rightGroup.id} onSelect={onRight} />
    {loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : result ? <>
      <View style={styles.compareCards}>
        <ValueCard group={leftGroup} position={result.left} winnerId={result.winnerId} />
        <ValueCard group={rightGroup} position={result.right} winnerId={result.winnerId} />
      </View>
      <View style={winner ? styles.verdictWinner : styles.verdict}>
        <Text style={styles.verdictEyebrow}>{winner ? 'FATE VERDICT' : 'FATEDROP NEEDS MORE EVIDENCE'}</Text>
        <Text style={styles.verdictText}>{result.reason}</Text>
        <Text style={styles.verdictNote}>{result.left?.provisional || result.right?.provisional ? 'RRP value remains valid from item price, but at least one final True Price is still provisional.' : 'Both selected offers have known delivery, so True Price can be compared alongside the RRP value verdict.'}</Text>
      </View>
    </> : <Text style={styles.state}>{error || 'Waiting for FateDrop Cloud to return the canonical head-to-head verdict.'}</Text>}
  </View>;
}

function CompareSelector({ label, groups, selectedId, onSelect }: { label: string; groups: TruePriceGroup[]; selectedId: string; onSelect: (id: string) => void }) {
  return <View style={styles.selector}><Text style={styles.selectorLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>{groups.map((group) => <Pressable key={`${label}-${group.id}`} onPress={() => onSelect(group.id)} style={group.id === selectedId ? styles.selectorChipActive : styles.selectorChip}><Text numberOfLines={1} style={group.id === selectedId ? styles.selectorChipTextActive : styles.selectorChipText}>{group.title}</Text></Pressable>)}</ScrollView></View>;
}

function ValueCard({ group, position, winnerId }: { group: TruePriceGroup; position: FateVerdictPosition | null; winnerId: string | null }) {
  if (!position) return null;
  return <View style={winnerId === group.id ? styles.valueCardWinner : styles.valueCard}>
    <Text style={styles.valueBasis}>{rrpBasisLabel(group).toUpperCase()}</Text>
    <Text style={styles.valueTitle} numberOfLines={2}>{group.title}</Text>
    <View style={styles.valueMetric}><Text style={styles.valueMetricLabel}>ITEM</Text><Text style={styles.valueMetricValue}>{money(position.itemPrice)}</Text></View>
    <View style={styles.valueMetric}><Text style={styles.valueMetricLabel}>VS RRP / REFERENCE</Text><Text style={styles.valueMetricValue}>{percentLabel(position.rrpPercent)}</Text></View>
    <View style={styles.valueMetric}><Text style={styles.valueMetricLabel}>TRUE PRICE / UNIT</Text><Text style={styles.valueMetricValue}>{money(position.unitCost)}</Text><Text style={styles.valueMetricNote}>{group.unitCount ? `${group.unitCount} ${group.unitKind === 'booster_pack' ? 'packs' : 'units'} · ${position.provisional ? 'delivery pending' : 'delivered'}` : 'Unit count unavailable'}</Text></View>
    <Text style={styles.valueReference}>{group.rrpReferenceBasis ?? (group.rrpGbp !== undefined ? `${rrpBasisLabel(group)} · ${money(group.rrpGbp)}` : 'Verified reference unavailable')}</Text>
  </View>;
}

function ComparisonGroup({ group, saved, onToggle }: { group: TruePriceGroup; saved: boolean; onToggle: () => void }) {
  return <View style={styles.group}>
    <View style={styles.groupTop}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{group.title}</Text>
        <Text style={styles.meta}>{group.retailerCount} retailer{group.retailerCount === 1 ? '' : 's'} · {Math.round(group.matchingConfidence * 100)}% conservative match</Text>
        {group.rrpGbp !== undefined ? <View style={styles.rrpRow}><Text style={styles.rrp}>{rrpBasisLabel(group)} {money(group.rrpGbp)}</Text>{group.rrpReferenceBasis ? <Text style={styles.rrpBasis}>{group.rrpReferenceBasis}</Text> : null}{group.unitCount && group.unitRrpGbp !== undefined ? <Text style={styles.rrpBasis}>{group.unitCount} × {money(group.unitRrpGbp)} per {group.unitKind === 'booster_pack' ? 'pack' : 'unit'}</Text> : null}{group.rrpSource ? <Text style={styles.rrpSource}>{group.rrpSource}{group.rrpObservedAt ? ` · observed ${new Date(group.rrpObservedAt).toLocaleDateString()}` : ''}</Text> : null}</View> : <Text style={styles.rrpUnknown}>Verified RRP/reference unavailable · no markup percentage shown</Text>}
      </View>
      <StatusBadge label={group.category} color={FateDropColors.cyan} />
      <Pressable accessibilityLabel={saved ? 'Remove canonical product from wishlist' : 'Remember canonical product in wishlist'} onPress={onToggle} style={styles.bookmark}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? FateDropColors.violetLight : FateDropColors.text} /></Pressable>
    </View>
    {group.offers.map((offer) => {
      const itemDelta = deltaLabel(offer.priceGbp, group.rrpGbp);
      const belowRrp = offer.priceGbp !== undefined && group.rrpGbp !== undefined && offer.priceGbp < group.rrpGbp;
      return <View key={offer.id} style={styles.offer}>
        <View style={{ flex: 1 }}><Text style={styles.retailer}>{offer.retailerName}</Text><Text style={styles.itemPrice}>Current item price {money(offer.priceGbp)}</Text>{itemDelta ? <Text style={belowRrp ? styles.deltaGood : styles.delta}>{itemDelta}</Text> : <Text style={styles.noDelta}>No verified RRP/reference comparison</Text>}<Text style={styles.delivery}>{offer.deliveryKnown ? `True Price ${money(offer.totalDeliveredGbp)} · delivery ${money(offer.shippingGbp)}` : 'True Price pending · delivery not yet verified; item-vs-reference comparison remains valid'}</Text>{offer.freeShippingThresholdGbp !== undefined ? <Text style={styles.collection}>Free delivery from {money(offer.freeShippingThresholdGbp)}</Text> : null}{offer.collectionAvailable ? <Text style={styles.collection}>Collection available</Text> : null}</View>
        {belowRrp ? <StatusBadge label="Below RRP" color={FateDropColors.mint} /> : offer.isLowestKnownDelivered ? <StatusBadge label="Lowest True Price" color={FateDropColors.mint} /> : null}
        {offer.productUrl ? <Pressable accessibilityLabel={`Buy at ${offer.retailerName}`} onPress={() => void openTrackedRetailerLink({ destinationUrl: offer.productUrl!, retailerId: offer.retailerId, offerId: offer.id, placement: 'fatefind' })} style={styles.buy}><Ionicons name="open-outline" size={16} color={FateDropColors.text} /></Pressable> : null}
      </View>;
    })}
    <Pressable onPress={() => router.push({ pathname: '/fate-match', params: { query: group.title } })} style={styles.fateFindButton}><Ionicons name="telescope" size={15} color={FateDropColors.violetLight} /><Text style={styles.fateFindText}>KEEP HUNTING WITH FATEFIND</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 20, paddingBottom: 80 }, back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }, backText: { color: FateDropColors.text, fontWeight: '800' },
  search: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 }, input: { flex: 1, color: FateDropColors.text }, label: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 10 }, disclaimer: { color: FateDropColors.muted, fontSize: 11, lineHeight: 17, marginBottom: 14 }, state: { color: FateDropColors.muted, textAlign: 'center', margin: 40 },
  comparePanel: { padding: 15, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: `${FateDropColors.violetLight}33`, marginBottom: 14 }, compareHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, compareEyebrow: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, compareTitle: { color: FateDropColors.text, fontSize: 18, fontWeight: '900', marginTop: 4 }, compareCopy: { color: FateDropColors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, selector: { marginTop: 12 }, selectorLabel: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', marginBottom: 6 }, selectorRow: { gap: 7, paddingRight: 8 }, selectorChip: { maxWidth: 220, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, selectorChipActive: { maxWidth: 220, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: `${FateDropColors.violetLight}88`, backgroundColor: `${FateDropColors.violet}55` }, selectorChipText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '700' }, selectorChipTextActive: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' }, compareCards: { gap: 8, marginTop: 12 }, valueCard: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, valueCardWinner: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.mint}66`, backgroundColor: `${FateDropColors.mint}0A` }, valueBasis: { color: FateDropColors.violetLight, fontSize: 7, fontWeight: '900', letterSpacing: .8 }, valueTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900', marginTop: 4, marginBottom: 8 }, valueMetric: { marginTop: 6 }, valueMetricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' }, valueMetricValue: { color: FateDropColors.text, fontSize: 12, fontWeight: '900', marginTop: 2 }, valueMetricNote: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 }, valueReference: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 9 }, verdict: { marginTop: 10, marginBottom: 14, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border }, verdictWinner: { marginTop: 10, marginBottom: 14, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.mint}55` }, verdictEyebrow: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: .8 }, verdictText: { color: FateDropColors.text, fontSize: 11, fontWeight: '900', lineHeight: 16, marginTop: 4 }, verdictNote: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 5 },
  group: { padding: 15, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 }, groupTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 }, title: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' }, meta: { color: FateDropColors.muted, fontSize: 10, marginTop: 5 }, rrpRow: { marginTop: 8 }, rrp: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' }, rrpBasis: { color: FateDropColors.cyan, fontSize: 9, marginTop: 3 }, rrpSource: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 }, rrpUnknown: { color: FateDropColors.muted, fontSize: 9, marginTop: 7 }, bookmark: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.cardElevated },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: FateDropColors.border }, retailer: { color: FateDropColors.text, fontWeight: '800' }, itemPrice: { color: FateDropColors.text, fontSize: 11, fontWeight: '800', marginTop: 4 }, delta: { color: FateDropColors.amber, fontSize: 10, fontWeight: '900', marginTop: 3 }, deltaGood: { color: FateDropColors.mint, fontSize: 10, fontWeight: '900', marginTop: 3 }, noDelta: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 }, delivery: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '700', marginTop: 6 }, collection: { color: FateDropColors.mint, fontSize: 9, marginTop: 3 }, buy: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.violet },
  fateFindButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.violetLight}44`, marginTop: 8 }, fateFindText: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '900' },
});