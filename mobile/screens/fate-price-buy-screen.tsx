import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { FateMarketApiError, fetchFatePrice, fetchFatePriceCard, type FatePriceCard, type FatePriceSnapshot } from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function money(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const currency = currencyCode || 'GBP';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function FatePriceBuyScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    collectorNumber?: string | string[];
    name?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const cardId = first(params.cardId)?.trim() || '';
  const routeName = first(params.name)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const routeCollector = first(params.collectorNumber)?.trim() || '';
  const [card, setCard] = useState<FatePriceCard | null>(null);
  const [price, setPrice] = useState<FatePriceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!cardId) {
      setLoading(false);
      setNotice('Choose an exact FatePrice card before opening retailer offers.');
      return;
    }
    setLoading(true);
    setNotice('');
    const [cardResult, priceResult] = await Promise.allSettled([fetchFatePriceCard(cardId), fetchFatePrice(cardId)]);
    if (cardResult.status === 'fulfilled') setCard(cardResult.value.card);
    if (priceResult.status === 'fulfilled') setPrice(priceResult.value);
    const failure = [cardResult, priceResult].find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') setNotice(failure.reason instanceof FateMarketApiError ? failure.reason.message : 'FatePrice evidence is temporarily unavailable.');
    setLoading(false);
  }, [cardId]);

  useEffect(() => { void load(); }, [load]);

  const title = card?.name || routeName || 'Exact card';
  const setName = card?.setName || routeSetName || 'Verified set';
  const collector = card?.collectorNumber || routeCollector;
  const currency = price?.price?.currencyCode || price?.marketScope?.currencyCode || 'GBP';
  const identity = [setName, collector ? `#${collector}` : null, card?.variantCode, card?.languageCode?.toUpperCase()].filter(Boolean).join(' · ');

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <Stack.Screen options={{ headerShown: false }} />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FateDropBackground />
      <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
      <View style={styles.veil} />
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={18} color={FateDropColors.goldBright} /><Text style={styles.backText}>Back to FatePrice</Text></Pressable>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>FATEPRICE · WHERE TO BUY</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.identity}>{identity}</Text>
          <Text style={styles.copy}>FatePrice market truth stays independent. This page is the separate retailer channel for exact-match stock and asking prices.</Text>
        </View>
        <View style={styles.bag}><Ionicons name="bag-handle-outline" size={30} color={FateDropColors.goldBright} /></View>
      </View>

      <View style={styles.marketAnchor}>
        <View><Text style={styles.sectionEyebrow}>INDEPENDENT MARKET ANCHOR</Text><Text style={styles.marketLabel}>FatePrice Market Value</Text></View>
        {loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Text style={styles.marketValue}>{money(price?.price?.amount, currency)}</Text>}
      </View>
      <Text style={styles.anchorCopy}>This value is read from the market channel. Retailer prices below will only be compared against it; they will never change it.</Text>

      <View style={styles.comparePanel}>
        <Text style={styles.sectionEyebrow}>RETAILER OFFER CONTRACT</Text>
        <Text style={styles.panelTitle}>Only exact matches earn a Buy option.</Text>
        <View style={styles.ruleGrid}>
          <Rule icon="layers-outline" title="Exact identity" copy="TCG, set, collector number and printing must resolve to this card." />
          <Rule icon="sparkles-outline" title="Exact variant" copy="Finish, language and variant stay separate. No near-match guessing." />
          <Rule icon="shield-checkmark-outline" title="Verified stock" copy="Only current retailer inventory can appear as available to buy." />
          <Rule icon="git-compare-outline" title="Fair comparison" copy="Store price is compared with FatePrice; it does not feed the valuation." />
        </View>
      </View>

      <View style={styles.offersPanel}>
        <View style={styles.offersHeader}><View><Text style={styles.sectionEyebrow}>FATEDROP RETAILERS</Text><Text style={styles.panelTitle}>Available to buy</Text></View><View style={styles.buildingPill}><Text style={styles.buildingText}>CONNECTION FOUNDATION</Text></View></View>
        <View style={styles.emptyOffer}>
          <View style={styles.emptyIcon}><Ionicons name="storefront-outline" size={24} color={FateDropColors.goldBright} /></View>
          <Text style={styles.emptyTitle}>Retailer matching is the next backend connection.</Text>
          <Text style={styles.emptyCopy}>This page is intentionally not inventing offers. Once the retailer inventory bridge returns a verified match for this exact identity, the store, condition, stock, asking price, delivery and True Price comparison can appear here.</Text>
        </View>

        <View style={styles.offerPreview}>
          <Text style={styles.previewEyebrow}>WHEN A VERIFIED OFFER EXISTS</Text>
          <View style={styles.previewRow}><Text style={styles.previewLabel}>Retailer</Text><Text style={styles.previewValue}>Store name + verified SKU</Text></View>
          <View style={styles.previewRow}><Text style={styles.previewLabel}>Condition</Text><Text style={styles.previewValue}>Exact supplied condition</Text></View>
          <View style={styles.previewRow}><Text style={styles.previewLabel}>Store price</Text><Text style={styles.previewValue}>Independent asking price</Text></View>
          <View style={styles.previewRow}><Text style={styles.previewLabel}>True Price</Text><Text style={styles.previewValue}>Item + known delivery</Text></View>
          <View style={styles.previewRow}><Text style={styles.previewLabel}>Vs market</Text><Text style={styles.previewValue}>Difference from FatePrice</Text></View>
          <View style={styles.previewRow}><Text style={styles.previewLabel}>Action</Text><Text style={styles.previewValue}>View / Buy from retailer</Text></View>
        </View>
      </View>

      <View style={styles.truthPanel}>
        <Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright} />
        <Text style={styles.truthCopy}>Permanent rule: Cardmarket-backed market evidence determines FatePrice. Retailer inventory determines availability. The two channels meet only for comparison and purchase discovery.</Text>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Rule({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) {
  return <View style={styles.rule}><View style={styles.ruleIcon}><Ionicons name={icon} size={16} color={FateDropColors.goldBright} /></View><View style={styles.ruleCopy}><Text style={styles.ruleTitle}>{title}</Text><Text style={styles.ruleBody}>{copy}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,14,.62)' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 138 },
  back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  backText: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '800' },
  hero: { minHeight: 150, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  heroCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 6 },
  identity: { color: FateDropColors.goldBright, fontSize: 9, lineHeight: 14, marginTop: 5, textTransform: 'uppercase' },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 7 },
  bag: { width: 70, height: 70, borderRadius: 35, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.50)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(84,61,165,.18)' },
  marketAnchor: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.45)', backgroundColor: 'rgba(3,8,20,.91)' },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  marketLabel: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, marginTop: 4 },
  marketValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 29 },
  anchorCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, paddingHorizontal: 4, marginTop: 7, marginBottom: 12 },
  comparePanel: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.27)', backgroundColor: 'rgba(4,8,21,.86)', marginBottom: 12 },
  panelTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, lineHeight: 26, marginTop: 5 },
  ruleGrid: { gap: 8, marginTop: 13 },
  rule: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 13, backgroundColor: 'rgba(10,15,31,.68)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.17)' },
  ruleIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(92,69,175,.17)' },
  ruleCopy: { flex: 1 },
  ruleTitle: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '800' },
  ruleBody: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 13, marginTop: 2 },
  offersPanel: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(3,8,20,.90)', marginBottom: 12 },
  offersHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  buildingPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(92,69,175,.13)' },
  buildingText: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  emptyOffer: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(92,69,175,.15)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.25)' },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, textAlign: 'center', marginTop: 10 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 15, textAlign: 'center', marginTop: 6, maxWidth: 390 },
  offerPreview: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.20)', paddingTop: 12 },
  previewEyebrow: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .9, marginBottom: 7 },
  previewRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.11)' },
  previewLabel: { color: FateDropColors.muted, fontSize: 8 },
  previewValue: { flex: 1, color: FateDropColors.secondary, fontSize: 8, textAlign: 'right' },
  truthPanel: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 14, borderRadius: 15, backgroundColor: 'rgba(71,54,133,.17)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  notice: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 10 },
});
