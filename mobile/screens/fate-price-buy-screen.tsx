import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';
import { FateDropColors, Fonts } from '@/constants/theme';
import { safeExternalHttpsUrl } from '@/lib/external-url-security';
import {
  FateMarketApiError,
  fetchFatePrice,
  fetchFatePriceRetailOffers,
  type FatePriceCard,
  type FatePriceRetailOffer,
  type FatePriceRetailSnapshot,
  type FatePriceSnapshot,
} from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(value);
}

function pretty(value: string | null | undefined) {
  const clean = String(value || '').trim();
  if (!clean || clean === 'unspecified') return 'Not specified';
  return clean.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortTime(value: number | null) {
  if (!value) return 'Verification time unavailable';
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function comparisonAccent(status: FatePriceRetailOffer['comparison']['status']) {
  if (status === 'good_price') return FateDropColors.success;
  if (status === 'high_price') return FateDropColors.vanished;
  if (status === 'fair_price') return FateDropColors.goldBright;
  return FateDropColors.muted;
}

function comparisonReason(offer: FatePriceRetailOffer) {
  if (offer.comparison.status !== 'unavailable') {
    const difference = offer.comparison.differencePercent;
    if (difference == null || difference === 0) return 'Delivered total sits on the exact card’s central FatePrice.';
    return `${Math.abs(difference).toFixed(1)}% ${difference < 0 ? 'below' : 'above'} the exact card’s central FatePrice.`;
  }
  if (offer.comparison.reason === 'DELIVERED_PRICE_UNKNOWN') return 'Postage is not verified, so FateDrop will not judge an incomplete total.';
  if (offer.comparison.reason === 'FATE_PRICE_CONFIDENCE_TOO_LOW') return 'The exact FatePrice confidence is not high enough for a retailer verdict.';
  if (offer.comparison.reason === 'FAIR_RANGE_UNAVAILABLE') return 'The exact card does not have a verified fair range yet.';
  if (offer.comparison.reason === 'COMPARISON_CURRENCY_MISMATCH') return 'The retailer total and FatePrice are not in the same verified currency.';
  return 'There is not enough exact evidence to compare this offer safely.';
}

export default function FatePriceBuyScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    collectorNumber?: string | string[];
    name?: string | string[];
    setName?: string | string[];
  }>();
  const cardId = first(params.cardId)?.trim() || '';
  const routeName = first(params.name)?.trim() || 'Exact card';
  const routeSetName = first(params.setName)?.trim() || 'Verified set';
  const routeNumber = first(params.collectorNumber)?.trim() || '';
  const [card, setCard] = useState<FatePriceCard | null>(null);
  const [retail, setRetail] = useState<FatePriceRetailSnapshot | null>(null);
  const [price, setPrice] = useState<FatePriceSnapshot | null>(null);
  const [retailer, setRetailer] = useState('all');
  const [condition, setCondition] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (force = false) => {
    if (!cardId) {
      setNotice('Choose an exact card before checking retailers.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice('');
    const [retailResult, priceResult] = await Promise.allSettled([
      fetchFatePriceRetailOffers(cardId, { force }),
      fetchFatePrice(cardId, { force }),
    ]);
    if (retailResult.status === 'fulfilled') {
      setCard(retailResult.value.card);
      setRetail(retailResult.value.retail);
    } else {
      setRetail(null);
      setNotice(retailResult.reason instanceof FateMarketApiError ? retailResult.reason.message : 'Retailer availability is temporarily unavailable.');
    }
    if (priceResult.status === 'fulfilled') setPrice(priceResult.value);
    else setPrice(null);
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retailerOptions = useMemo(() => [...new Set((retail?.offers || []).map((offer) => offer.retailerName))].sort(), [retail?.offers]);
  const conditionOptions = useMemo(() => [...new Set((retail?.offers || []).map((offer) => offer.conditionCode).filter((value): value is string => Boolean(value)))].sort(), [retail?.offers]);
  const offers = useMemo(() => (retail?.offers || []).filter((offer) => (
    (retailer === 'all' || offer.retailerName === retailer)
    && (condition === 'all' || offer.conditionCode === condition)
  )), [condition, retail?.offers, retailer]);
  const title = card?.name || routeName;
  const setName = card?.setName || routeSetName;
  const collectorNumber = card?.collectorNumber || routeNumber;

  const openOffer = useCallback(async (offer: FatePriceRetailOffer) => {
    const url = safeExternalHttpsUrl(offer.url);
    if (!url) {
      setNotice('This retailer link did not pass FateDrop’s safe-link check.');
      return;
    }
    await Linking.openURL(url);
  }, []);

  const openExactPrice = useCallback(() => {
    router.push({ pathname: '/fate-price', params: { cardId, collectorNumber, name: title, setName } });
  }, [cardId, collectorNumber, setName, title]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FatePriceScreenBackground sceneKey={`buy:${cardId}`} />
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true)} tintColor={FateDropColors.goldBright} />}
    >
      <FatePriceTopBar step={5} backLabel="Exact card" />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FATEPRICE · RETAILER NETWORK</Text>
        <Text style={styles.title}>Where to buy.</Text>
        <Text style={styles.copy}>Live exact-card listings from monitored retailers, judged against FatePrice using the delivered total—not the tempting little number before postage.</Text>
      </View>

      <View style={styles.cardPanel}>
        <FatePriceCardGlyph collectorNumber={collectorNumber} />
        <View style={styles.cardCopy}><Text style={styles.cardName}>{title}</Text><Text style={styles.cardMeta}>{setName} · #{collectorNumber || '—'}</Text><Text style={styles.cardVariant}>{pretty(card?.variantCode)} · {(card?.languageCode || '—').toUpperCase()} · {card?.rarity || 'Rarity not supplied'}</Text></View>
        <View style={styles.priceBlock}><Text style={styles.priceLabel}>FATEPRICE</Text><Text style={styles.priceValue}>{money(price?.price?.amount)}</Text><Text style={styles.fairRange}>{price?.price ? `${money(price.price.fairLow)}–${money(price.price.fairHigh)}` : 'Fair range unknown'}</Text></View>
      </View>

      <View style={styles.tabs}>
        <View style={[styles.tab, styles.tabActive]}><Text style={[styles.tabText, styles.tabTextActive]}>BUY NOW</Text><View style={styles.tabGem} /></View>
        <Pressable onPress={openExactPrice} style={styles.tab}><Text style={styles.tabText}>PRICE HISTORY</Text></Pressable>
        <Pressable onPress={openExactPrice} style={styles.tab}><Text style={styles.tabText}>MARKET DATA</Text></Pressable>
      </View>

      <View style={styles.filterHeader}><Text style={styles.filterEyebrow}>LIVE VERIFIED OFFERS</Text><Text style={styles.offerCount}>{offers.length} FOUND</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        <FilterChip label="All retailers" active={retailer === 'all'} onPress={() => setRetailer('all')} />
        {retailerOptions.map((value) => <FilterChip key={value} label={value} active={retailer === value} onPress={() => setRetailer(value)} />)}
      </ScrollView>
      {conditionOptions.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conditionRail}>
        <FilterChip label="All conditions" active={condition === 'all'} onPress={() => setCondition('all')} />
        {conditionOptions.map((value) => <FilterChip key={value} label={pretty(value)} active={condition === value} onPress={() => setCondition(value)} />)}
      </ScrollView> : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {loading && !retail ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Checking monitored retailers…</Text></View> : null}
      {!loading && retail?.status !== 'available' ? <View style={styles.empty}>
        <View style={styles.emptyOrbit}><Ionicons name="storefront-outline" size={30} color={FateDropColors.goldBright} /></View>
        <Text style={styles.emptyTitle}>No verified live single right now.</Text>
        <Text style={styles.emptyCopy}>FateDrop found no fresh, exact-identity retailer mapping that passed stock and retailer-health checks. Similar-looking cards are deliberately excluded.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fatefind', params: { query: title } })} style={styles.findButton}><Ionicons name="compass-outline" size={16} color="#080B14" /><Text style={styles.findButtonText}>OPEN FATEFIND</Text></Pressable>
      </View> : null}
      {offers.length ? <View style={styles.offerStack}>{offers.map((offer) => <OfferCard key={offer.offerId} offer={offer} onOpen={() => void openOffer(offer)} />)}</View> : null}

      <FatePriceTruth title="Asking price is not market truth.">Retail listings stay a separate live availability signal. FatePrice comes from verified market evidence; the Cloud compares each delivered retailer total without feeding that shop price back into valuation.</FatePriceTruth>
    </ScrollView>
  </SafeAreaView>;
}

function OfferCard({ offer, onOpen }: { offer: FatePriceRetailOffer; onOpen: () => void }) {
  const accent = comparisonAccent(offer.comparison.status);
  return <View style={styles.offerCard}>
    <View style={styles.offerTop}>
      <View style={styles.retailerMark}><Ionicons name="storefront-outline" size={19} color={FateDropColors.goldBright} /></View>
      <View style={styles.offerTitleWrap}><Text style={styles.retailerName}>{offer.retailerName}</Text><Text numberOfLines={2} style={styles.offerTitle}>{offer.title}</Text></View>
      <View style={[styles.verdict, { borderColor: accent }]}><View style={[styles.verdictDot, { backgroundColor: accent }]} /><Text style={[styles.verdictText, { color: accent }]}>{offer.comparison.label.toUpperCase()}</Text></View>
    </View>
    <View style={styles.priceLedger}>
      <PriceCell label="ITEM" value={money(offer.itemPrice)} />
      <View style={styles.priceDivider} />
      <PriceCell label="POSTAGE" value={offer.deliveryKnown ? money(offer.postage) : 'UNKNOWN'} />
      <View style={styles.priceDivider} />
      <PriceCell label="DELIVERED TOTAL" value={money(offer.deliveredPrice)} strong />
    </View>
    <View style={styles.comparisonLine}><Ionicons name="analytics-outline" size={15} color={accent} /><Text style={styles.comparisonCopy}>{comparisonReason(offer)}</Text></View>
    <View style={styles.offerFooter}>
      <View style={styles.stockCopy}><Text style={styles.stock}>{pretty(offer.stockStatus).toUpperCase()} · {pretty(offer.conditionCode).toUpperCase()}</Text><Text style={styles.verifiedAt}>Verified {shortTime(offer.lastVerifiedAt)}</Text></View>
      <Pressable accessibilityRole="link" onPress={onOpen} style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}><Text style={styles.viewButtonText}>VIEW STORE</Text><Ionicons name="open-outline" size={14} color="#080B14" /></Pressable>
    </View>
  </View>;
}

function PriceCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.priceCell}><Text style={styles.priceCellLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.priceCellValue, strong && styles.priceCellValueStrong]}>{value}</Text></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 7, paddingBottom: 126 },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  hero: { minHeight: 180, justifyContent: 'center', paddingRight: '31%', paddingVertical: 12 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 35, lineHeight: 39, marginTop: 8, textShadowColor: 'rgba(0,0,0,.95)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 8 },
  cardPanel: { minHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', borderRadius: 15, backgroundColor: 'rgba(4,9,22,.84)' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 4 },
  cardVariant: { color: FateDropColors.muted, fontSize: 6.7, lineHeight: 10, marginTop: 4 },
  priceBlock: { width: 83, alignItems: 'flex-end' },
  priceLabel: { color: FateDropColors.goldBright, fontSize: 5.8, fontWeight: '900', letterSpacing: .55 },
  priceValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, marginTop: 3 },
  fairRange: { color: FateDropColors.muted, fontSize: 6.3, marginTop: 3 },
  tabs: { height: 48, flexDirection: 'row', marginTop: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', borderRadius: 11, backgroundColor: 'rgba(3,8,20,.76)' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: 'rgba(124,110,255,.15)' },
  tabText: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .55 },
  tabTextActive: { color: FateDropColors.ivory },
  tabGem: { position: 'absolute', width: 6, height: 6, bottom: -4, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 21 },
  filterEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  offerCount: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .55 },
  filterRail: { gap: 7, paddingTop: 9, paddingRight: 8 },
  conditionRail: { gap: 7, paddingTop: 7, paddingRight: 8 },
  filterChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.3)', borderRadius: 999, backgroundColor: 'rgba(3,8,20,.76)' },
  filterChipActive: { borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(124,110,255,.16)' },
  filterChipText: { color: FateDropColors.secondary, fontSize: 8.5 },
  filterChipTextActive: { color: FateDropColors.ivory, fontWeight: '800' },
  notice: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 10 },
  loading: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: FateDropColors.muted, fontSize: 9 },
  empty: { minHeight: 270, alignItems: 'center', justifyContent: 'center', marginTop: 13, paddingHorizontal: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.3)', borderRadius: 16, backgroundColor: 'rgba(4,9,22,.66)' },
  emptyOrbit: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.45)' },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19, marginTop: 12 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 7 },
  findButton: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 17, borderRadius: 999, backgroundColor: FateDropColors.goldBright },
  findButtonText: { color: '#080B14', fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  offerStack: { gap: 10, marginTop: 13 },
  offerCard: { padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.37)', borderRadius: 15, backgroundColor: 'rgba(4,9,22,.86)' },
  offerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  retailerMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.43)', backgroundColor: 'rgba(124,110,255,.1)' },
  offerTitleWrap: { flex: 1, minWidth: 0 },
  retailerName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15 },
  offerTitle: { color: FateDropColors.secondary, fontSize: 7.5, lineHeight: 11, marginTop: 3 },
  verdict: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999 },
  verdictDot: { width: 5, height: 5, borderRadius: 3 },
  verdictText: { fontSize: 5.8, fontWeight: '900', letterSpacing: .5 },
  priceLedger: { minHeight: 66, flexDirection: 'row', alignItems: 'center', marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.19)' },
  priceCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  priceCellLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', letterSpacing: .55 },
  priceCellValue: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 15, marginTop: 4 },
  priceCellValueStrong: { color: FateDropColors.ivory, fontSize: 18 },
  priceDivider: { width: StyleSheet.hairlineWidth, height: 35, backgroundColor: 'rgba(226,197,141,.26)' },
  comparisonLine: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  comparisonCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 7.5, lineHeight: 11 },
  offerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  stockCopy: { flex: 1 },
  stock: { color: FateDropColors.goldBright, fontSize: 6.2, fontWeight: '900', letterSpacing: .5 },
  verifiedAt: { color: FateDropColors.muted, fontSize: 6.5, marginTop: 3 },
  viewButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, borderRadius: 999, backgroundColor: FateDropColors.goldBright },
  viewButtonText: { color: '#080B14', fontSize: 6.3, fontWeight: '900', letterSpacing: .55 },
});
