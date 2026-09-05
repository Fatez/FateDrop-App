import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FATEDROP_WEB_URL, SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { useTcgCapabilities } from '@/contexts/tcg-capabilities-context';
import { rrpBasisLabel } from '@/lib/value-compare';
import { fetchCanonicalLiveOpportunities, type CanonicalMobileAlert } from '@/services/canonical-alerts';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { LocalWishlistRepository } from '@/services/wishlist';
import type {
  FatePairVerdict,
  FateRankVerdict,
  FateVerdictPosition,
  FateVerdictResponse,
  TruePriceGroup,
  TruePriceOffer,
  TruePriceResponse,
} from '@/types/true-price';

type SortMode = 'item' | 'delivered';
type BestDeal = { alert: CanonicalMobileAlert; deliveredPence: number; rrpPence: number; deltaPercent: number };
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
function bestDealStatus(deltaPercent: number) {
  if (deltaPercent < -0.05) return { label: 'UNDER RRP', color: FateDropColors.mint };
  if (Math.abs(deltaPercent) <= 0.05) return { label: 'AT RRP', color: FateDropColors.mint };
  if (deltaPercent <= 5) return { label: 'GREAT DEAL', color: FateDropColors.goldBright };
  if (deltaPercent <= 10) return { label: '+5–10% OVER', color: FateDropColors.amber };
  return { label: 'PREMIUM', color: FateDropColors.muted };
}

async function parseVerdictResponse(response: Response) {
  if (!response.ok) return null;
  const data = await response.json().catch(() => null) as FateVerdictResponse | null;
  if (!data || data.mode !== 'verdict' || data.source !== 'FATEDROP_CLOUD') return null;
  return data;
}

async function requestCloudVerdict(query: string, tcgCode: TcgCode, leftId?: string, rightId?: string) {
  const pair = leftId && rightId ? { leftId, rightId } : {};

  // Primary path: the FateDrop Cloud engine owns the canonical verdict.
  try {
    const response = await fetch(`${SIGNAL_ENGINE_URL}/api/fatefind/matches`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'verdict', query, tcgCode, ...pair }),
    });
    const direct = await parseVerdictResponse(response);
    if (direct) return direct;
  } catch {
    // Fall through to the shared Web compatibility gateway.
  }

  // Compatibility path: same Cloud evidence and locked server-side rules, never a phone-side winner.
  try {
    const response = await fetch(`${FATEDROP_WEB_URL}/api/fatefind/verdict`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, tcgCode, ...pair }),
    });
    const gateway = await parseVerdictResponse(response);
    if (gateway) return gateway;
  } catch {
    // The caller will fall back to live Cloud groups without inventing a verdict.
  }

  throw new Error('fatefind-cloud-unavailable');
}

async function requestLiveComparisonGroups(query: string, tcgCode: TcgCode) {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/true-price?q=${encodeURIComponent(query)}&tcg=${encodeURIComponent(tcgCode)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('fatefind-live-comparison-unavailable');
  const data = await response.json() as TruePriceResponse;
  if (data.success !== true || !Array.isArray(data.groups)) throw new Error('fatefind-live-comparison-invalid');
  return data.groups;
}

export default function FateFindLiveScreenV2() {
  const params = useLocalSearchParams<{ query?: string | string[]; tcg?: string | string[] }>();
  const { snapshot } = useFateDropId();
  const { capabilityFor } = useTcgCapabilities();
  const incomingQuery = firstParam(params.query) || '';
  const incomingTcg = firstParam(params.tcg);
  const selectedTcgCodes = useMemo<TcgCode[]>(() => snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences.selectedTcgCodes]);
  const [query, setQuery] = useState(incomingQuery);
  const [tcgCode, setTcgCode] = useState<TcgCode>('pokemon');
  const [groups, setGroups] = useState<TruePriceGroup[]>([]);
  const [verdict, setVerdict] = useState<FateRankVerdict | null>(null);
  const [pairVerdict, setPairVerdict] = useState<FatePairVerdict | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cloudNotice, setCloudNotice] = useState('');
  const [canonicalAvailable, setCanonicalAvailable] = useState(true);
  const [sort, setSort] = useState<SortMode>('item');
  const [saved, setSaved] = useState<string[]>([]);
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [liveDealAlerts, setLiveDealAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [bestDealsLoading, setBestDealsLoading] = useState(false);

  useEffect(() => { if (incomingQuery) setQuery(incomingQuery); }, [incomingQuery]);
  useEffect(() => {
    const requested = isTcgCode(incomingTcg) && selectedTcgCodes.includes(incomingTcg) ? incomingTcg : null;
    setTcgCode((current) => requested ?? (selectedTcgCodes.includes(current) ? current : selectedTcgCodes[0]));
  }, [incomingTcg, selectedTcgCodes]);
  useFocusEffect(useCallback(() => { void wishlist.list().then((items) => setSaved(items.filter((item) => item.targetType === 'PRODUCT').map((item) => item.targetId))); }, []));
  useFocusEffect(useCallback(() => {
    let active = true;
    setBestDealsLoading(true);
    void fetchCanonicalLiveOpportunities(50)
      .then((alerts) => { if (active) setLiveDealAlerts(alerts); })
      .catch(() => { if (active) setLiveDealAlerts([]); })
      .finally(() => { if (active) setBestDealsLoading(false); });
    return () => { active = false; };
  }, []));

  const tcgDefinition = TCG_REGISTRY.find((entry) => entry.code === tcgCode) ?? TCG_REGISTRY[0];
  const tcgCapability = capabilityFor(tcgCode);

  useEffect(() => {
    const clean = query.trim();
    if (!tcgCapability.browseEnabled) {
      setGroups([]);
      setVerdict(null);
      setPairVerdict(null);
      setError('');
      setCloudNotice(`${tcgDefinition.shortName} is saved as an interest. FateFind stays inactive until its canonical catalogue and retailer evidence are verified.`);
      setCanonicalAvailable(false);
      return;
    }
    if (clean.length < 2) {
      setGroups([]);
      setVerdict(null);
      setPairVerdict(null);
      setError('');
      setCloudNotice('');
      setCanonicalAvailable(true);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      setCloudNotice('');
      try {
        const data = await requestCloudVerdict(clean, tcgCode);
        setGroups(data.groups);
        setVerdict(data.verdict);
        setPairVerdict(null);
        setCanonicalAvailable(true);
        setCloudNotice(data.notice || 'Canonical FateDrop Cloud verdict is live.');
      } catch {
        try {
          const liveGroups = await requestLiveComparisonGroups(clean, tcgCode);
          setGroups(liveGroups);
          setVerdict(null);
          setPairVerdict(null);
          setCanonicalAvailable(false);
          setCloudNotice('Live FateFind results are available from FateDrop Cloud. The canonical verdict contract is still rolling out, so FateDrop will keep retrying Cloud directly and the shared gateway without inventing a winner on this device.');
        } catch {
          setGroups([]);
          setVerdict(null);
          setPairVerdict(null);
          setCanonicalAvailable(false);
          setError('FateFind could not reach the live FateDrop comparison feed.');
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, tcgCode, tcgCapability.browseEnabled, tcgDefinition.shortName]);

  useEffect(() => {
    const options = groups.filter((group) => group.offers.length > 0);
    if (options.length < 2) {
      const only = options[0]?.id ?? '';
      if (compareLeftId !== only) setCompareLeftId(only);
      if (compareRightId) setCompareRightId('');
      return;
    }

    const nextLeft = options.some((group) => group.id === compareLeftId) ? compareLeftId : options[0].id;
    const nextRight = options.some((group) => group.id === compareRightId) && compareRightId !== nextLeft
      ? compareRightId
      : (options.find((group) => group.id !== nextLeft)?.id ?? '');

    if (nextLeft !== compareLeftId) setCompareLeftId(nextLeft);
    if (nextRight !== compareRightId) setCompareRightId(nextRight);
  }, [groups, compareLeftId, compareRightId]);

  useEffect(() => {
    const clean = query.trim();
    if (!tcgCapability.browseEnabled || clean.length < 2 || !compareLeftId || !compareRightId) {
      setPairVerdict(null);
      setPairError('');
      setPairLoading(false);
      return;
    }
    if (compareLeftId === compareRightId) {
      setPairVerdict(null);
      setPairError('Choose two different products to run a Fate Verdict.');
      setPairLoading(false);
      return;
    }

    let active = true;
    setPairLoading(true);
    setPairError('');
    void requestCloudVerdict(clean, tcgCode, compareLeftId, compareRightId)
      .then((data) => {
        if (!active) return;
        if (!data.pairVerdict) throw new Error('fatefind-cloud-pair-verdict-missing');
        setPairVerdict(data.pairVerdict);
        setCanonicalAvailable(true);
        setCloudNotice(data.notice || 'Canonical FateDrop Cloud verdict is live.');
      })
      .catch(() => {
        if (!active) return;
        setPairVerdict(null);
        setPairError('FateDrop Cloud could not return this head-to-head verdict yet. Live offers remain available and no winner is being invented locally.');
      })
      .finally(() => { if (active) setPairLoading(false); });
    return () => { active = false; };
  }, [query, tcgCode, tcgCapability.browseEnabled, compareLeftId, compareRightId]);

  const displayed = useMemo(() => groups.map((group) => ({ ...group, offers: sortedOffers(group.offers, sort) })), [groups, sort]);
  const compareOptions = useMemo(() => displayed.filter((group) => group.offers.length > 0), [displayed]);
  const bestDeals = useMemo<BestDeal[]>(() => {
    const byProduct = new Map<string, BestDeal>();
    for (const alert of liveDealAlerts) {
      if (alert.tcgCode !== tcgCode) continue;
      const deliveredPence = alert.product.deliveredPricePence;
      const rrpPence = alert.product.rrpPence ?? alert.priceIntelligence.rrpPence;
      if (!Number.isFinite(deliveredPence) || !Number.isFinite(rrpPence) || !deliveredPence || !rrpPence || rrpPence <= 0) continue;
      const deltaPercent = percentDelta(deliveredPence, rrpPence);
      const next = { alert, deliveredPence, rrpPence, deltaPercent };
      const existing = byProduct.get(alert.productId);
      if (!existing || deltaPercent < existing.deltaPercent || (deltaPercent === existing.deltaPercent && deliveredPence < existing.deliveredPence)) byProduct.set(alert.productId, next);
    }
    return [...byProduct.values()].sort((a, b) => a.deltaPercent - b.deltaPercent || a.deliveredPence - b.deliveredPence).slice(0, 5);
  }, [liveDealAlerts, tcgCode]);
  const chooseLeft = (id: string) => {
    if (id === compareRightId) return;
    setCompareLeftId(id);
  };
  const chooseRight = (id: string) => {
    if (id === compareLeftId) return;
    setCompareRightId(id);
  };

  const toggleProduct = async (group: TruePriceGroup) => {
    const id = `product:${group.id}`;
    if (saved.includes(group.id)) { await wishlist.remove(id); setSaved((current) => current.filter((value) => value !== group.id)); }
    else { await wishlist.save({ id, targetType: 'PRODUCT', targetId: group.id, label: group.title, alertsEnabled: false, createdAt: new Date().toISOString() }); setSaved((current) => [...current, group.id]); }
  };

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
    <AbstractHero eyebrow="FateFind" title="Find the right deal now. Keep hunting if it is not there yet." subtitle="FateFind is FateDrop's intelligent value finder. It combines verified RRP/reference maths with visible True Price, returns one Cloud Fate Verdict, and can keep searching under your conditions until a qualifying offer becomes a FateMatch." icon="telescope" />
    <Text style={styles.label}>Trading card game</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>{TCG_REGISTRY.filter((entry) => selectedTcgCodes.includes(entry.code)).map((entry) => <FilterChip key={entry.code} label={`${entry.shortName}${capabilityFor(entry.code).browseEnabled ? '' : ' · soon'}`} active={tcgCode === entry.code} onPress={() => setTcgCode(entry.code)} />)}</ScrollView>
    <View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search a product to compare" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View>
    {displayed.length === 0 ? <BestDealsPanel deals={bestDeals} loading={bestDealsLoading} /> : null}
    <Text style={styles.label}>Sort offers</Text>
    <View style={styles.sorts}><FilterChip label="Item price" active={sort === 'item'} onPress={() => setSort('item')} /><FilterChip label="True Price" active={sort === 'delivered'} onPress={() => setSort('delivered')} /></View>
    <Text style={styles.disclaimer}>RRP/reference percentage shows whether the item price is fair against the verified value baseline. True Price shows what you will actually pay when mandatory delivery/fees are known. Unknown delivery never becomes £0. FateDrop Cloud owns the ranking and Fate Verdict.</Text>
    {cloudNotice ? <View style={styles.cloudNotice}><Ionicons name={canonicalAvailable ? 'cloud-done-outline' : 'cloud-offline-outline'} size={16} color={FateDropColors.goldBright} /><Text style={styles.cloudNoticeText}>{cloudNotice}</Text></View> : null}
    <CloudVerdictSummary groups={displayed} verdict={verdict} />
    <MobileValueCompare groups={compareOptions} leftId={compareLeftId} rightId={compareRightId} onLeft={chooseLeft} onRight={chooseRight} result={pairVerdict} loading={pairLoading} error={pairError} />
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground /><FlatList data={displayed} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={header} ListEmptyComponent={loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : <Text style={styles.state}>{error || 'Search at least two characters to run FateFind across the live database.'}</Text>} ListFooterComponent={displayed.length ? <BestDealsPanel deals={bestDeals} loading={bestDealsLoading} /> : null} renderItem={({ item }) => <ComparisonGroup group={item} saved={saved.includes(item.id)} onToggle={() => void toggleProduct(item)} />} /></SafeAreaView>;
}

function BestDealsPanel({ deals, loading }: { deals: BestDeal[]; loading: boolean }) {
  return <View style={styles.bestDealsPanel}>
    <View style={styles.bestDealsHead}>
      <View style={{ flex: 1 }}><Text style={styles.bestDealsEyebrow}>BEST DEALS RIGHT NOW</Text><Text style={styles.bestDealsTitle}>Closest to retail price across FateDrop</Text><Text style={styles.bestDealsCopy}>Current Manifested offers only · ranked by delivered price against verified RRP.</Text></View>
      <Ionicons name="sparkles" size={20} color={FateDropColors.goldBright} />
    </View>
    {loading ? <View style={styles.bestDealsState}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.bestDealsStateText}>Checking live deals…</Text></View> : deals.length ? deals.map((deal, index) => {
      const status = bestDealStatus(deal.deltaPercent);
      return <View key={`${deal.alert.productId}:${deal.alert.offerId}`} style={styles.bestDealRow}>
        <Text style={styles.bestDealRank}>{index + 1}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bestDealProduct} numberOfLines={2}>{deal.alert.product.title || deal.alert.title}</Text>
          <Text style={styles.bestDealRetailer}>{deal.alert.retailer}</Text>
          <Text style={styles.bestDealPrice}>{money(deal.deliveredPence / 100)} delivered</Text>
          <Text style={styles.bestDealRrp}>RRP {money(deal.rrpPence / 100)} · {percentLabel(deal.deltaPercent)}</Text>
        </View>
        <View style={styles.bestDealAction}>
          <StatusBadge label={status.label} color={status.color} />
          <Pressable accessibilityLabel={`Open deal at ${deal.alert.retailer}`} onPress={() => void openTrackedRetailerLink({ destinationUrl: deal.alert.productUrl, retailerId: deal.alert.retailerId, offerId: deal.alert.offerId, placement: 'fatefind' })} style={styles.bestDealOpen}><Text style={styles.bestDealOpenText}>FATEFIND →</Text></Pressable>
        </View>
      </View>;
    }) : <Text style={styles.bestDealsEmpty}>No current Manifested offers have both verified RRP and delivered-cost evidence right now.</Text>}
  </View>;
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
  if (groups.length < 2) return null;
  const leftGroup = groups.find((group) => group.id === leftId) ?? groups[0];
  const rightGroup = groups.find((group) => group.id === rightId) ?? groups.find((group) => group.id !== leftGroup.id) ?? groups[1];
  const winner = result?.winnerId ? groups.find((group) => group.id === result.winnerId) : undefined;

  return <View style={styles.comparePanel}>
    <View style={styles.compareHead}><View style={{ flex: 1 }}><Text style={styles.compareEyebrow}>FATEFIND COMPARE · CLOUD</Text><Text style={styles.compareTitle}>Compare two items</Text><Text style={styles.compareCopy}>Choose two different matched products. FateDrop Cloud returns the head-to-head using the locked Fate Verdict rules; the phone never calculates a winner.</Text></View>{winner ? <StatusBadge label="Best value" color={FateDropColors.mint} /> : null}</View>
    <CompareSelector label="ITEM A" groups={groups} selectedId={leftGroup.id} excludedId={rightGroup.id} onSelect={onLeft} />
    <CompareSelector label="ITEM B" groups={groups} selectedId={rightGroup.id} excludedId={leftGroup.id} onSelect={onRight} />
    {loading ? <View style={styles.compareState}><ActivityIndicator color={FateDropColors.violetLight} /><Text style={styles.compareStateText}>Asking FateDrop Cloud for the head-to-head verdict…</Text></View> : result ? <>
      <View style={styles.compareCards}>
        <ValueCard group={leftGroup} position={result.left} winnerId={result.winnerId} />
        <ValueCard group={rightGroup} position={result.right} winnerId={result.winnerId} />
      </View>
      <View style={winner ? styles.verdictWinner : styles.verdict}>
        <Text style={styles.verdictEyebrow}>{winner ? 'FATE VERDICT' : 'FATEDROP NEEDS MORE EVIDENCE'}</Text>
        <Text style={styles.verdictText}>{result.reason}</Text>
        <Text style={styles.verdictNote}>{result.left?.provisional || result.right?.provisional ? 'RRP value remains valid from item price, but at least one final True Price is still provisional.' : 'Both selected offers have known delivery, so True Price can be compared alongside the RRP value verdict.'}</Text>
      </View>
    </> : error ? <View style={styles.compareError}><Ionicons name="cloud-offline-outline" size={17} color={FateDropColors.goldBright} /><Text style={styles.compareErrorText}>{error}</Text></View> : null}
  </View>;
}

function CompareSelector({ label, groups, selectedId, excludedId, onSelect }: { label: string; groups: TruePriceGroup[]; selectedId: string; excludedId: string; onSelect: (id: string) => void }) {
  const selected = groups.find((group) => group.id === selectedId);
  const alternatives = groups.filter((group) => group.id !== selectedId && group.id !== excludedId);
  return <View style={styles.selector}>
    <Text style={styles.selectorLabel}>{label}</Text>
    {selected ? <View style={styles.selectorSelected}><Text style={styles.selectorSelectedTitle} numberOfLines={2}>{selected.title}</Text><Text style={styles.selectorSelectedMeta}>SELECTED</Text></View> : null}
    {alternatives.length ? <><Text style={styles.selectorChange}>CHANGE TO</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>{alternatives.map((group) => <Pressable key={`${label}-${group.id}`} onPress={() => onSelect(group.id)} style={styles.selectorChip}><Text numberOfLines={2} style={styles.selectorChipText}>{group.title}</Text></Pressable>)}</ScrollView></> : null}
  </View>;
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
  bestDealsPanel: { padding: 15, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: `${FateDropColors.gold}0A`, marginBottom: 14 }, bestDealsHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 5 }, bestDealsEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, bestDealsTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 4 }, bestDealsCopy: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 }, bestDealsState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 }, bestDealsStateText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '800' }, bestDealsEmpty: { color: FateDropColors.muted, fontSize: 10, lineHeight: 15, paddingVertical: 13 }, bestDealRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: FateDropColors.border }, bestDealRank: { width: 20, color: FateDropColors.goldBright, fontSize: 16, fontWeight: '900' }, bestDealProduct: { color: FateDropColors.text, fontSize: 11, lineHeight: 15, fontWeight: '900' }, bestDealRetailer: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 }, bestDealPrice: { color: FateDropColors.text, fontSize: 12, fontWeight: '900', marginTop: 5 }, bestDealRrp: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '800', marginTop: 3 }, bestDealAction: { alignItems: 'flex-end', gap: 8 }, bestDealOpen: { paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: `${FateDropColors.violetLight}44` }, bestDealOpenText: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900' },
  cloudNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: `${FateDropColors.gold}0B`, marginBottom: 14 }, cloudNoticeText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  comparePanel: { padding: 15, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: `${FateDropColors.violetLight}33`, marginBottom: 14 }, compareHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, compareEyebrow: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, compareTitle: { color: FateDropColors.text, fontSize: 18, fontWeight: '900', marginTop: 4 }, compareCopy: { color: FateDropColors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  selector: { marginTop: 14 }, selectorLabel: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', marginBottom: 6 }, selectorSelected: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.violetLight}66`, backgroundColor: `${FateDropColors.violet}28`, justifyContent: 'center' }, selectorSelectedTitle: { color: FateDropColors.text, fontSize: 11, lineHeight: 15, fontWeight: '900' }, selectorSelectedMeta: { color: FateDropColors.violetLight, fontSize: 7, fontWeight: '900', letterSpacing: .8, marginTop: 5 }, selectorChange: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .7, marginTop: 8, marginBottom: 5 }, selectorRow: { gap: 7, paddingRight: 8 }, selectorChip: { width: 190, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated, justifyContent: 'center' }, selectorChipText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  compareState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 22 }, compareStateText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '700' }, compareError: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: `${FateDropColors.gold}08` }, compareErrorText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  compareCards: { gap: 8, marginTop: 12 }, valueCard: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, valueCardWinner: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.mint}66`, backgroundColor: `${FateDropColors.mint}0A` }, valueBasis: { color: FateDropColors.violetLight, fontSize: 7, fontWeight: '900', letterSpacing: .8 }, valueTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900', marginTop: 4, marginBottom: 8 }, valueMetric: { marginTop: 6 }, valueMetricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' }, valueMetricValue: { color: FateDropColors.text, fontSize: 12, fontWeight: '900', marginTop: 2 }, valueMetricNote: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 }, valueReference: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 9 }, verdict: { marginTop: 10, marginBottom: 14, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border }, verdictWinner: { marginTop: 10, marginBottom: 14, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.mint}55` }, verdictEyebrow: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: .8 }, verdictText: { color: FateDropColors.text, fontSize: 11, fontWeight: '900', lineHeight: 16, marginTop: 4 }, verdictNote: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 5 },
  group: { padding: 15, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 }, groupTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 }, title: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' }, meta: { color: FateDropColors.muted, fontSize: 10, marginTop: 5 }, rrpRow: { marginTop: 8 }, rrp: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' }, rrpBasis: { color: FateDropColors.cyan, fontSize: 9, marginTop: 3 }, rrpSource: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 }, rrpUnknown: { color: FateDropColors.muted, fontSize: 9, marginTop: 7 }, bookmark: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.cardElevated },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: FateDropColors.border }, retailer: { color: FateDropColors.text, fontWeight: '800' }, itemPrice: { color: FateDropColors.text, fontSize: 11, fontWeight: '800', marginTop: 4 }, delta: { color: FateDropColors.amber, fontSize: 10, fontWeight: '900', marginTop: 3 }, deltaGood: { color: FateDropColors.mint, fontSize: 10, fontWeight: '900', marginTop: 3 }, noDelta: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 }, delivery: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '700', marginTop: 6 }, collection: { color: FateDropColors.mint, fontSize: 9, marginTop: 3 }, buy: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.violet },
  fateFindButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.violetLight}44`, marginTop: 8 }, fateFindText: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '900' },
});