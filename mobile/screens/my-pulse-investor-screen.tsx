import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CanonicalThumbnail } from '@/components/canonical-thumbnail';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  loadFatePulseFollows,
  removeFatePulseCardFollow,
  removeFatePulseSetFollow,
  type FatePulseCardFollow,
  type FatePulseFollows,
} from '@/services/fate-pulse-follows';
import {
  fetchFatePrice,
  fetchFatePriceHistory,
  type FatePriceHistoryDays,
  type FatePriceHistorySnapshot,
  type FatePriceSnapshot,
} from '@/services/fate-market';

type CardIntel = {
  loading: boolean;
  price: FatePriceSnapshot | null;
  history: FatePriceHistorySnapshot | null;
  error: string;
};

type ChartWindow = 7 | 30 | 90;

const EMPTY_FOLLOWS: FatePulseFollows = { cards: [], sets: [] };
const WINDOWS: ChartWindow[] = [7, 30, 90];

function money(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const currency = currencyCode || 'GBP';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function move(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function moveAccent(value: number | null | undefined) {
  if (value == null || value === 0) return FateDropColors.goldBright;
  return value > 0 ? FateDropColors.manifested : FateDropColors.vanished;
}

function historyMove(history: FatePriceHistorySnapshot | null | undefined) {
  const points = history?.available ? history.points : [];
  if (points.length < 2) return null;
  const first = points[0]?.amount;
  const last = points[points.length - 1]?.amount;
  if (!Number.isFinite(first) || !Number.isFinite(last) || !first) return null;
  return ((last - first) / first) * 100;
}

function filteredPoints(history: FatePriceHistorySnapshot | null | undefined, days: ChartWindow) {
  const points = history?.available ? history.points : [];
  if (!points.length) return [];
  const latest = points[points.length - 1]?.asOf ?? 0;
  const cutoff = latest - (days * 24 * 60 * 60 * 1000);
  return points.filter((point) => point.asOf >= cutoff);
}

function formatDay(value: string | undefined) {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function MyPulseInvestorScreen() {
  const { snapshot } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [follows, setFollows] = useState<FatePulseFollows>(EMPTY_FOLLOWS);
  const [intel, setIntel] = useState<Record<string, CardIntel>>({});
  const [chartWindow, setChartWindow] = useState<ChartWindow>(30);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    setRefreshing(force);
    const nextFollows = await loadFatePulseFollows(identity);
    setFollows(nextFollows);

    if (!nextFollows.cards.length) {
      setIntel({});
      setRefreshing(false);
      return;
    }

    setIntel((current) => {
      const next = { ...current };
      for (const follow of nextFollows.cards) {
        next[follow.cardIdentityId] = {
          loading: true,
          price: current[follow.cardIdentityId]?.price ?? null,
          history: current[follow.cardIdentityId]?.history ?? null,
          error: '',
        };
      }
      return next;
    });

    await Promise.all(nextFollows.cards.map(async (follow) => {
      const [priceResult, historyResult] = await Promise.allSettled([
        fetchFatePrice(follow.cardIdentityId, { force }),
        fetchFatePriceHistory(follow.cardIdentityId, { days: 90, force }),
      ]);
      setIntel((current) => ({
        ...current,
        [follow.cardIdentityId]: {
          loading: false,
          price: priceResult.status === 'fulfilled' ? priceResult.value : null,
          history: historyResult.status === 'fulfilled' ? historyResult.value : null,
          error: priceResult.status === 'rejected' && historyResult.status === 'rejected' ? 'Market evidence is temporarily unavailable.' : '',
        },
      }));
    }));
    setRefreshing(false);
  }, [identity]);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const thirtyDayMoves = useMemo(() => follows.cards.map((follow) => {
    const value = intel[follow.cardIdentityId]?.price?.movement.d30;
    return value?.available && Number.isFinite(value.percent) ? value.percent! : null;
  }).filter((value): value is number => value != null), [follows.cards, intel]);

  const historyReady = useMemo(() => follows.cards.filter((follow) => {
    const history = intel[follow.cardIdentityId]?.history;
    return Boolean(history?.available && history.points.length >= 2);
  }).length, [follows.cards, intel]);

  const best30 = thirtyDayMoves.length ? Math.max(...thirtyDayMoves) : null;
  const weakest30 = thirtyDayMoves.length ? Math.min(...thirtyDayMoves) : null;

  const removeCard = useCallback(async (cardIdentityId: string) => {
    const next = await removeFatePulseCardFollow(identity, cardIdentityId);
    setFollows(next);
    setIntel((current) => {
      const nextIntel = { ...current };
      delete nextIntel[cardIdentityId];
      return nextIntel;
    });
  }, [identity]);

  const removeSet = useCallback(async (key: string) => {
    setFollows(await removeFatePulseSetFollow(identity, key));
  }, [identity]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <View style={styles.backgroundVeil} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={FateDropColors.goldBright} />}
      >
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Back to Fate Market" onPress={() => router.replace('/(tabs)/market')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={18} color={FateDropColors.goldBright} />
          </Pressable>
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>FatePulse</Text>
            <Text style={styles.brandSubtitle}>TCG MARKET INTELLIGENCE</Text>
          </View>
          <Pressable accessibilityLabel="Add a card to My Pulse" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={20} color={FateDropColors.goldBright} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Search any exact card or set" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.globalSearch, pressed && styles.pressed]}>
          <Ionicons name="search-outline" size={19} color={FateDropColors.secondary} />
          <Text style={styles.globalSearchText}>Search any card or set</Text>
          <Ionicons name="arrow-forward" size={16} color={FateDropColors.goldBright} />
        </Pressable>

        <View accessibilityRole="tablist" style={styles.viewTabs}>
          <PulseTab label="Overview" onPress={() => router.replace('/fate-pulse')} />
          <PulseTab label="Sets" onPress={() => router.replace('/fate-pulse/sets')} />
          <PulseTab label="Cards" onPress={() => router.replace('/fate-pulse/cards')} />
          <PulseTab label="My Pulse" selected onPress={() => undefined} />
        </View>

        <View style={styles.heroRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PERSONAL WATCHLIST</Text>
            <Text style={styles.title}>Your market. Your cards.</Text>
            <Text style={styles.copy}>Follow the exact cards you care about and see what their verified market evidence has actually been doing.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={17} color={FateDropColors.background} />
            <Text style={styles.addButtonText}>ADD CARD</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <SummaryMetric label="TRACKED" value={`${follows.cards.length}`} detail="exact cards" />
          <View style={styles.summaryDivider} />
          <SummaryMetric label="WITH HISTORY" value={`${historyReady}`} detail="2+ stored days" />
          <View style={styles.summaryDivider} />
          <SummaryMetric label="BEST 30D" value={move(best30)} detail="watched card" accent={moveAccent(best30)} />
          <View style={styles.summaryDivider} />
          <SummaryMetric label="WEAKEST 30D" value={move(weakest30)} detail="watched card" accent={moveAccent(weakest30)} />
        </View>

        <View style={styles.windowRow}>
          <View style={styles.flex}>
            <Text style={styles.sectionEyebrow}>PRICE TRAIL</Text>
            <Text style={styles.windowCopy}>Stored market days only · no interpolation</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.windowRail}>
            {WINDOWS.map((days) => <Pressable key={days} accessibilityRole="tab" accessibilityState={{ selected: chartWindow === days }} onPress={() => setChartWindow(days)} style={[styles.windowButton, chartWindow === days && styles.windowButtonActive]}><Text style={[styles.windowText, chartWindow === days && styles.windowTextActive]}>{days}D</Text></Pressable>)}
          </View>
        </View>

        {!follows.cards.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={30} color={FateDropColors.goldBright} />
            <Text style={styles.emptyTitle}>Your Pulse is waiting.</Text>
            <Text style={styles.emptyCopy}>Find an exact card in FatePrice, add it to My Pulse, and its verified value, movement and stored price history will live here.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
              <Text style={styles.emptyActionText}>FIND A CARD</Text>
              <Ionicons name="arrow-forward" size={15} color={FateDropColors.background} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.cardStack}>
          {follows.cards.map((follow) => <WatchedCard key={follow.cardIdentityId} follow={follow} intel={intel[follow.cardIdentityId]} chartWindow={chartWindow} onRemove={() => void removeCard(follow.cardIdentityId)} />)}
        </View>

        {follows.sets.length ? (
          <View style={styles.setSection}>
            <View style={styles.setHeading}><Ionicons name="albums-outline" size={18} color={FateDropColors.goldBright} /><Text style={styles.setHeadingText}>Watched Sets</Text></View>
            {follows.sets.map((set) => <View key={set.key} style={styles.setRow}><View style={styles.setIcon}><Ionicons name="albums-outline" size={18} color={FateDropColors.goldBright} /></View><View style={styles.flex}><Text style={styles.setName}>{set.setName}</Text><Text style={styles.setMeta}>{set.setCode || set.tcgCode || 'Tracked set'}</Text></View><Pressable accessibilityLabel="Remove set from My Pulse" onPress={() => void removeSet(set.key)} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Ionicons name="star" size={16} color={FateDropColors.goldBright} /></Pressable></View>)}
          </View>
        ) : null}

        <Text style={styles.footerNote}>My Pulse uses the same exact-card FatePrice evidence as the research screen. Price trails show stored market days only; missing days are never invented.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PulseTab({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={styles.viewTab}><Text style={[styles.viewTabText, selected && styles.viewTabTextActive]}>{label}</Text>{selected ? <View style={styles.viewTabUnderline} /> : null}</Pressable>;
}

function SummaryMetric({ label, value, detail, accent = FateDropColors.ivory }: { label: string; value: string; detail: string; accent?: string }) {
  return <View style={styles.summaryMetric}><Text style={styles.summaryLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue, { color: accent }]}>{value}</Text><Text style={styles.summaryDetail}>{detail}</Text></View>;
}

function WatchedCard({ follow, intel, chartWindow, onRemove }: { follow: FatePulseCardFollow; intel?: CardIntel; chartWindow: ChartWindow; onRemove: () => void }) {
  const price = intel?.price;
  const history = intel?.history;
  const points = filteredPoints(history, chartWindow);
  const values = points.map((point) => point.amount);
  const low = values.length ? Math.min(...values) : null;
  const high = values.length ? Math.max(...values) : null;
  const spread = low != null && high != null ? high - low : 0;
  const currency = price?.price?.currencyCode || price?.marketScope?.currencyCode || history?.points[history.points.length - 1]?.currencyCode || 'GBP';
  const move7 = price?.movement.d7.available ? price.movement.d7.percent ?? null : null;
  const move30 = price?.movement.d30.available ? price.movement.d30.percent ?? null : null;
  const move90 = historyMove(history);
  const current = price?.price?.amount ?? history?.points[history.points.length - 1]?.amount ?? null;

  return <View style={styles.cardPanel}>
    <View style={styles.cardHeader}>
      <CanonicalThumbnail kind="card" setId={follow.setId} collectorNumber={follow.collectorNumber} width={62} height={86} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${follow.name}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: follow.cardIdentityId, collectorNumber: follow.collectorNumber, name: follow.name, printingId: follow.printingId, setId: follow.setId || '', setName: follow.setName, tcg: follow.tcgCode || '' } })} style={({ pressed }) => [styles.cardIdentity, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.cardName}>{follow.name}</Text>
        <Text numberOfLines={1} style={styles.cardMeta}>{follow.setName}{follow.collectorNumber ? ` · #${follow.collectorNumber}` : ''}</Text>
        <View style={styles.priceLine}><Text style={styles.currentPrice}>{money(current, currency)}</Text>{intel?.loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}</View>
      </Pressable>
      <Pressable accessibilityLabel="Remove card from My Pulse" onPress={onRemove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Ionicons name="star" size={17} color={FateDropColors.goldBright} /></Pressable>
    </View>

    <View style={styles.movementLedger}>
      <MoveMetric label="7D" value={move7} />
      <View style={styles.ledgerDivider} />
      <MoveMetric label="30D" value={move30} />
      <View style={styles.ledgerDivider} />
      <MoveMetric label="90D" value={move90} />
      <View style={styles.ledgerDivider} />
      <View style={styles.moveMetric}><Text style={styles.moveLabel}>CONFIDENCE</Text><Text style={[styles.moveValue, { color: FateDropColors.echo }]}>{price?.confidence?.level.toUpperCase() || '—'}</Text><Text style={styles.moveDetail}>{price?.confidence ? `${price.confidence.sourceCount} source${price.confidence.sourceCount === 1 ? '' : 's'}` : 'building'}</Text></View>
    </View>

    <View style={styles.chartArea}>
      <View style={styles.chartHeading}><Text style={styles.chartTitle}>{chartWindow}D PRICE TRAIL</Text><Text style={styles.chartCount}>{points.length} stored day{points.length === 1 ? '' : 's'}</Text></View>
      {points.length ? <>
        <View style={styles.chartRange}><Text style={styles.chartRangeText}>{money(high, currency)}</Text><Text style={styles.chartRangeText}>{money(low, currency)}</Text></View>
        <View style={styles.chartPlot}>
          {points.map((point) => {
            const height = spread > 0 && low != null ? 12 + (((point.amount - low) / spread) * 58) : 36;
            return <View key={`${point.marketDay}:${point.asOf}`} accessibilityLabel={`${point.marketDay}, ${money(point.amount, point.currencyCode)}`} style={styles.chartColumn}><View style={[styles.chartStem, { height }]}><View style={styles.chartDot} /></View></View>;
          })}
        </View>
        <View style={styles.chartAxis}><Text style={styles.chartAxisText}>{formatDay(points[0]?.marketDay)}</Text><Text style={styles.chartAxisText}>{formatDay(points[points.length - 1]?.marketDay)}</Text></View>
      </> : <View style={styles.chartEmpty}><Ionicons name="pulse-outline" size={18} color={FateDropColors.muted} /><Text style={styles.chartEmptyText}>{intel?.error || 'Price history is still building for this exact card.'}</Text></View>}
    </View>

    <View style={styles.cardFooter}>
      <View style={styles.fairRange}><Text style={styles.footerLabel}>FAIR RANGE</Text><Text style={styles.footerValue}>{price?.price ? `${money(price.price.fairLow, currency)} – ${money(price.price.fairHigh, currency)}` : '—'}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: follow.cardIdentityId, collectorNumber: follow.collectorNumber, name: follow.name, printingId: follow.printingId, setId: follow.setId || '', setName: follow.setName, tcg: follow.tcgCode || '' } })} style={({ pressed }) => [styles.openPrice, pressed && styles.pressed]}><Text style={styles.openPriceText}>OPEN FATEPRICE</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.goldBright} /></Pressable>
    </View>
  </View>;
}

function MoveMetric({ label, value }: { label: string; value: number | null | undefined }) {
  return <View style={styles.moveMetric}><Text style={styles.moveLabel}>{label} MOVE</Text><Text style={[styles.moveValue, { color: moveAccent(value) }]}>{move(value)}</Text><Text style={styles.moveDetail}>{value == null ? 'building' : 'verified'}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  backgroundVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,14,.62)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 124, gap: 13 },
  flex: { flex: 1 },
  pressed: { opacity: .76, transform: [{ scale: .99 }] },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(3,9,20,.86)', alignItems: 'center', justifyContent: 'center' },
  brandCopy: { flex: 1 },
  brandTitle: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 27, lineHeight: 30 },
  brandSubtitle: { color: FateDropColors.secondary, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.9, marginTop: 2 },
  globalSearch: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(130,143,180,.28)', backgroundColor: 'rgba(7,13,26,.9)' },
  globalSearchText: { flex: 1, color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 14 },
  viewTabs: { height: 49, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(130,143,180,.24)' },
  viewTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewTabText: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 11.5 },
  viewTabTextActive: { color: FateDropColors.goldBright },
  viewTabUnderline: { position: 'absolute', left: 9, right: 9, bottom: -1, height: 3, borderRadius: 2, backgroundColor: FateDropColors.goldBright },
  heroRow: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.25 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23, lineHeight: 27, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 5 },
  addButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  addButtonText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  summaryCard: { minHeight: 78, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(120,136,177,.24)', borderRadius: 16, backgroundColor: 'rgba(6,12,25,.92)' },
  summaryMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  summaryLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', letterSpacing: .45, textAlign: 'center' },
  summaryValue: { maxWidth: '100%', fontFamily: Fonts.serif, fontSize: 16, marginTop: 3, textAlign: 'center' },
  summaryDetail: { color: FateDropColors.muted, fontSize: 5.7, marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(120,136,177,.2)' },
  windowRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  windowCopy: { color: FateDropColors.muted, fontSize: 6.8, marginTop: 3 },
  windowRail: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)', borderRadius: 999, overflow: 'hidden' },
  windowButton: { minWidth: 43, minHeight: 31, alignItems: 'center', justifyContent: 'center' },
  windowButtonActive: { backgroundColor: 'rgba(226,197,141,.12)' },
  windowText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' },
  windowTextActive: { color: FateDropColors.goldBright },
  cardStack: { gap: 12 },
  cardPanel: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(120,136,177,.26)', backgroundColor: 'rgba(6,12,25,.94)', overflow: 'hidden' },
  cardHeader: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 12 },
  cardIdentity: { flex: 1, minWidth: 0 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18 },
  cardMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 4 },
  priceLine: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  currentPrice: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23 },
  removeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', backgroundColor: 'rgba(226,197,141,.07)' },
  movementLedger: { minHeight: 67, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,136,177,.21)' },
  moveMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  moveLabel: { color: FateDropColors.muted, fontSize: 5.6, fontWeight: '900', letterSpacing: .35, textAlign: 'center' },
  moveValue: { maxWidth: '100%', fontFamily: Fonts.serif, fontSize: 15, marginTop: 2, textAlign: 'center' },
  moveDetail: { color: FateDropColors.muted, fontSize: 5.4, marginTop: 2 },
  ledgerDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(120,136,177,.18)' },
  chartArea: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 8 },
  chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { color: FateDropColors.goldBright, fontSize: 6.4, fontWeight: '900', letterSpacing: .75 },
  chartCount: { color: FateDropColors.muted, fontSize: 6.2 },
  chartRange: { minHeight: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartRangeText: { color: FateDropColors.muted, fontSize: 6 },
  chartPlot: { height: 78, flexDirection: 'row', alignItems: 'flex-end', gap: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.22)' },
  chartColumn: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  chartStem: { width: 1, minHeight: 7, backgroundColor: 'rgba(124,110,255,.78)' },
  chartDot: { position: 'absolute', top: -2, left: -2, width: 5, height: 5, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  chartAxis: { minHeight: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartAxisText: { color: FateDropColors.muted, fontSize: 5.8 },
  chartEmpty: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 6 },
  chartEmptyText: { color: FateDropColors.muted, fontSize: 7.2, lineHeight: 11, textAlign: 'center' },
  cardFooter: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(120,136,177,.18)' },
  fairRange: { flex: 1 },
  footerLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', letterSpacing: .45 },
  footerValue: { color: FateDropColors.ivory, fontSize: 8.5, fontWeight: '800', marginTop: 3 },
  openPrice: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)' },
  openPriceText: { color: FateDropColors.goldBright, fontSize: 6.2, fontWeight: '900', letterSpacing: .5 },
  emptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(6,12,25,.9)' },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, marginTop: 10 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 15, textAlign: 'center', marginTop: 7 },
  emptyAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, paddingHorizontal: 14, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  emptyActionText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  setSection: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(120,136,177,.24)', backgroundColor: 'rgba(6,12,25,.9)', overflow: 'hidden' },
  setHeading: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,136,177,.18)' },
  setHeadingText: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16 },
  setRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,136,177,.16)' },
  setIcon: { width: 38, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.3)' },
  setName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  setMeta: { color: FateDropColors.muted, fontSize: 7, marginTop: 3 },
  footerNote: { color: FateDropColors.muted, fontSize: 7, lineHeight: 10.5, textAlign: 'center', paddingHorizontal: 20 },
});
