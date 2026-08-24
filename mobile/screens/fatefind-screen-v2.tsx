import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { fetchLiveFateFind, type FateFindOpportunity, type FateFindResult } from '@/services/fatefind-live';
import { openTrackedRetailerLink } from '@/services/outbound-links';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const money = (pence: number | null) => pence === null ? '—' : `£${(pence / 100).toFixed(2)}`;

function OfferCard({ offer, best = false }: { offer: FateFindOpportunity; best?: boolean }) {
  const buy = () => offer.url && void openTrackedRetailerLink({
    destinationUrl: offer.url,
    retailerId: offer.retailerId || 'unknown',
    offerId: offer.offerId || undefined,
    placement: best ? 'fatefind-best-value' : 'fatefind-ranked-offer',
  });
  return <View style={[styles.offer, best && styles.bestOffer]}>
    <View style={styles.offerHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rank}>{best ? 'BEST VALUE NOW' : `#${offer.rank} FATEFIND`}</Text>
        <Text style={styles.offerTitle}>{offer.productTitle}</Text>
        <Text style={styles.retailer}>{offer.retailerName || 'Connected retailer'} · {offer.stockStatus.replaceAll('_', ' ').toUpperCase()}</Text>
      </View>
      {offer.valueLabel ? <View style={styles.valuePill}><Text style={styles.valuePillText}>{offer.valueLabel}</Text></View> : null}
    </View>

    <View style={styles.prices}>
      <View><Text style={styles.priceLabel}>ITEM</Text><Text style={styles.priceValue}>{money(offer.itemPricePence)}</Text></View>
      <View><Text style={styles.priceLabel}>RRP / REF</Text><Text style={styles.priceValue}>{money(offer.rrpPence)}</Text></View>
      <View><Text style={styles.priceLabel}>DELIVERY</Text><Text style={styles.priceValue}>{offer.deliveryKnown ? money(offer.deliveryPence) : 'UNKNOWN'}</Text></View>
      <View><Text style={styles.priceLabel}>TRUE PRICE</Text><Text style={[styles.priceValue, styles.truePrice]}>{money(offer.truePricePence)}</Text></View>
    </View>

    <Text style={styles.reference}>{offer.rrpReferenceBasis || (offer.rrpResolved ? 'Verified RRP/reference' : 'Verified RRP/reference unavailable')}</Text>
    <View style={styles.offerActions}>
      <Pressable disabled={!offer.url} onPress={buy} style={[styles.buy, !offer.url && styles.disabled]}><Text style={styles.buyText}>BUY NOW ↗</Text></Pressable>
      <Pressable onPress={() => router.push({ pathname: '/fatematch', params: { query: offer.productTitle, productId: offer.productId || '' } })} style={styles.watch}><Ionicons name="notifications-outline" size={14} color={FateDropColors.violetLight} /><Text style={styles.watchText}>LET ME KNOW WHEN IN STOCK</Text></Pressable>
    </View>
  </View>;
}

export default function FateFindScreenV2() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const initialQuery = first(params.query) || '';
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<FateFindResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (value = query) => {
    const q = value.trim();
    if (q.length < 2) { setError('Enter at least two characters.'); return; }
    setLoading(true); setError(null);
    try { setResult(await fetchLiveFateFind(q)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'FateFind could not load.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (initialQuery.trim().length >= 2) void run(initialQuery); }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const best = result?.bestOpportunity || null;
  const rest = result?.rankedOffers.filter((offer) => offer.rank !== 1) || [];

  return <SafeAreaView style={styles.safe}>
    <FateDropBackground />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
      <AbstractHero eyebrow="FateFind" title="Find the best value available now." subtitle="FateDrop checks the live network, compares valid configurations against the correct RRP/reference and ranks the strongest buying opportunity. It does not simply pick the smallest £ number." icon="telescope" />

      <View style={styles.search}>
        <Ionicons name="search" size={17} color={FateDropColors.muted} />
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void run()} placeholder="e.g. Destined Rivals booster packs" placeholderTextColor={FateDropColors.muted} style={styles.input} returnKeyType="search" />
        <Pressable onPress={() => void run()} style={styles.findButton}><Text style={styles.findButtonText}>FIND</Text></Pressable>
      </View>

      {loading ? <View style={styles.state}><ActivityIndicator color={FateDropColors.violetLight} /><Text style={styles.stateText}>Comparing live network value…</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && result && !best ? <View style={styles.empty}><Text style={styles.emptyTitle}>No live FateFind opportunity</Text><Text style={styles.emptyCopy}>No matching in-stock offer is currently available. You can create a FateMatch and let your companion watch for it.</Text><Pressable onPress={() => router.push({ pathname: '/fatematch', params: { query } })} style={styles.watchWide}><Text style={styles.watchText}>LET ME KNOW WHEN THIS IS IN STOCK →</Text></Pressable></View> : null}

      {best ? <>
        <Text style={styles.section}>FATEFIND RESULT</Text>
        <OfferCard offer={best} best />
        {result?.comparisonStatus === 'ranked_without_rrp' ? <Text style={styles.caution}>A verified RRP/reference was unavailable for the leading result, so FateDrop is not presenting it as an RRP-value winner.</Text> : null}
        {rest.length ? <><Text style={styles.section}>OTHER LIVE OPTIONS</Text>{rest.map((offer) => <OfferCard key={offer.offerId || `${offer.productId}:${offer.rank}`} offer={offer} />)}</> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 90 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }, backText: { color: FateDropColors.text, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 52, paddingHorizontal: 13, marginBottom: 14, borderRadius: 16, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  input: { flex: 1, color: FateDropColors.text, fontSize: 13 }, findButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, backgroundColor: FateDropColors.violet }, findButtonText: { color: FateDropColors.text, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 18 }, stateText: { color: FateDropColors.secondary, fontSize: 10 },
  error: { color: FateDropColors.coral, fontSize: 10, marginBottom: 12 }, section: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginTop: 11, marginBottom: 8 },
  offer: { padding: 15, marginBottom: 9, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  bestOffer: { borderColor: `${FateDropColors.mint}55`, backgroundColor: `${FateDropColors.mint}08` },
  offerHead: { flexDirection: 'row', gap: 10 }, rank: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 }, offerTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900', marginTop: 4 }, retailer: { color: FateDropColors.secondary, fontSize: 8, marginTop: 4 },
  valuePill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: `${FateDropColors.mint}12`, borderWidth: 1, borderColor: `${FateDropColors.mint}35` }, valuePillText: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900' },
  prices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 }, priceLabel: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: .7 }, priceValue: { color: FateDropColors.text, fontSize: 11, fontWeight: '900', marginTop: 3 }, truePrice: { color: FateDropColors.cyan },
  reference: { color: FateDropColors.muted, fontSize: 8, lineHeight: 13, marginTop: 10 },
  offerActions: { flexDirection: 'row', gap: 7, marginTop: 12 }, buy: { flex: .8, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12, backgroundColor: FateDropColors.violet }, buyText: { color: FateDropColors.text, fontSize: 8, fontWeight: '900' }, watch: { flex: 1.2, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, watchText: { color: FateDropColors.text, fontSize: 7, fontWeight: '900', textAlign: 'center' },
  empty: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, emptyTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 15, marginTop: 5 }, watchWide: { marginTop: 12, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.violetLight}40` },
  caution: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginBottom: 8 }, disabled: { opacity: .4 },
});
