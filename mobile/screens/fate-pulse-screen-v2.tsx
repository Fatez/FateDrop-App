import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CanonicalThumbnail } from '@/components/canonical-thumbnail';
import { MarketSetCatalogueLink } from '@/components/market-set-catalogue-link';
import { FatePriceCardGlyph } from '@/components/fate-price-chrome';
import { FateMarketBackground, FateMarketHeader } from '@/components/fate-market-brand';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { appSavedNotice } from '@/services/app-saved-items';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  addFatePulseCardFollow,
  addFatePulseSetFollow,
  loadFatePulseFollows,
  removeFatePulseCardFollow,
  removeFatePulseSetFollow,
  type FatePulseCardFollow,
  type FatePulseFollows,
  type FatePulseSetFollow,
} from '@/services/fate-pulse-follows';
import {
  fetchFatePrice,
  fetchFatePulse,
  type FatePriceSnapshot,
  type FatePulseDirectionPeriod,
  type FatePulseRankedCard,
  type FatePulseRankedSet,
  type FatePulseSnapshot,
} from '@/services/fate-market';

export type PulseView = 'overview' | 'sets' | 'cards' | 'watchlist';
type PulsePeriod = 'd1' | 'd7' | 'd30' | 'd90';
type MarketScope = 'all' | TcgCode;
type DirectionFilter = 'risers' | 'fallers';

const EMPTY_FOLLOWS: FatePulseFollows = { cards: [], sets: [] };
const VIEWS: { key: PulseView; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'sets', label: 'Sets' },
  { key: 'cards', label: 'Cards' },
  { key: 'watchlist', label: 'My Insights' },
];
const PERIODS: { key: PulsePeriod; label: string }[] = [
  { key: 'd1', label: '1D' },
  { key: 'd7', label: '7D' },
  { key: 'd30', label: '30D' },
  { key: 'd90', label: '90D' },
];

function scopeLabel(scope: MarketScope) {
  if (scope === 'all') return 'All TCGs';
  return TCG_REGISTRY.find((entry) => entry.code === scope)?.shortName ?? scope;
}

function movement(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const currency = currencyCode || 'EUR';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function conditionLabel(value: FatePulseDirectionPeriod['condition'] | undefined) {
  if (value === 'broadly_rising') return 'Heating Up';
  if (value === 'broadly_falling') return 'Cooling Down';
  if (value === 'mixed') return 'Mixed Market';
  if (value === 'unchanged') return 'Stable';
  return 'Building';
}

function movementAccent(value: number | null | undefined) {
  if (value == null || value === 0) return FateDropColors.goldBright;
  return value > 0 ? FateDropColors.manifested : FateDropColors.vanished;
}

function routeForView(view: PulseView) {
  if (view === 'sets') return '/fate-pulse/sets' as const;
  if (view === 'cards') return '/fate-pulse/cards' as const;
  if (view === 'watchlist') return '/fate-pulse/my-pulse' as const;
  return '/fate-pulse' as const;
}

function cardFollowFromRanked(item: FatePulseRankedCard): FatePulseCardFollow {
  return {
    cardIdentityId: item.cardIdentityId,
    printingId: '',
    tcgCode: item.tcgCode,
    name: item.name || 'Exact card',
    setName: item.setName || 'Verified set',
    collectorNumber: item.collectorNumber || '',
    addedAt: Date.now(),
  };
}

function setFollowFromRanked(item: FatePulseRankedSet): FatePulseSetFollow {
  return {
    key: item.key,
    tcgCode: item.tcgCode,
    setCode: item.setCode,
    setName: item.setName || 'Verified set',
    addedAt: Date.now(),
  };
}

export default function FatePulseScreenV2({ initialView = 'overview' }: { initialView?: PulseView }) {
  const params = useLocalSearchParams<{ period?: string; direction?: string; scope?: string; setKey?: string; setName?: string }>();
  const { snapshot } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [view, setView] = useState<PulseView>(initialView);
  const [periodKey, setPeriodKey] = useState<PulsePeriod>(PERIODS.some((item) => item.key === params.period) ? params.period as PulsePeriod : 'd30');
  const [scope, setScope] = useState<MarketScope>(isTcgCode(params.scope) ? params.scope : 'all');
  const [pulse, setPulse] = useState<FatePulseSnapshot | null>(null);
  const [loadedScope, setLoadedScope] = useState<MarketScope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [follows, setFollows] = useState<FatePulseFollows>(EMPTY_FOLLOWS);
  const loadGeneration = useRef(0);

  const scopeOptions = useMemo<MarketScope[]>(() => {
    const selected = snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'];
    return ['all', ...selected.filter(isTcgCode)];
  }, [snapshot?.tcgPreferences.selectedTcgCodes]);

  const load = useCallback(async (force = false) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    try {
      const next = await fetchFatePulse(scope === 'all' ? undefined : scope, { force });
      if (generation !== loadGeneration.current) return;
      setPulse(next);
      setLoadedScope(scope);
    } catch {
      if (generation !== loadGeneration.current) return;
      setError('Market data is temporarily unavailable.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(false);
    void loadFatePulseFollows(identity).then((next) => { if (active) { setFollows(next); setError(appSavedNotice(identity,'insights')); } }).catch(() => { if (active) setError('Saved follows could not be loaded. Please reopen this page.'); });
    return () => {
      active = false;
      loadGeneration.current += 1;
    };
  }, [identity, load]));

  const toggleCard = useCallback(async (item: FatePulseRankedCard) => {
    const tracked = follows.cards.some((follow) => follow.cardIdentityId === item.cardIdentityId);
    const next = tracked
      ? await removeFatePulseCardFollow(identity, item.cardIdentityId)
      : await addFatePulseCardFollow(identity, cardFollowFromRanked(item));
    setFollows(next);
  }, [follows.cards, identity]);

  const toggleSet = useCallback(async (item: FatePulseRankedSet) => {
    const tracked = follows.sets.some((follow) => follow.key === item.key);
    const next = tracked
      ? await removeFatePulseSetFollow(identity, item.key)
      : await addFatePulseSetFollow(identity, setFollowFromRanked(item));
    setFollows(next);
  }, [follows.sets, identity]);

  const removeCardFollow = useCallback(async (cardIdentityId: string) => {
    setFollows(await removeFatePulseCardFollow(identity, cardIdentityId));
  }, [identity]);

  const removeSetFollow = useCallback(async (key: string) => {
    setFollows(await removeFatePulseSetFollow(identity, key));
  }, [identity]);

  const data = loadedScope === scope ? pulse : null;
  const period = periodKey === 'd90' ? undefined : data?.pulse?.direction?.periods[periodKey];
  const currency = data?.source.currencyCode || 'EUR';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateMarketBackground />

      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true)} tintColor={FateDropColors.goldBright} />}
      >
        <FateMarketHeader title="FateInsight" subtitle="Understand the market. Follow what matters to you." />

        <Pressable accessibilityRole="button" accessibilityLabel="Search any exact card or set" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.globalSearch, pressed && styles.pressed]}>
          <Ionicons name="search-outline" size={19} color={FateDropColors.secondary} />
          <Text style={styles.globalSearchText}>Search any card or set</Text>
          <Ionicons name="arrow-forward" size={16} color={FateDropColors.goldBright} />
        </Pressable>

        <View accessibilityRole="tablist" style={styles.viewTabs}>
          {VIEWS.map((item) => {
            const selected = view === item.key;
            return (
              <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { setView(item.key); router.replace({ pathname: routeForView(item.key), params: { period: periodKey, scope } }); }} style={styles.viewTab}>
                <Text style={[styles.viewTabText, selected && styles.viewTabTextActive]}>{item.label}</Text>
                {selected ? <View style={styles.viewTabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.periodRail}>
          {PERIODS.map((item) => {
            const selected = periodKey === item.key;
            return (
              <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPeriodKey(item.key)} style={[styles.periodButton, selected && styles.periodButtonActive]}>
                <Text style={[styles.periodText, selected && styles.periodTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRail}>
          {scopeOptions.map((item) => {
            const selected = scope === item;
            return (
              <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setScope(item)} style={[styles.scopeChip, selected && styles.scopeChipActive]}>
                <Text style={[styles.scopeText, selected && styles.scopeTextActive]}>{scopeLabel(item)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? <CompactNotice icon="cloud-offline-outline" text={error} /> : null}
        {periodKey === 'd90' ? <CompactNotice icon="time-outline" text="90-day rankings will appear when verified 90D market history is available." /> : null}
        {loading && !data ? <View style={styles.loadingPanel}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Loading market movement…</Text></View> : null}

        {view === 'overview' ? (
          <OverviewView
            data={data}
            period={period}
            currency={currency}
            follows={follows}
            onToggleCard={toggleCard}
            onToggleSet={toggleSet}
          />
        ) : null}
        {view === 'sets' ? (
          <SetsView key={`${params.direction}:${params.setKey}`} selectedSetKey={params.setKey} selectedSetName={params.setName} initialDirection={params.direction === 'fallers' ? 'fallers' : 'risers'} period={period} currency={currency} follows={follows} onToggleSet={toggleSet} />
        ) : null}
        {view === 'cards' ? (
          <CardsView key={params.direction} initialDirection={params.direction === 'fallers' ? 'fallers' : 'risers'} period={period} currency={currency} follows={follows} onToggleCard={toggleCard} />
        ) : null}
        {view === 'watchlist' ? (
          <MyPulseView
            follows={follows}
            period={period}
            pulseCurrency={currency}
            onRemoveCard={removeCardFollow}
            onRemoveSet={removeSetFollow}
          />
        ) : null}

        {data ? (
          <Text style={styles.dataFoot}>
            {data.readiness.canonical.mappedCards} mapped cards · {data.readiness.history.distinctMarketDays} verified market days · last market day {data.readiness.history.latestMarketDay || '—'}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewView({
  data,
  period,
  currency,
  follows,
  onToggleCard,
  onToggleSet,
}: {
  data: FatePulseSnapshot | null;
  period: FatePulseDirectionPeriod | undefined;
  currency: string;
  follows: FatePulseFollows;
  onToggleCard: (item: FatePulseRankedCard) => void;
  onToggleSet: (item: FatePulseRankedSet) => void;
}) {
  const headline = period?.headlinePercent ?? null;
  const accent = movementAccent(headline);
  const risers = (period?.cardRisers ?? []).slice(0, 3);
  const fallers = (period?.cardDecliners ?? []).slice(0, 3);
  const setRisers = (period?.setRisers ?? []).slice(0, 3);
  const setFallers = (period?.setDecliners ?? []).slice(0, 3);

  return (
    <View style={styles.stack}>
      <View style={styles.marketSummary}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryEyebrow}>{data?.source.name ? `${data.source.name.toUpperCase()} MARKET` : 'MARKET SNAPSHOT'}</Text>
          <Text style={styles.summaryWindow}>CURRENT WINDOW</Text>
        </View>
        <View style={styles.summaryHeadlineRow}>
          <Text style={[styles.summaryPercent, { color: accent }]}>{movement(headline)}</Text>
          <Text style={styles.summaryCondition}>· {conditionLabel(period?.condition)}</Text>
        </View>
        <Text style={styles.summaryCopy}>{period ? `${period.breadth.risingSets} sets rising · ${period.breadth.fallingSets} falling · ${period.coverage.qualifyingSets} qualifying sets` : 'Waiting for enough verified market movement.'}</Text>
      </View>

      <MarketSection title="Largest Card Gains" icon="trending-up-outline" accent={FateDropColors.manifested} action="SEE ALL" onAction={() => router.push('/fate-pulse/cards')}>
        {risers.map((item, index) => <CardMovementRow key={item.cardIdentityId} item={item} rank={index + 1} currency={currency} tracked={follows.cards.some((follow) => follow.cardIdentityId === item.cardIdentityId)} onToggle={() => onToggleCard(item)} />)}
        {!risers.length ? <EmptyRow text="No qualifying card risers in this window yet." /> : null}
      </MarketSection>

      <MarketSection title="Largest Card Losses" icon="trending-down-outline" accent={FateDropColors.vanished} action="SEE ALL" onAction={() => router.push('/fate-pulse/cards')}>
        {fallers.map((item, index) => <CardMovementRow key={item.cardIdentityId} item={item} rank={index + 1} currency={currency} tracked={follows.cards.some((follow) => follow.cardIdentityId === item.cardIdentityId)} onToggle={() => onToggleCard(item)} />)}
        {!fallers.length ? <EmptyRow text="No qualifying card fallers in this window yet." /> : null}
      </MarketSection>

      <MarketSection title="Sets Heating Up" icon="flame-outline" accent={FateDropColors.manifested} action="SEE ALL" onAction={() => router.push('/fate-pulse/sets')}>
        {setRisers.map((item, index) => <SetMovementRow key={item.key} item={item} rank={index + 1} currency={currency} tracked={follows.sets.some((follow) => follow.key === item.key)} onToggle={() => onToggleSet(item)} />)}
        {!setRisers.length ? <EmptyRow text="No qualifying set risers in this window yet." /> : null}
      </MarketSection>

      <MarketSection title="Sets Cooling Down" icon="snow-outline" accent={FateDropColors.vanished} action="SEE ALL" onAction={() => router.push('/fate-pulse/sets')}>
        {setFallers.map((item, index) => <SetMovementRow key={item.key} item={item} rank={index + 1} currency={currency} tracked={follows.sets.some((follow) => follow.key === item.key)} onToggle={() => onToggleSet(item)} />)}
        {!setFallers.length ? <EmptyRow text="No qualifying set fallers in this window yet." /> : null}
      </MarketSection>

      <Pressable accessibilityRole="button" onPress={() => router.push('/fate-pulse/my-pulse')} style={({ pressed }) => [styles.myPulsePreview, pressed && styles.pressed]}>
        <View style={styles.previewIcon}><Ionicons name="star" size={18} color={FateDropColors.goldBright} /></View>
        <View style={styles.flex}>
          <Text style={styles.previewEyebrow}>MY INSIGHTS</Text>
          <Text style={styles.previewTitle}>{follows.cards.length + follows.sets.length ? `${follows.cards.length} cards · ${follows.sets.length} sets tracked` : 'Build your personal watchlist'}</Text>
          <Text style={styles.previewCopy}>Follow exact cards and sets without mixing them into your retail Wishlist.</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={FateDropColors.goldBright} />
      </Pressable>
    </View>
  );
}

function SetsView({ period, currency, follows, onToggleSet, initialDirection, selectedSetKey, selectedSetName }: {
  selectedSetKey?: string;
  selectedSetName?: string;
  initialDirection: DirectionFilter;
  period: FatePulseDirectionPeriod | undefined;
  currency: string;
  follows: FatePulseFollows;
  onToggleSet: (item: FatePulseRankedSet) => void;
}) {
  const [filter, setFilter] = useState<DirectionFilter>(initialDirection);
  const [focusedSet, setFocusedSet] = useState(selectedSetKey || '');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const base = filter === 'risers' ? period?.setRisers ?? [] : period?.setDecliners ?? [];
    const q = query.trim().toLowerCase();
    return base.filter((item) => (!focusedSet || item.key === focusedSet) && (!q || `${item.setName || ''} ${item.setCode || ''} ${item.tcgCode || ''}`.toLowerCase().includes(q)));
  }, [filter, period, query, focusedSet]);

  return (
    <View style={styles.stack}>
      <TabIntro eyebrow="SET MARKET" title="Which sets are moving?" copy="Ranked from verified set-basket movement. Star a set to keep it in My Insights." />
      {focusedSet ? <Pressable accessibilityRole="button" accessibilityLabel="Clear selected set and show all sets" onPress={() => { setFocusedSet(''); router.setParams({ setKey: '', setName: '' }); }} style={styles.scopeChip}><Text style={styles.scopeText}>{selectedSetName || 'Selected set'} · Show all sets</Text></Pressable> : null}
      <FilterSearch value={query} onChange={setQuery} placeholder="Filter set movers" />
      <DirectionToggle value={filter} onChange={setFilter} />
      <MarketSection title={filter === 'risers' ? 'Set Risers' : 'Set Fallers'} icon={filter === 'risers' ? 'trending-up-outline' : 'trending-down-outline'} accent={filter === 'risers' ? FateDropColors.manifested : FateDropColors.vanished}>
        {rows.map((item) => <SetMovementRow key={item.key} item={item} rank={(filter === 'risers' ? period?.setRisers ?? [] : period?.setDecliners ?? []).findIndex((entry) => entry.key === item.key) + 1} currency={currency} tracked={follows.sets.some((follow) => follow.key === item.key)} onToggle={() => onToggleSet(item)} />)}
        {!rows.length ? <EmptyRow text="No qualifying sets match this view." /> : null}
      </MarketSection>
    </View>
  );
}

function CardsView({ period, currency, follows, onToggleCard, initialDirection }: {
  initialDirection: DirectionFilter;
  period: FatePulseDirectionPeriod | undefined;
  currency: string;
  follows: FatePulseFollows;
  onToggleCard: (item: FatePulseRankedCard) => void;
}) {
  const [filter, setFilter] = useState<DirectionFilter>(initialDirection);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const base = filter === 'risers' ? period?.cardRisers ?? [] : period?.cardDecliners ?? [];
    const q = query.trim().toLowerCase();
    return base.filter((item) => !q || `${item.name || ''} ${item.setName || ''} ${item.collectorNumber || ''}`.toLowerCase().includes(q));
  }, [filter, period, query]);

  return (
    <View style={styles.stack}>
      <TabIntro eyebrow="CARD MARKET" title="What’s moving right now?" copy="Tap a card for its exact FatePrice. Star it to track it in My Insights." />
      <View style={styles.findAnyRow}>
        <FilterSearch value={query} onChange={setQuery} placeholder="Filter current movers" compact />
        <Pressable accessibilityRole="button" accessibilityLabel="Find any exact card" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.findAnyButton, pressed && styles.pressed]}>
          <Ionicons name="search" size={16} color={FateDropColors.background} />
        </Pressable>
      </View>
      <DirectionToggle value={filter} onChange={setFilter} />
      <MarketSection title={filter === 'risers' ? 'Largest Price Gains' : 'Largest Price Losses'} icon={filter === 'risers' ? 'trending-up-outline' : 'trending-down-outline'} accent={filter === 'risers' ? FateDropColors.manifested : FateDropColors.vanished}>
        {rows.map((item) => <CardMovementRow key={item.cardIdentityId} item={item} rank={(filter === 'risers' ? period?.cardRisers ?? [] : period?.cardDecliners ?? []).findIndex((entry) => entry.cardIdentityId === item.cardIdentityId) + 1} currency={currency} tracked={follows.cards.some((follow) => follow.cardIdentityId === item.cardIdentityId)} onToggle={() => onToggleCard(item)} />)}
        {!rows.length ? <EmptyRow text="No qualifying exact cards match this view." /> : null}
      </MarketSection>
    </View>
  );
}

function MyPulseView({ follows, period, pulseCurrency, onRemoveCard, onRemoveSet }: {
  follows: FatePulseFollows;
  period: FatePulseDirectionPeriod | undefined;
  pulseCurrency: string;
  onRemoveCard: (cardIdentityId: string) => void;
  onRemoveSet: (key: string) => void;
}) {
  const [prices, setPrices] = useState<Record<string, FatePriceSnapshot | null>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    let active = true;
    if (!follows.cards.length) {
      setPrices({});
      return () => { active = false; };
    }
    setLoadingPrices(true);
    void Promise.allSettled(follows.cards.map(async (follow) => [follow.cardIdentityId, await fetchFatePrice(follow.cardIdentityId)] as const)).then((results) => {
      if (!active) return;
      const next: Record<string, FatePriceSnapshot | null> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') next[result.value[0]] = result.value[1];
      }
      setPrices(next);
      setLoadingPrices(false);
    });
    return () => { active = false; };
  }, [follows.cards]);

  const rankedCards = useMemo(() => new Map([...(period?.cardRisers ?? []), ...(period?.cardDecliners ?? [])].map((item) => [item.cardIdentityId, item])), [period]);
  const rankedSets = useMemo(() => new Map([...(period?.setRisers ?? []), ...(period?.setDecliners ?? [])].map((item) => [item.key, item])), [period]);

  return (
    <View style={styles.stack}>
      <View style={styles.watchHeader}>
        <View style={styles.flex}>
          <Text style={styles.tabEyebrow}>PERSONAL WATCHLIST</Text>
          <Text style={styles.tabTitle}>Your market. Your cards.</Text>
          <Text style={styles.tabCopy}>Track exact cards here. Wishlist stays for retail stock and FateFind.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color={FateDropColors.background} />
          <Text style={styles.addButtonText}>ADD CARD</Text>
        </Pressable>
      </View>

      {!follows.cards.length && !follows.sets.length ? (
        <View style={styles.emptyWatchlist}>
          <Ionicons name="star-outline" size={28} color={FateDropColors.goldBright} />
          <Text style={styles.emptyWatchTitle}>Nothing tracked yet.</Text>
          <Text style={styles.emptyWatchCopy}>Find any exact card, choose the correct printing, then tap Add to My Insights. You can also star cards and sets directly from FateInsight rankings.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.emptyWatchAction, pressed && styles.pressed]}>
            <Text style={styles.emptyWatchActionText}>FIND AN EXACT CARD</Text>
            <Ionicons name="arrow-forward" size={15} color={FateDropColors.background} />
          </Pressable>
        </View>
      ) : null}

      {follows.cards.length ? (
        <MarketSection title="Watched Cards" icon="star" accent={FateDropColors.goldBright} trailing={loadingPrices ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : undefined}>
          {follows.cards.map((follow, index) => {
            const ranked = rankedCards.get(follow.cardIdentityId);
            const price = prices[follow.cardIdentityId];
            const currentPrice = ranked?.currentPrice ?? price?.price?.amount ?? null;
            const currency = price?.price?.currencyCode || price?.marketScope?.currencyCode || pulseCurrency;
            const exactMovement = ranked?.movementPercent
              ?? (price?.movement.d30.available ? price.movement.d30.percent : null);
            return <FollowedCardRow key={follow.cardIdentityId} follow={follow} rank={index + 1} currentPrice={currentPrice} currency={currency} movementPercent={exactMovement} onRemove={() => onRemoveCard(follow.cardIdentityId)} />;
          })}
        </MarketSection>
      ) : null}

      {follows.sets.length ? (
        <MarketSection title="Watched Sets" icon="albums-outline" accent={FateDropColors.goldBright}>
          {follows.sets.map((follow, index) => {
            const ranked = rankedSets.get(follow.key);
            return <FollowedSetRow key={follow.key} follow={follow} rank={index + 1} ranked={ranked} currency={pulseCurrency} onRemove={() => onRemoveSet(follow.key)} />;
          })}
        </MarketSection>
      ) : null}

      <Text style={styles.localNote}>Preview foundation: My Insights follows are currently stored against this FateDrop ID on this device while the Cloud follow contract is built. Market prices and movement still come from FateDrop Cloud.</Text>
    </View>
  );
}

function MarketSection({ title, icon, accent, action, onAction, trailing, children }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  action?: string;
  onAction?: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}><Ionicons name={icon} size={18} color={accent} /><Text style={styles.sectionTitle}>{title}</Text></View>
        {trailing}
        {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => pressed ? styles.pressed : undefined}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

function CardMovementRow({ item, rank, currency, tracked, onToggle }: {
  item: FatePulseRankedCard;
  rank: number;
  currency: string;
  tracked: boolean;
  onToggle: () => void;
}) {
  const accent = movementAccent(item.movementPercent);
  return (
    <View style={styles.marketRow}>
      <Text style={styles.rank}>{rank}</Text>
      <FatePriceCardGlyph collectorNumber={item.collectorNumber || ''} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${item.name || 'exact card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.cardIdentityId, name: item.name || '', setName: item.setName || '', collectorNumber: item.collectorNumber || '', tcg: item.tcgCode || '' } })} style={({ pressed }) => [styles.rowMain, pressed && styles.rowMainPressed]}>
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.rowTitle}>{item.name || 'Exact card'}</Text>
          <Text numberOfLines={1} style={styles.rowMeta}>{item.setName || 'Verified set'}{item.collectorNumber ? ` · #${item.collectorNumber}` : ''}</Text>
        </View>
        <View style={styles.rowNumbers}>
          <Text style={styles.rowPrice}>{formatMoney(item.currentPrice, currency)}</Text>
          <Text style={[styles.rowMovement, { color: accent }]}>{(item.movementAmount ?? 0) > 0 ? '+' : ''}{formatMoney(item.movementAmount, currency)}</Text>
          <Text style={[styles.rowMovement, { color: accent }]}>{movement(item.movementPercent)}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={tracked ? 'Remove from My Insights' : 'Add to My Insights'} onPress={onToggle} style={({ pressed }) => [styles.starButton, tracked && styles.starButtonActive, pressed && styles.pressed]}>
        <Ionicons name={tracked ? 'star' : 'star-outline'} size={17} color={tracked ? FateDropColors.goldBright : FateDropColors.muted} />
      </Pressable>
    </View>
  );
}

function SetMovementRow({ item, rank, currency, tracked, onToggle }: {
  item: FatePulseRankedSet;
  rank: number;
  currency: string;
  tracked: boolean;
  onToggle: () => void;
}) {
  const accent = movementAccent(item.movementPercent);
  return (
    <View style={styles.marketRow}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.setGlyph}><Ionicons name="albums-outline" size={19} color={FateDropColors.goldBright} /></View>
      <MarketSetCatalogueLink tcgCode={item.tcgCode} setCode={item.setCode} name={item.setName} style={styles.rowMainStatic}>
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.rowTitle}>{item.setName || 'Verified set'}</Text>
          <Text numberOfLines={1} style={styles.rowMeta}>{item.pricedCardCount} priced cards · View cards ›</Text>
        </View>
        <View style={styles.rowNumbers}>
          <Text style={styles.rowPrice}>{formatMoney(item.currentBasketValue, currency)}</Text>
          <Text style={[styles.rowMovement, { color: accent }]}>{movement(item.movementPercent)}</Text>
        </View>
      </MarketSetCatalogueLink>
      <Pressable accessibilityRole="button" accessibilityLabel={tracked ? 'Remove set from My Insights' : 'Add set to My Insights'} onPress={onToggle} style={({ pressed }) => [styles.starButton, tracked && styles.starButtonActive, pressed && styles.pressed]}>
        <Ionicons name={tracked ? 'star' : 'star-outline'} size={17} color={tracked ? FateDropColors.goldBright : FateDropColors.muted} />
      </Pressable>
    </View>
  );
}

function FollowedCardRow({ follow, rank, currentPrice, currency, movementPercent, onRemove }: {
  follow: FatePulseCardFollow;
  rank: number;
  currentPrice: number | null;
  currency: string | null;
  movementPercent: number | null | undefined;
  onRemove: () => void;
}) {
  return (
    <View style={styles.marketRow}>
      <Text style={styles.rank}>{rank}</Text>
      <CanonicalThumbnail kind="card" setId={follow.setId} collectorNumber={follow.collectorNumber} width={48} height={67} />
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: follow.cardIdentityId, name: follow.name, setName: follow.setName, collectorNumber: follow.collectorNumber, printingId: follow.printingId, tcg: follow.tcgCode || '' } })} style={({ pressed }) => [styles.rowMain, pressed && styles.rowMainPressed]}>
        <View style={styles.rowCopy}><Text numberOfLines={1} style={styles.rowTitle}>{follow.name}</Text><Text numberOfLines={1} style={styles.rowMeta}>{follow.setName}{follow.collectorNumber ? ` · #${follow.collectorNumber}` : ''}</Text></View>
        <View style={styles.rowNumbers}><Text style={styles.rowPrice}>{formatMoney(currentPrice, currency)}</Text><Text style={[styles.rowMovement, { color: movementAccent(movementPercent) }]}>{movement(movementPercent)}</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Remove card from My Insights" onPress={onRemove} style={({ pressed }) => [styles.starButton, styles.starButtonActive, pressed && styles.pressed]}><Ionicons name="star" size={17} color={FateDropColors.goldBright} /></Pressable>
    </View>
  );
}

function FollowedSetRow({ follow, rank, ranked, currency, onRemove }: {
  follow: FatePulseSetFollow;
  rank: number;
  ranked: FatePulseRankedSet | undefined;
  currency: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.marketRow}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.setGlyph}><Ionicons name="albums-outline" size={19} color={FateDropColors.goldBright} /></View>
      <View style={styles.rowMainStatic}>
        <View style={styles.rowCopy}><Text numberOfLines={1} style={styles.rowTitle}>{follow.setName}</Text><Text numberOfLines={1} style={styles.rowMeta}>{follow.setCode || follow.tcgCode || 'Tracked set'}</Text></View>
        <View style={styles.rowNumbers}><Text style={styles.rowPrice}>{formatMoney(ranked?.currentBasketValue, currency)}</Text><Text style={[styles.rowMovement, { color: movementAccent(ranked?.movementPercent) }]}>{movement(ranked?.movementPercent)}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Remove set from My Insights" onPress={onRemove} style={({ pressed }) => [styles.starButton, styles.starButtonActive, pressed && styles.pressed]}><Ionicons name="star" size={17} color={FateDropColors.goldBright} /></Pressable>
    </View>
  );
}

function TabIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <View style={styles.tabIntro}><Text style={styles.tabEyebrow}>{eyebrow}</Text><Text style={styles.tabTitle}>{title}</Text><Text style={styles.tabCopy}>{copy}</Text></View>;
}

function DirectionToggle({ value, onChange }: { value: DirectionFilter; onChange: (value: DirectionFilter) => void }) {
  return (
    <View style={styles.directionToggle}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: value === 'risers' }} onPress={() => onChange('risers')} style={[styles.directionButton, value === 'risers' && styles.directionButtonActive]}><Ionicons name="trending-up-outline" size={15} color={value === 'risers' ? FateDropColors.manifested : FateDropColors.muted} /><Text style={[styles.directionText, value === 'risers' && styles.directionTextActive]}>Risers</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: value === 'fallers' }} onPress={() => onChange('fallers')} style={[styles.directionButton, value === 'fallers' && styles.directionButtonActive]}><Ionicons name="trending-down-outline" size={15} color={value === 'fallers' ? FateDropColors.vanished : FateDropColors.muted} /><Text style={[styles.directionText, value === 'fallers' && styles.directionTextActive]}>Fallers</Text></Pressable>
    </View>
  );
}

function FilterSearch({ value, onChange, placeholder, compact = false }: { value: string; onChange: (value: string) => void; placeholder: string; compact?: boolean }) {
  return <View style={[styles.filterSearch, compact && styles.filterSearchCompact]}><Ionicons name="search-outline" size={16} color={FateDropColors.muted} /><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={FateDropColors.muted} style={styles.filterInput} autoCorrect={false} />{value ? <Pressable accessibilityLabel="Clear filter" onPress={() => onChange('')}><Ionicons name="close-circle" size={16} color={FateDropColors.muted} /></Pressable> : null}</View>;
}

function CompactNotice({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.notice}><Ionicons name={icon} size={16} color={FateDropColors.vanished} /><Text style={styles.noticeText}>{text}</Text></View>;
}

function EmptyRow({ text }: { text: string }) {
  return <Text style={styles.emptyRow}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  backgroundVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,14,.62)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 124, gap: 12 },
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
  periodRail: { flexDirection: 'row', gap: 8 },
  periodButton: { flex: 1, minHeight: 39, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(130,143,180,.24)', backgroundColor: 'rgba(7,13,26,.78)', alignItems: 'center', justifyContent: 'center' },
  periodButtonActive: { borderColor: 'rgba(226,197,141,.85)', backgroundColor: 'rgba(226,197,141,.12)' },
  periodText: { color: FateDropColors.muted, fontSize: 9.5, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.goldBright },
  scopeRail: { gap: 7, paddingVertical: 1 },
  scopeChip: { minHeight: 31, paddingHorizontal: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(130,143,180,.22)', backgroundColor: 'rgba(5,11,21,.68)', alignItems: 'center', justifyContent: 'center' },
  scopeChipActive: { borderColor: 'rgba(226,197,141,.55)', backgroundColor: 'rgba(226,197,141,.08)' },
  scopeText: { color: FateDropColors.muted, fontSize: 8, fontWeight: '800' },
  scopeTextActive: { color: FateDropColors.goldBright },
  stack: { gap: 13 },
  loadingPanel: { minHeight: 88, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(130,143,180,.22)', backgroundColor: 'rgba(7,13,26,.82)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: FateDropColors.secondary, fontSize: 9 },
  marketSummary: { minHeight: 158, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.30)', backgroundColor: 'rgba(4,8,21,.84)' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.55 },
  summaryWindow: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '800' },
  summaryHeadlineRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 18 },
  summaryPercent: { fontFamily: Fonts.serif, fontSize: 39, lineHeight: 44 },
  summaryCondition: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 18, marginLeft: 6 },
  summaryCopy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 9 },
  sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.25)', backgroundColor: 'rgba(4,8,21,.84)', overflow: 'hidden' },
  sectionHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,136,177,.21)' },
  sectionTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17 },
  sectionAction: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: .8 },
  marketRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,136,177,.18)' },
  rank: { width: 15, color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 11, textAlign: 'center' },
  rowMain: { flex: 1, minWidth: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMainStatic: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMainPressed: { opacity: .72 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13.5 },
  rowMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 4 },
  rowNumbers: { minWidth: 72, alignItems: 'flex-end' },
  rowPrice: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '800' },
  rowMovement: { fontSize: 10.5, fontWeight: '900', marginTop: 4 },
  starButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(130,143,180,.23)', backgroundColor: 'rgba(3,8,18,.62)' },
  starButtonActive: { borderColor: 'rgba(226,197,141,.52)', backgroundColor: 'rgba(226,197,141,.08)' },
  setGlyph: { width: 36, height: 44, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', backgroundColor: 'rgba(226,197,141,.06)', alignItems: 'center', justifyContent: 'center' },
  emptyRow: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 22 },
  myPulsePreview: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(10,14,25,.94)' },
  previewIcon: { width: 42, height: 42, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', backgroundColor: 'rgba(226,197,141,.08)', alignItems: 'center', justifyContent: 'center' },
  previewEyebrow: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  previewTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15, marginTop: 3 },
  previewCopy: { color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11, marginTop: 3 },
  tabIntro: { paddingVertical: 6 },
  tabEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.25 },
  tabTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23, lineHeight: 27, marginTop: 5 },
  tabCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 5 },
  filterSearch: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(226,197,141,.25)', backgroundColor: 'rgba(5,11,22,.82)' },
  filterSearchCompact: { flex: 1 },
  filterInput: { flex: 1, minWidth: 0, color: FateDropColors.ivory, fontSize: 10.5, paddingVertical: 10 },
  findAnyRow: { flexDirection: 'row', gap: 8 },
  findAnyButton: { width: 46, borderRadius: 13, backgroundColor: FateDropColors.goldBright, alignItems: 'center', justifyContent: 'center' },
  directionToggle: { flexDirection: 'row', gap: 8 },
  directionButton: { flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(120,136,177,.22)', backgroundColor: 'rgba(5,11,22,.7)' },
  directionButtonActive: { borderColor: 'rgba(226,197,141,.36)', backgroundColor: 'rgba(226,197,141,.06)' },
  directionText: { color: FateDropColors.muted, fontSize: 8.5, fontWeight: '900' },
  directionTextActive: { color: FateDropColors.ivory },
  watchHeader: { minHeight: 110, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  addButtonText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  emptyWatchlist: { minHeight: 235, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(6,12,25,.9)' },
  emptyWatchTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, marginTop: 10 },
  emptyWatchCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 15, textAlign: 'center', marginTop: 7 },
  emptyWatchAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, paddingHorizontal: 14, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  emptyWatchActionText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  localNote: { color: FateDropColors.muted, fontSize: 7.2, lineHeight: 11, textAlign: 'center', paddingHorizontal: 20, marginTop: 2 },
  notice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,92,112,.28)', backgroundColor: 'rgba(35,8,15,.72)' },
  noticeText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 12 },
  dataFoot: { color: FateDropColors.muted, fontSize: 7, lineHeight: 10.5, textAlign: 'center', paddingHorizontal: 18, marginTop: 2 },
});
