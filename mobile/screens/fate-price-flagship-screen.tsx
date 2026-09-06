import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToFateCollectorAction } from '@/components/add-to-fate-collector-action';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  FateMarketApiError,
  fetchFatePrice,
  fetchFatePriceCard,
  fetchFatePriceHistory,
  type FatePriceCard,
  type FatePriceHistoryDays,
  type FatePriceHistorySnapshot,
  type FatePriceMovement,
  type FatePriceScope,
  type FatePriceSnapshot,
} from '@/services/fate-market';

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

function movementText(movement: FatePriceMovement | undefined) {
  const percent = movement?.available ? movement.percent : null;
  if (percent == null || !Number.isFinite(percent)) return '—';
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function movementColor(movement: FatePriceMovement | undefined) {
  const percent = movement?.available ? movement.percent : null;
  if (percent == null || percent === 0) return FateDropColors.goldBright;
  return percent > 0 ? FateDropColors.manifested : FateDropColors.vanished;
}

function dateLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Unknown';
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function scopeKey(scope: FatePriceScope) {
  return `${scope.currencyCode || ''}|${scope.marketSegmentKey}|${scope.conditionCode}`;
}

function scopeLabel(scope: FatePriceScope) {
  const segment = scope.marketSegmentKey.replaceAll('_', ' ').replaceAll('-', ' ');
  const condition = scope.conditionCode === 'unspecified' ? null : scope.conditionCode.replaceAll('_', ' ');
  return [segment, condition, scope.currencyCode].filter(Boolean).join(' · ');
}

export default function FatePriceFlagshipScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    collectorNumber?: string | string[];
    name?: string | string[];
    setId?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const cardId = first(params.cardId)?.trim() || '';
  const routeName = first(params.name)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const routeCollector = first(params.collectorNumber)?.trim() || '';
  const routeTcg = first(params.tcg)?.trim() || '';

  const [card, setCard] = useState<FatePriceCard | null>(null);
  const [price, setPrice] = useState<FatePriceSnapshot | null>(null);
  const [history, setHistory] = useState<FatePriceHistorySnapshot | null>(null);
  const [days, setDays] = useState<FatePriceHistoryDays>(30);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (force = false, scope: FatePriceScope | null = null, historyDays: FatePriceHistoryDays = days) => {
    if (!cardId) return;
    setLoading(true);
    setNotice('');
    const [cardResult, priceResult, historyResult] = await Promise.allSettled([
      fetchFatePriceCard(cardId),
      fetchFatePrice(cardId, { force, scope }),
      fetchFatePriceHistory(cardId, { days: historyDays, force, scope }),
    ]);
    if (cardResult.status === 'fulfilled') setCard(cardResult.value.card);
    if (priceResult.status === 'fulfilled') setPrice(priceResult.value);
    else setPrice(null);
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
    else setHistory(null);
    const failure = [cardResult, priceResult, historyResult].find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      setNotice(failure.reason instanceof FateMarketApiError ? failure.reason.message : 'FatePrice evidence is temporarily unavailable.');
    }
    setLoading(false);
  }, [cardId, days]);

  useEffect(() => {
    void load(false, null, 30);
  }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseDays = useCallback(async (next: FatePriceHistoryDays) => {
    setDays(next);
    if (!cardId) return;
    setHistoryLoading(true);
    try {
      setHistory(await fetchFatePriceHistory(cardId, { days: next, scope: price?.marketScope ?? null }));
    } catch (error) {
      setNotice(error instanceof FateMarketApiError ? error.message : 'FatePrice history is temporarily unavailable.');
    } finally {
      setHistoryLoading(false);
    }
  }, [cardId, price?.marketScope]);

  const chooseScope = useCallback(async (scope: FatePriceScope) => {
    await load(false, scope, days);
  }, [days, load]);

  const title = card?.name || routeName || 'Exact card';
  const setName = card?.setName || routeSetName || 'Verified set';
  const collector = card?.collectorNumber || routeCollector;
  const currency = price?.price?.currencyCode || price?.marketScope?.currencyCode || 'GBP';
  const scopes = price?.evidence.availableScopes ?? [];
  const selectedScope = price?.marketScope ? scopeKey(price.marketScope) : '';
  const identityLine = [
    setName,
    collector ? `#${collector}` : null,
    card?.rarity,
    card?.variantCode && card.variantCode !== 'standard' ? card.variantCode.replaceAll('-', ' ') : 'standard',
    card?.languageCode ? card.languageCode.toUpperCase() : null,
  ].filter(Boolean).join(' · ');
  const marketSource = price?.evidence.sources.length ? price.evidence.sources.join(' · ') : 'Cardmarket-backed market evidence';
  const points = history?.available ? history.points : [];
  const range = useMemo(() => {
    if (!points.length) return null;
    const amounts = points.map((point) => point.amount);
    return { low: Math.min(...amounts), high: Math.max(...amounts) };
  }, [points]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FateDropBackground />
      <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
      <View style={styles.veil} />
    </View>

    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true, price?.marketScope ?? null, days)} tintColor={FateDropColors.goldBright} />}
    >
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={18} color={FateDropColors.goldBright} /><Text style={styles.backText}>FatePrice</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/fate-price')} style={styles.searchAgain}><Ionicons name="search-outline" size={14} color={FateDropColors.ivory} /><Text style={styles.searchAgainText}>NEW SEARCH</Text></Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>FATEPRICE · EXACT IDENTITY</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.identity}>{identityLine}</Text>
          <Text style={styles.heroBody}>Market value and retailer availability are deliberately separate. This page reads the market channel only.</Text>
        </View>
        <View style={styles.crystalWrap}><Image source={require('../assets/images/home-orbital-crystal.png')} style={styles.crystal} contentFit="contain" cachePolicy="memory-disk" /></View>
      </View>

      <View style={styles.channelRail}>
        <View style={[styles.channel, styles.channelActive]}><Ionicons name="analytics-outline" size={15} color={FateDropColors.goldBright} /><View><Text style={styles.channelLabel}>MARKET</Text><Text style={styles.channelMeta}>Cardmarket evidence</Text></View></View>
        <Pressable accessibilityRole="button" disabled={!cardId} onPress={() => router.push({ pathname: '/fate-price-buy', params: { cardId, name: title, setName, collectorNumber: collector, tcg: card?.tcgCode || routeTcg } })} style={({ pressed }) => [styles.channel, pressed && styles.pressed]}><Ionicons name="bag-handle-outline" size={15} color={FateDropColors.echo} /><View><Text style={styles.channelLabel}>BUY</Text><Text style={styles.channelMeta}>Retailer inventory</Text></View><Ionicons name="chevron-forward" size={14} color={FateDropColors.muted} /></Pressable>
      </View>

      <View style={styles.valuePanel}>
        <View style={styles.valueHeader}><Text style={styles.sectionEyebrow}>FATEPRICE MARKET VALUE</Text><View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{price?.available ? 'EVIDENCE LIVE' : 'EVIDENCE GATED'}</Text></View></View>
        {loading && !price ? <ActivityIndicator style={styles.loader} color={FateDropColors.goldBright} /> : <>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>{money(price?.price?.amount, currency)}</Text>
          <Text style={styles.valueMeta}>{price?.available && price.price ? `As of ${dateLabel(price.price.asOf)} · ${marketSource}` : notice || 'No verified market value is currently publishable for this exact identity.'}</Text>
          <View style={styles.metrics}>
            <Metric label="7D" value={movementText(price?.movement.d7)} color={movementColor(price?.movement.d7)} />
            <View style={styles.metricDivider} />
            <Metric label="30D" value={movementText(price?.movement.d30)} color={movementColor(price?.movement.d30)} />
            <View style={styles.metricDivider} />
            <Metric label="CONFIDENCE" value={price?.confidence?.level.toUpperCase() || '—'} color={FateDropColors.echo} />
          </View>
        </>}
      </View>

      <View style={styles.actionGrid}>
        <Pressable accessibilityRole="button" disabled={!cardId} onPress={() => router.push({ pathname: '/fate-price-buy', params: { cardId, name: title, setName, collectorNumber: collector, tcg: card?.tcgCode || routeTcg } })} style={({ pressed }) => [styles.buyAction, pressed && styles.pressed]}>
          <View><Text style={styles.buyEyebrow}>RETAILER CHANNEL</Text><Text style={styles.buyTitle}>Where to buy</Text><Text style={styles.buyCopy}>Compare verified store offers against this independent market value.</Text></View><Ionicons name="arrow-forward-circle" size={28} color={FateDropColors.goldBright} />
        </Pressable>
        {cardId ? <AddToFateCollectorAction cardIdentityId={cardId} setName={setName} /> : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}><View><Text style={styles.sectionEyebrow}>PRICE HISTORY</Text><Text style={styles.panelTitle}>Watch the card, not a single snapshot.</Text></View>{historyLoading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}</View>
        <View style={styles.periodRail}>{([7, 30, 90] as FatePriceHistoryDays[]).map((period) => <Pressable key={period} accessibilityRole="button" accessibilityState={{ selected: days === period }} onPress={() => void chooseDays(period)} style={[styles.period, days === period && styles.periodActive]}><Text style={[styles.periodText, days === period && styles.periodTextActive]}>{period}D</Text></Pressable>)}</View>
        {points.length ? <>
          <View style={styles.rangeRow}><Text style={styles.rangeText}>High {money(range?.high, currency)}</Text><Text style={styles.rangeCount}>{points.length} stored market days</Text><Text style={styles.rangeText}>Low {money(range?.low, currency)}</Text></View>
          <HistoryPlot history={history!} currency={currency} />
          <Text style={styles.truthCopy}>Stored market days only. Missing days are not interpolated or manufactured.</Text>
        </> : <View style={styles.empty}><Ionicons name="pulse-outline" size={18} color={FateDropColors.muted} /><Text style={styles.emptyText}>Verified history is still building for this exact market scope.</Text></View>}
      </View>

      {scopes.length ? <View style={styles.panel}>
        <Text style={styles.sectionEyebrow}>EXACT MARKET SCOPE</Text>
        <Text style={styles.panelTitle}>Keep versions and conditions separate.</Text>
        <View style={styles.scopeStack}>{scopes.map((scope) => {
          const active = selectedScope === scopeKey(scope);
          return <Pressable key={scopeKey(scope)} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => void chooseScope(scope)} style={[styles.scopeRow, active && styles.scopeRowActive]}><Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={active ? FateDropColors.goldBright : FateDropColors.muted} /><Text style={[styles.scopeText, active && styles.scopeTextActive]}>{scopeLabel(scope).toUpperCase()}</Text></Pressable>;
        })}</View>
      </View> : null}

      <View style={styles.panel}>
        <Text style={styles.sectionEyebrow}>IDENTITY + EVIDENCE</Text>
        <Text style={styles.panelTitle}>Why this number belongs to this card.</Text>
        <Evidence label="Game" value={card?.tcgCode || routeTcg || '—'} />
        <Evidence label="Series" value={card?.seriesName || '—'} />
        <Evidence label="Set" value={setName} />
        <Evidence label="Collector #" value={collector || '—'} />
        <Evidence label="Variant" value={card?.variantCode || '—'} />
        <Evidence label="Language" value={card?.languageCode?.toUpperCase() || '—'} />
        <Evidence label="Fair range" value={price?.price ? `${money(price.price.fairLow, currency)} – ${money(price.price.fairHigh, currency)}` : '—'} />
        <Evidence label="Source" value={marketSource} />
        <View style={styles.truthLine}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthCopy}>Retailer asking prices never feed back into this market valuation. They are compared against it only on the Buy channel.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, { color }]}>{value}</Text></View>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <View style={styles.evidenceRow}><Text style={styles.evidenceLabel}>{label}</Text><Text style={styles.evidenceValue}>{value}</Text></View>;
}

function HistoryPlot({ history, currency }: { history: FatePriceHistorySnapshot; currency: string }) {
  const points = history.points;
  const amounts = points.map((point) => point.amount);
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const spread = Math.max(high - low, 0.01);
  return <View accessibilityLabel={`${history.days} day FatePrice history`} style={styles.plot}>
    {points.map((point) => {
      const height = 16 + ((point.amount - low) / spread) * 72;
      return <View key={`${point.marketDay}:${point.asOf}`} accessibilityLabel={`${point.marketDay} ${money(point.amount, currency)}`} style={styles.plotColumn}><View style={[styles.plotStem, { height }]}><View style={styles.plotDot} /></View></View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,14,.60)' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 138 },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '800' },
  searchAgain: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(3,8,20,.70)' },
  searchAgainText: { color: FateDropColors.ivory, fontSize: 9, fontWeight: '800', letterSpacing: .7 },
  hero: { minHeight: 150, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  heroCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 31, lineHeight: 35, marginTop: 6 },
  identity: { color: FateDropColors.goldBright, fontSize: 10, lineHeight: 15, marginTop: 5, textTransform: 'uppercase' },
  heroBody: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 7 },
  crystalWrap: { width: 84, height: 84, borderRadius: 42, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.40)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76,62,165,.12)' },
  crystal: { width: 72, height: 72 },
  channelRail: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  channel: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)', backgroundColor: 'rgba(4,8,21,.80)' },
  channelActive: { borderColor: 'rgba(226,197,141,.68)', backgroundColor: 'rgba(92,69,175,.20)' },
  channelLabel: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  channelMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 },
  valuePanel: { padding: 17, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(226,197,141,.40)', backgroundColor: 'rgba(3,8,20,.90)', marginBottom: 12 },
  valueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.25 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(102,223,188,.08)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.manifested },
  liveText: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  loader: { paddingVertical: 26 },
  value: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 44, lineHeight: 52, marginTop: 8 },
  valueMeta: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  metrics: { minHeight: 58, flexDirection: 'row', alignItems: 'stretch', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.24)' },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  metricValue: { fontFamily: Fonts.serif, fontSize: 19, marginTop: 5 },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.24)' },
  actionGrid: { gap: 10, marginBottom: 12 },
  buyAction: { minHeight: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.46)', backgroundColor: 'rgba(78,55,152,.22)' },
  buyEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  buyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 22, marginTop: 3 },
  buyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3, maxWidth: 300 },
  panel: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.27)', backgroundColor: 'rgba(4,8,21,.86)', marginBottom: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  panelTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, lineHeight: 26, marginTop: 5 },
  periodRail: { flexDirection: 'row', gap: 7, marginVertical: 14 },
  period: { minWidth: 56, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.25)', backgroundColor: 'rgba(2,6,16,.72)' },
  periodActive: { borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(113,93,214,.24)' },
  periodText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '800' },
  periodTextActive: { color: FateDropColors.ivory },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 8 },
  rangeText: { color: FateDropColors.secondary, fontSize: 8 },
  rangeCount: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '800' },
  plot: { height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.24)' },
  plotColumn: { flex: 1, minWidth: 2, height: 92, justifyContent: 'flex-end', alignItems: 'center' },
  plotStem: { width: 2, minHeight: 10, backgroundColor: 'rgba(124,110,255,.80)', alignItems: 'center' },
  plotDot: { width: 5, height: 5, marginTop: -2, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  empty: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  emptyText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  truthLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.22)' },
  truthCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 8, lineHeight: 13, marginTop: 7 },
  scopeStack: { gap: 7, marginTop: 12 },
  scopeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.20)' },
  scopeRowActive: { borderColor: 'rgba(226,197,141,.62)', backgroundColor: 'rgba(92,69,175,.17)' },
  scopeText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '800' },
  scopeTextActive: { color: FateDropColors.ivory },
  evidenceRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.13)' },
  evidenceLabel: { color: FateDropColors.muted, fontSize: 9 },
  evidenceValue: { flex: 1, color: FateDropColors.ivory, fontSize: 9, textAlign: 'right' },
});
