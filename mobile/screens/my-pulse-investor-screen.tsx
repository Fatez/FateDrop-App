import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { storedPeriodMovement } from '@/lib/history-period';
import { CanonicalThumbnail } from '@/components/canonical-thumbnail';
import { FateMarketBackground, FateMarketHeader } from '@/components/fate-market-brand';
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
        <FateMarketBackground />

        <View style={styles.cosmicHorizon} />
        <View style={styles.cosmicArc} />
        <View style={styles.cosmicArcInner} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={FateDropColors.goldBright} />}
      >
        <FateMarketHeader title="FatePulse" subtitle="Understand the market. Follow what matters to you." />

        <Pressable accessibilityRole="button" accessibilityLabel="Search any exact card or set" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.globalSearch, pressed && styles.pressed]}>
          <Ionicons name="search-outline" size={18} color={FateDropColors.secondary} />
          <Text style={styles.globalSearchText}>Search any card or set</Text>
          <View style={styles.searchStar}><View style={styles.searchStarVertical} /><View style={styles.searchStarHorizontal} /></View>
        </Pressable>

        <View accessibilityRole="tablist" style={styles.viewTabs}>
          <PulseTab label="Overview" onPress={() => router.replace('/fate-pulse')} />
          <PulseTab label="Sets" onPress={() => router.replace('/fate-pulse/sets')} />
          <PulseTab label="Cards" onPress={() => router.replace('/fate-pulse/cards')} />
          <PulseTab label="My Pulse" selected onPress={() => undefined} />
        </View>

        <View style={styles.heroRow}>
          <View pointerEvents="none" style={styles.heroArc} />
          <View pointerEvents="none" style={styles.heroHorizon} />
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PERSONAL WATCHLIST</Text>
            <Text style={styles.title}>Your market. Your cards.</Text>
            <Text style={styles.copy}>Follow the exact cards you care about and see what their verified market evidence has actually been doing.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={15} color={FateDropColors.goldBright} />
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
            <View style={styles.ornamentHeading}>
              <View style={styles.ornamentLine} />
              <View style={styles.ornamentDiamond} />
              <Text style={styles.sectionEyebrow}>PRICE TRAIL</Text>
              <View style={styles.ornamentDiamond} />
              <View style={styles.ornamentLine} />
            </View>
            <Text style={styles.windowCopy}>Stored market days only · no interpolation</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.windowRail}>
            {WINDOWS.map((days) => <Pressable key={days} accessibilityRole="tab" accessibilityState={{ selected: chartWindow === days }} onPress={() => setChartWindow(days)} style={[styles.windowButton, chartWindow === days && styles.windowButtonActive]}><Text style={[styles.windowText, chartWindow === days && styles.windowTextActive]}>{days}D</Text></Pressable>)}
          </View>
        </View>

        {!follows.cards.length ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyOrbit}><Ionicons name="analytics-outline" size={28} color={FateDropColors.goldBright} /></View>
            <Text style={styles.emptyTitle}>Your Pulse is waiting.</Text>
            <Text style={styles.emptyCopy}>Find an exact card in FatePrice, add it to My Pulse, and its verified value, movement and stored price history will live here.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
              <Text style={styles.emptyActionText}>FIND A CARD</Text>
              <Ionicons name="arrow-forward" size={14} color={FateDropColors.goldBright} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.cardStack}>
          {follows.cards.map((follow) => <WatchedCard key={follow.cardIdentityId} follow={follow} intel={intel[follow.cardIdentityId]} chartWindow={chartWindow} onRemove={() => void removeCard(follow.cardIdentityId)} />)}
        </View>

        {follows.sets.length ? (
          <View style={styles.setSection}>
            <View style={styles.setHeading}><View style={styles.setHeadingLine} /><Ionicons name="albums-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.setHeadingText}>Watched Sets</Text><View style={styles.setHeadingLine} /></View>
            {follows.sets.map((set) => <View key={set.key} style={styles.setRow}><View style={styles.setIcon}><Ionicons name="albums-outline" size={17} color={FateDropColors.goldBright} /></View><View style={styles.flex}><Text style={styles.setName}>{set.setName}</Text><Text style={styles.setMeta}>{set.setCode || set.tcgCode || 'Tracked set'}</Text></View><Pressable accessibilityLabel="Remove set from My Pulse" onPress={() => void removeSet(set.key)} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Ionicons name="star" size={16} color={FateDropColors.goldBright} /></Pressable></View>)}
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
  const move90 = history?.available ? storedPeriodMovement(history.points, 90) : null;
  const current = price?.price?.amount ?? history?.points[history.points.length - 1]?.amount ?? null;

  return <View style={styles.cardPanel}>
    <View pointerEvents="none" style={styles.cardAtmosphere} />
    <View style={styles.cardHeader}>
      <View style={styles.artworkStage}>
        <View pointerEvents="none" style={styles.artworkOrbitOuter} />
        <View pointerEvents="none" style={styles.artworkOrbitInner} />
        <CanonicalThumbnail kind="card" setId={follow.setId} collectorNumber={follow.collectorNumber} width={62} height={86} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${follow.name}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: follow.cardIdentityId, collectorNumber: follow.collectorNumber, name: follow.name, printingId: follow.printingId, setId: follow.setId || '', setName: follow.setName, tcg: follow.tcgCode || '' } })} style={({ pressed }) => [styles.cardIdentity, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.cardName}>{follow.name}</Text>
        <Text numberOfLines={1} style={styles.cardMeta}>{follow.setName}{follow.collectorNumber ? ` · #${follow.collectorNumber}` : ''}</Text>
        <View style={styles.priceLine}><Text style={styles.currentPrice}>{money(current, currency)}</Text>{intel?.loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}</View>
      </Pressable>
      <Pressable accessibilityLabel="Remove card from My Pulse" onPress={onRemove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Ionicons name="star" size={16} color={FateDropColors.goldBright} /></Pressable>
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
      <View style={styles.chartHeading}><Text style={styles.chartTitle}>{chartWindow}D PRICE TRAIL</Text><View style={styles.chartHeadingLine} /><Text style={styles.chartCount}>{points.length} stored day{points.length === 1 ? '' : 's'}</Text></View>
      {points.length ? <>
        <View style={styles.chartRange}><Text style={styles.chartRangeText}>{money(high, currency)}</Text><Text style={styles.chartRangeText}>{money(low, currency)}</Text></View>
        <View style={styles.chartPlot}>
          {points.map((point) => {
            const height = spread > 0 && low != null ? 12 + (((point.amount - low) / spread) * 58) : 36;
            return <View key={`${point.marketDay}:${point.asOf}`} accessibilityLabel={`${point.marketDay}, ${money(point.amount, point.currencyCode)}`} style={styles.chartColumn}><View style={[styles.chartStem, { height }]}><View style={styles.chartDot} /></View></View>;
          })}
        </View>
        <View style={styles.chartAxis}><Text style={styles.chartAxisText}>{formatDay(points[0]?.marketDay)}</Text><Text style={styles.chartAxisText}>{formatDay(points[points.length - 1]?.marketDay)}</Text></View>
      </> : <View style={styles.chartEmpty}><Ionicons name="pulse-outline" size={17} color={FateDropColors.muted} /><Text style={styles.chartEmptyText}>{intel?.error || 'Price history is still building for this exact card.'}</Text></View>}
    </View>

    <View style={styles.cardFooter}>
      <View style={styles.fairRange}><Text style={styles.footerLabel}>FAIR RANGE</Text><Text style={styles.footerValue}>{price?.price ? `${money(price.price.fairLow, currency)} – ${money(price.price.fairHigh, currency)}` : '—'}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: follow.cardIdentityId, collectorNumber: follow.collectorNumber, name: follow.name, printingId: follow.printingId, setId: follow.setId || '', setName: follow.setName, tcg: follow.tcgCode || '' } })} style={({ pressed }) => [styles.openPrice, pressed && styles.pressed]}><Text style={styles.openPriceText}>OPEN FATEPRICE</Text><Ionicons name="arrow-forward" size={12} color={FateDropColors.goldBright} /></Pressable>
    </View>
  </View>;
}

function MoveMetric({ label, value }: { label: string; value: number | null | undefined }) {
  return <View style={styles.moveMetric}><Text style={styles.moveLabel}>{label} MOVE</Text><Text style={[styles.moveValue, { color: moveAccent(value) }]}>{move(value)}</Text><Text style={styles.moveDetail}>{value == null ? 'building' : 'verified'}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  backgroundVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,14,.34)' },
  cosmicHorizon: { position: 'absolute', left: -70, right: -70, top: 294, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.23)' },
  cosmicArc: { position: 'absolute', width: '126%', height: 390, left: '-13%', top: 122, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.18)' },
  cosmicArcInner: { position: 'absolute', width: '103%', height: 320, left: '-1.5%', top: 158, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.17)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 124, gap: 11 },
  flex: { flex: 1 },
  pressed: { opacity: .76, transform: [{ scale: .99 }] },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconButton: { width: 37, height: 37, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', backgroundColor: 'rgba(3,9,20,.28)', alignItems: 'center', justifyContent: 'center' },
  brandCopy: { flex: 1 },
  brandTitle: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 27, lineHeight: 30 },
  brandSubtitle: { color: 'rgba(242,233,218,.62)', fontSize: 7.3, fontWeight: '800', letterSpacing: 1.85, marginTop: 2 },
  globalSearch: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(4,10,23,.32)' },
  globalSearchText: { flex: 1, color: 'rgba(242,233,218,.72)', fontFamily: Fonts.serif, fontSize: 13.5 },
  searchStar: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  searchStarVertical: { position: 'absolute', width: StyleSheet.hairlineWidth, height: 12, backgroundColor: FateDropColors.goldBright },
  searchStarHorizontal: { position: 'absolute', width: 12, height: StyleSheet.hairlineWidth, backgroundColor: FateDropColors.goldBright },
  viewTabs: { height: 46, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.23)' },
  viewTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewTabText: { color: 'rgba(242,233,218,.48)', fontFamily: Fonts.serif, fontSize: 11.2 },
  viewTabTextActive: { color: FateDropColors.goldBright },
  viewTabUnderline: { position: 'absolute', left: 15, right: 15, bottom: -1, height: 1, backgroundColor: FateDropColors.goldBright },
  heroRow: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden' },
  heroArc: { position: 'absolute', width: '118%', height: 180, left: '-9%', top: 22, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.25)' },
  heroHorizon: { position: 'absolute', left: 0, right: 0, bottom: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.30)' },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 7.2, fontWeight: '900', letterSpacing: 1.35 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, marginTop: 5, textShadowColor: 'rgba(0,0,0,.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  copy: { color: 'rgba(242,233,218,.66)', fontSize: 9.2, lineHeight: 14, marginTop: 5, maxWidth: 292 },
  addButton: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.56)', backgroundColor: 'rgba(3,9,20,.28)' },
  addButtonText: { color: FateDropColors.goldBright, fontSize: 7.1, fontWeight: '900', letterSpacing: .75 },
  summaryCard: { minHeight: 72, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', backgroundColor: 'rgba(3,8,20,.13)' },
  summaryMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  summaryLabel: { color: 'rgba(242,233,218,.46)', fontSize: 5.6, fontWeight: '900', letterSpacing: .46, textAlign: 'center' },
  summaryValue: { maxWidth: '100%', fontFamily: Fonts.serif, fontSize: 16.5, marginTop: 3, textAlign: 'center' },
  summaryDetail: { color: 'rgba(242,233,218,.42)', fontSize: 5.6, marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(226,197,141,.19)' },
  windowRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ornamentHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180 },
  ornamentLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.34)' },
  ornamentDiamond: { width: 4, height: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.goldBright, transform: [{ rotate: '45deg' }] },
  sectionEyebrow: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 8, fontWeight: '700', letterSpacing: 1.05 },
  windowCopy: { color: 'rgba(242,233,218,.43)', fontSize: 6.6, marginTop: 4 },
  windowRail: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(3,8,20,.18)' },
  windowButton: { minWidth: 42, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  windowButtonActive: { backgroundColor: 'rgba(226,197,141,.10)' },
  windowText: { color: 'rgba(242,233,218,.45)', fontSize: 7, fontWeight: '900' },
  windowTextActive: { color: FateDropColors.goldBright },
  cardStack: { gap: 14 },
  cardPanel: { position: 'relative', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', backgroundColor: 'rgba(4,10,23,.36)', overflow: 'hidden' },
  cardAtmosphere: { position: 'absolute', left: '-18%', right: '-18%', top: -48, height: 180, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.20)', backgroundColor: 'rgba(124,110,255,.018)' },
  cardHeader: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 11, paddingVertical: 12 },
  artworkStage: { width: 78, height: 94, alignItems: 'center', justifyContent: 'center' },
  artworkOrbitOuter: { position: 'absolute', width: 86, height: 43, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.43)', bottom: 6, transform: [{ rotate: '-5deg' }] },
  artworkOrbitInner: { position: 'absolute', width: 71, height: 34, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', bottom: 11 },
  cardIdentity: { flex: 1, minWidth: 0 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18.5, textShadowColor: 'rgba(0,0,0,.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  cardMeta: { color: 'rgba(242,233,218,.48)', fontSize: 7.4, marginTop: 4 },
  priceLine: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  currentPrice: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23.5, textShadowColor: 'rgba(0,0,0,.74)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  removeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.43)', backgroundColor: 'rgba(3,8,20,.22)' },
  movementLedger: { minHeight: 66, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.20)', backgroundColor: 'rgba(3,8,20,.10)' },
  moveMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  moveLabel: { color: 'rgba(242,233,218,.42)', fontSize: 5.5, fontWeight: '900', letterSpacing: .35, textAlign: 'center' },
  moveValue: { maxWidth: '100%', fontFamily: Fonts.serif, fontSize: 15.5, marginTop: 2, textAlign: 'center' },
  moveDetail: { color: 'rgba(242,233,218,.36)', fontSize: 5.3, marginTop: 2 },
  ledgerDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(226,197,141,.16)' },
  chartArea: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  chartHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartHeadingLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.20)' },
  chartTitle: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 7, letterSpacing: .85 },
  chartCount: { color: 'rgba(242,233,218,.38)', fontSize: 6.2 },
  chartRange: { minHeight: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartRangeText: { color: 'rgba(242,233,218,.38)', fontSize: 6 },
  chartPlot: { height: 78, flexDirection: 'row', alignItems: 'flex-end', gap: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.24)' },
  chartColumn: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  chartStem: { width: StyleSheet.hairlineWidth, minHeight: 7, backgroundColor: 'rgba(124,110,255,.62)' },
  chartDot: { position: 'absolute', top: -2, left: -2, width: 5, height: 5, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(242,233,218,.86)', backgroundColor: FateDropColors.goldBright },
  chartAxis: { minHeight: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartAxisText: { color: 'rgba(242,233,218,.36)', fontSize: 5.8 },
  chartEmpty: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 6 },
  chartEmptyText: { color: 'rgba(242,233,218,.42)', fontSize: 7.2, lineHeight: 11, textAlign: 'center' },
  cardFooter: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.18)' },
  fairRange: { flex: 1 },
  footerLabel: { color: 'rgba(242,233,218,.40)', fontSize: 5.8, fontWeight: '900', letterSpacing: .45 },
  footerValue: { color: FateDropColors.ivory, fontSize: 8.5, fontWeight: '800', marginTop: 3 },
  openPrice: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', backgroundColor: 'rgba(3,8,20,.16)' },
  openPriceText: { color: FateDropColors.goldBright, fontSize: 6.1, fontWeight: '900', letterSpacing: .5 },
  emptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.30)', backgroundColor: 'rgba(4,10,23,.26)', overflow: 'hidden' },
  emptyOrbit: { width: 78, height: 78, borderRadius: 39, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.40)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, marginTop: 10 },
  emptyCopy: { color: 'rgba(242,233,218,.58)', fontSize: 9.3, lineHeight: 15, textAlign: 'center', marginTop: 7 },
  emptyAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, paddingHorizontal: 13, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.52)', backgroundColor: 'rgba(3,8,20,.20)' },
  emptyActionText: { color: FateDropColors.goldBright, fontSize: 7.2, fontWeight: '900', letterSpacing: .7 },
  setSection: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(4,10,23,.26)', overflow: 'hidden' },
  setHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.18)' },
  setHeadingLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.24)' },
  setHeadingText: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15.5 },
  setRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.14)' },
  setIcon: { width: 38, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', backgroundColor: 'rgba(3,8,20,.18)' },
  setName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  setMeta: { color: 'rgba(242,233,218,.42)', fontSize: 7, marginTop: 3 },
  footerNote: { color: 'rgba(242,233,218,.36)', fontSize: 7, lineHeight: 10.5, textAlign: 'center', paddingHorizontal: 20 },
});