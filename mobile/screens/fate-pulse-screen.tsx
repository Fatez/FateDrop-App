import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  fetchFatePulse,
  type FatePulseDirectionPeriod,
  type FatePulseRankedCard,
  type FatePulseRankedSet,
  type FatePulseSnapshot,
} from '@/services/fate-market';

type PulseView = 'overview' | 'sets' | 'cards' | 'watchlist';
type PulsePeriod = 'd1' | 'd7' | 'd30' | 'd90';
type MarketScope = 'all' | TcgCode;
type SetFilter = 'trending' | 'rising' | 'falling' | 'watched';
type CardFilter = 'risers' | 'fallers' | 'watched' | 'volume';

const VIEWS: { key: PulseView; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'sets', label: 'Sets' },
  { key: 'cards', label: 'Cards' },
  { key: 'watchlist', label: 'Watchlist' },
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

function metricValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 'NOT SCORED' : `${value.toFixed(0)}/100`;
}

function conditionLabel(value: FatePulseDirectionPeriod['condition'] | undefined) {
  if (value === 'broadly_rising') return 'HEATING';
  if (value === 'broadly_falling') return 'COOLING';
  if (value === 'mixed') return 'MIXED';
  if (value === 'unchanged') return 'STABLE';
  return 'BUILDING';
}

function conditionAccent(value: FatePulseDirectionPeriod['condition'] | undefined) {
  if (value === 'broadly_falling') return FateDropColors.vanished;
  if (value === 'mixed' || value === 'unchanged') return FateDropColors.goldBright;
  return FateDropColors.manifested;
}

function setKey(item: FatePulseRankedSet) {
  return item.key;
}

function cardKey(item: FatePulseRankedCard) {
  return `${item.cardIdentityId}:${item.sourceVariantKey}`;
}

function absMovement(item: FatePulseRankedSet | FatePulseRankedCard) {
  return Math.abs(item.movementPercent ?? 0);
}

function evidenceDay(data: FatePulseSnapshot | null) {
  return data?.pulse?.anchorMarketDay || data?.readiness.history.latestMarketDay || '—';
}

export default function FatePulseScreen() {
  const { snapshot } = useFateDropId();
  const [view, setView] = useState<PulseView>('overview');
  const [periodKey, setPeriodKey] = useState<PulsePeriod>('d30');
  const [scope, setScope] = useState<MarketScope>('all');
  const [pulse, setPulse] = useState<FatePulseSnapshot | null>(null);
  const [loadedScope, setLoadedScope] = useState<MarketScope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      setError('Verified market evidence is temporarily unavailable.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => {
    void load(false);
    return () => {
      loadGeneration.current += 1;
    };
  }, [load]));

  const data = loadedScope === scope ? pulse : null;
  const direction = data?.pulse?.direction;
  const period = periodKey === 'd90' ? undefined : direction?.periods[periodKey];
  const accent = conditionAccent(period?.condition);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <Image
          source={require('../assets/images/fate-market-orbital-theme.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top center"
          cachePolicy="disk"
          enforceEarlyResizing
        />
        <View style={styles.veil} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true)} tintColor={FateDropColors.manifested} />}
      >
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Fate Market" onPress={() => router.replace('/(tabs)/market')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={19} color={FateDropColors.goldBright} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FATEPULSE</Text>
            <Text style={styles.title}>{view === 'overview' ? 'The market, in real time.' : view === 'sets' ? 'Set performance, at a glance.' : view === 'cards' ? "What's moving right now." : 'Your watchlist, in market context.'}</Text>
            <Text style={styles.subtitle}>{view === 'overview' ? 'Price movement, breadth and canonical history across tracked TCGs.' : view === 'sets' ? 'Compare qualifying set baskets and see what is heating up or cooling down.' : view === 'cards' ? 'Track the biggest verified card movers and drill into exact FatePrice evidence.' : 'A personal lens over global market data — never part of the global Pulse calculation.'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open Fate Market" onPress={() => router.replace('/(tabs)/market')} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="diamond-outline" size={18} color={FateDropColors.manifested} />
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={styles.viewTabs}>
          {VIEWS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === item.key }}
              onPress={() => setView(item.key)}
              style={[styles.viewTab, view === item.key && styles.viewTabActive]}
            >
              <Text style={[styles.viewTabText, view === item.key && styles.viewTabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRail}>
          {scopeOptions.map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: scope === item }} onPress={() => setScope(item)} style={[styles.scopeChip, scope === item && styles.scopeChipActive]}>
              <Text style={[styles.scopeText, scope === item && styles.scopeTextActive]}>{item === 'all' ? 'All TCGs' : scopeLabel(item)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <EvidenceNotice icon="cloud-offline-outline" text={error} accent={FateDropColors.vanished} /> : null}
        {loading && !data ? <View style={styles.loadingPanel}><ActivityIndicator color={FateDropColors.manifested} /><Text style={styles.loadingText}>Reading the Cloud evidence boundary…</Text></View> : null}

        {view === 'overview' ? <OverviewView data={data} period={period} periodKey={periodKey} onPeriodChange={setPeriodKey} accent={accent} /> : null}
        {view === 'sets' ? <SetsView period={period} periodKey={periodKey} onPeriodChange={setPeriodKey} /> : null}
        {view === 'cards' ? <CardsView period={period} periodKey={periodKey} onPeriodChange={setPeriodKey} /> : null}
        {view === 'watchlist' ? <WatchlistView data={data} /> : null}

        <View style={styles.truthBar}>
          <Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>Cloud owns movement, history, Market Heat, Volatility and the future Market Price Index. Missing evidence stays missing; the App never turns a placeholder into a score.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewView({ data, period, periodKey, onPeriodChange, accent }: {
  data: FatePulseSnapshot | null;
  period: FatePulseDirectionPeriod | undefined;
  periodKey: PulsePeriod;
  onPeriodChange: (value: PulsePeriod) => void;
  accent: string;
}) {
  const is90 = periodKey === 'd90';
  const heating = (period?.setRisers ?? []).slice(0, 3);
  const cooling = (period?.setDecliners ?? []).slice(0, 3);
  const evidenceAvailable = period?.status === 'available';

  return (
    <View style={styles.sectionStack}>
      <View style={styles.instrument}>
        <View pointerEvents="none" style={styles.orbitOuter} />
        <View pointerEvents="none" style={styles.orbitInner} />
        <View style={[styles.instrumentCore, { borderColor: `${accent}90` }]}>
          <Text style={styles.instrumentLabel}>MARKET DIRECTION</Text>
          <Text style={[styles.instrumentValue, { color: is90 ? FateDropColors.muted : accent }]}>{is90 ? '—' : movement(period?.headlinePercent)}</Text>
          <Text style={[styles.instrumentTrend, { color: is90 ? FateDropColors.muted : accent }]}>{is90 ? '90D BUILDING' : conditionLabel(period?.condition)}</Text>
        </View>
        <OrbMetric position="left" label="MARKET HEAT" value={metricValue(data?.intelligence.marketHeat)} accent={FateDropColors.manifested} />
        <OrbMetric position="right" label="VOLATILITY" value={metricValue(data?.intelligence.volatility)} accent={FateDropColors.goldBright} />
        <OrbMetric position="bottom" label="TREND" value={is90 ? 'BUILDING' : conditionLabel(period?.condition)} accent={accent} />
      </View>

      <PeriodRail value={periodKey} onChange={onPeriodChange} />

      <View style={styles.indexCard}>
        <View style={styles.indexTop}>
          <View style={styles.indexIcon}><Ionicons name="pulse-outline" size={17} color={FateDropColors.goldBright} /></View>
          <View style={styles.indexCopy}>
            <Text style={styles.smallEyebrow}>MARKET PRICE INDEX</Text>
            <Text style={styles.indexTitle}>Canonical market index</Text>
          </View>
          <Text style={styles.indexValue}>—</Text>
        </View>
        <View style={styles.indexStatusRow}>
          <Text style={styles.indexStatus}>INDEX NOT CONNECTED</Text>
          <Text style={styles.indexPeriod}>{periodKey.slice(1)}D VIEW</Text>
        </View>
        <Text style={styles.indexNote}>The current headline above is the Cloud-owned median return of qualifying set baskets. FatePulse will not relabel that movement statistic as the Market Price Index; the index gets its own value only when Cloud publishes the real index contract.</Text>
      </View>

      {is90 ? (
        <EvidenceNotice icon="time-outline" text="The visual 90D lane is reserved, but the current Pulse Cloud contract publishes 1D, 7D and 30D direction only. 90D remains visibly unscored until Cloud owns it." accent={FateDropColors.goldBright} />
      ) : (
        <View style={styles.breadthCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.smallEyebrow}>MARKET BREADTH</Text>
              <Text style={styles.cardTitle}>{period ? `${period.coverage.qualifyingSets} of ${period.coverage.trackedSets} tracked sets qualify` : 'Coverage building'}</Text>
            </View>
            <Text style={[styles.directionNumber, { color: accent }]}>{movement(period?.headlinePercent)}</Text>
          </View>
          <View style={styles.breadthRow}>
            <BreadthPill label="RISING" value={period?.breadth.risingSets ?? 0} accent={FateDropColors.manifested} />
            <BreadthPill label="STABLE" value={period?.breadth.unchangedSets ?? 0} accent={FateDropColors.goldBright} />
            <BreadthPill label="FALLING" value={period?.breadth.fallingSets ?? 0} accent={FateDropColors.vanished} />
          </View>
          <Text style={styles.coverageText}>{period ? `${period.coverage.currentPriceCoveragePct?.toFixed(1) ?? '—'}% current price coverage · ${period.coverage.exactBaselineCoveragePct?.toFixed(1) ?? '—'}% exact baseline` : 'Waiting for qualifying coverage.'}</Text>
        </View>
      )}

      <View style={styles.evidenceCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.smallEyebrow}>EVIDENCE COVERAGE</Text>
            <Text style={styles.cardTitle}>{evidenceAvailable ? 'Qualified market evidence' : 'Evidence still building'}</Text>
          </View>
          <Ionicons name="shield-checkmark-outline" size={18} color={evidenceAvailable ? FateDropColors.manifested : FateDropColors.goldBright} />
        </View>
        <View style={styles.evidenceGrid}>
          <EvidenceMetric label="QUALIFYING SETS" value={period ? `${period.coverage.qualifyingSets}/${period.coverage.trackedSets}` : '—'} />
          <EvidenceMetric label="MAPPED CARDS" value={data ? String(data.readiness.canonical.mappedCards) : '—'} />
          <EvidenceMetric label="HISTORY" value={data ? `${data.readiness.history.distinctMarketDays} DAYS` : '—'} />
          <EvidenceMetric label="LAST MARKET DAY" value={evidenceDay(data)} />
        </View>
        <Text style={styles.evidenceFoot}>{data ? `${data.readiness.canonical.mappingCoveragePct?.toFixed(1) ?? '—'}% canonical mapping coverage · ${data.pulse?.evidence.currentCardCount ?? 0} current card observations in the Pulse anchor.` : 'Waiting for Cloud readiness evidence.'}</Text>
      </View>

      <View style={styles.movementSplit}>
        <MovementColumn title="HEATING UP" subtitle="Top qualifying set risers" items={heating} accent={FateDropColors.manifested} />
        <MovementColumn title="COOLING DOWN" subtitle="Top qualifying set fallers" items={cooling} accent={FateDropColors.vanished} />
      </View>

      {!is90 && heating.length === 0 && cooling.length === 0 ? <EvidenceNotice icon="analytics-outline" text="No qualifying set movement is available for this window yet. FatePulse will show the rankings as soon as the Cloud evidence boundary qualifies them." accent={FateDropColors.manifested} /> : null}
      {is90 ? <EvidenceNotice icon="analytics-outline" text="90D heating and cooling rankings will appear here once the Cloud Pulse contract publishes that evidence window." accent={FateDropColors.goldBright} /> : null}
    </View>
  );
}

function SetsView({ period, periodKey, onPeriodChange }: {
  period: FatePulseDirectionPeriod | undefined;
  periodKey: PulsePeriod;
  onPeriodChange: (value: PulsePeriod) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SetFilter>('trending');
  const is90 = periodKey === 'd90';
  const unsupported = filter === 'watched';

  const rows = useMemo(() => {
    if (!period || unsupported) return [];
    const base = filter === 'rising'
      ? period.setRisers
      : filter === 'falling'
        ? period.setDecliners
        : [...period.setRisers, ...period.setDecliners].sort((a, b) => absMovement(b) - absMovement(a));
    const q = query.trim().toLowerCase();
    return base.filter((item) => !q || `${item.setName ?? ''} ${item.setCode ?? ''} ${item.tcgCode ?? ''}`.toLowerCase().includes(q));
  }, [filter, period, query, unsupported]);

  return (
    <View style={styles.sectionStack}>
      <SearchBox value={query} onChange={setQuery} placeholder="Search sets (e.g. 151, Evolving Skies…)" />
      <PeriodRail value={periodKey} onChange={onPeriodChange} />
      <FilterRail options={[
        ['trending', 'Trending'], ['rising', 'Rising'], ['falling', 'Falling'], ['watched', 'Most Watched'],
      ]} value={filter} onChange={(value) => setFilter(value as SetFilter)} />

      {is90 ? <EvidenceNotice icon="time-outline" text="90D set performance is reserved in the UI but not yet published by the Pulse Cloud contract." accent={FateDropColors.goldBright} /> : null}
      {unsupported ? <EvidenceNotice icon="eye-outline" text="Global Most Watched rankings need a canonical watch-signal contract. This tab stays empty rather than recycling local product wishlists or inventing demand." accent={FateDropColors.manifested} /> : null}

      {!is90 && !unsupported ? (
        <View style={styles.rankingCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.smallEyebrow}>FATEPULSE · SETS</Text>
              <Text style={styles.cardTitle}>Set performance & rankings</Text>
            </View>
            <Text style={styles.resultCount}>{rows.length}</Text>
          </View>
          {rows.map((item, index) => <SetRow key={setKey(item)} item={item} rank={index + 1} />)}
          {rows.length === 0 ? <EmptyCopy text="No qualifying sets match this view." /> : null}
        </View>
      ) : null}
    </View>
  );
}

function CardsView({ period, periodKey, onPeriodChange }: {
  period: FatePulseDirectionPeriod | undefined;
  periodKey: PulsePeriod;
  onPeriodChange: (value: PulsePeriod) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CardFilter>('risers');
  const is90 = periodKey === 'd90';
  const unsupported = filter === 'watched' || filter === 'volume';

  const rows = useMemo(() => {
    if (!period || unsupported) return [];
    const base = filter === 'fallers' ? period.cardDecliners : period.cardRisers;
    const q = query.trim().toLowerCase();
    return base.filter((item) => !q || `${item.name ?? ''} ${item.setName ?? ''} ${item.collectorNumber ?? ''} ${item.tcgCode ?? ''}`.toLowerCase().includes(q));
  }, [filter, period, query, unsupported]);

  return (
    <View style={styles.sectionStack}>
      <SearchBox value={query} onChange={setQuery} placeholder="Search cards (e.g. Charizard ex, OP-05…)" />
      <PeriodRail value={periodKey} onChange={onPeriodChange} />
      <FilterRail options={[
        ['risers', 'Risers'], ['fallers', 'Fallers'], ['watched', 'Most Watched'], ['volume', 'High Volume'],
      ]} value={filter} onChange={(value) => setFilter(value as CardFilter)} />

      {is90 ? <EvidenceNotice icon="time-outline" text="90D card movers remain reserved until the Cloud Pulse contract publishes an evidence-backed 90D ranking." accent={FateDropColors.goldBright} /> : null}
      {unsupported ? <EvidenceNotice icon={filter === 'watched' ? 'eye-outline' : 'bar-chart-outline'} text={filter === 'watched' ? 'Most Watched needs a canonical global card-watch signal. Local product wishlists are deliberately not reused here.' : 'High Volume needs a verified market-liquidity or sales-volume source. Until one exists, this lane stays unscored.'} accent={FateDropColors.manifested} /> : null}

      {!is90 && !unsupported ? (
        <View style={styles.rankingCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.smallEyebrow}>FATEPULSE · CARDS</Text>
              <Text style={styles.cardTitle}>Top {filter === 'fallers' ? 'fallers' : 'risers'} right now</Text>
            </View>
            <Text style={styles.resultCount}>{rows.length}</Text>
          </View>
          {rows.map((item, index) => <CardRow key={cardKey(item)} item={item} rank={index + 1} />)}
          {rows.length === 0 ? <EmptyCopy text="No eligible exact cards match this view." /> : null}
        </View>
      ) : null}
    </View>
  );
}

function WatchlistView({ data }: { data: FatePulseSnapshot | null }) {
  return (
    <View style={styles.sectionStack}>
      <View style={styles.watchHero}>
        <View style={styles.watchIcon}><Ionicons name="eye-outline" size={27} color={FateDropColors.manifested} /></View>
        <Text style={styles.watchTitle}>Personal lens. Global truth.</Text>
        <Text style={styles.watchCopy}>This view will show verified market movement for exact cards and sets you choose to watch. Those watches will never influence the global Pulse calculation itself.</Text>
      </View>
      <EvidenceNotice icon="construct-outline" text="The exact-card watchlist contract is not connected yet. FateDrop's existing product wishlist is a different feature, so Pulse will not quietly pretend they are the same thing." accent={FateDropColors.goldBright} />
      <View style={styles.readinessCard}>
        <Text style={styles.smallEyebrow}>GLOBAL EVIDENCE READY FOR THE LENS</Text>
        <Text style={styles.cardTitle}>{data?.readiness.canonical.mappedCards ?? 0} mapped cards</Text>
        <Text style={styles.readinessText}>{data ? `${data.readiness.history.distinctMarketDays} verified market days available for comparison · last market day ${evidenceDay(data)}.` : 'Load Pulse evidence to see current readiness.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
          <Ionicons name="pricetag-outline" size={15} color={FateDropColors.text} />
          <Text style={styles.primaryActionText}>FIND AN EXACT CARD IN FATEPRICE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MovementColumn({ title, subtitle, items, accent }: { title: string; subtitle: string; items: FatePulseRankedSet[]; accent: string }) {
  return (
    <View style={[styles.movementColumn, { borderColor: `${accent}38` }]}>
      <View style={styles.movementColumnHead}>
        <Text style={[styles.movementTitle, { color: accent }]}>{title}</Text>
        <Text style={styles.movementSubtitle}>{subtitle}</Text>
      </View>
      {items.map((item, index) => <CompactSetRow key={setKey(item)} item={item} rank={index + 1} accent={accent} />)}
      {items.length === 0 ? <Text style={styles.movementEmpty}>No qualifying movement.</Text> : null}
    </View>
  );
}

function CompactSetRow({ item, rank, accent }: { item: FatePulseRankedSet; rank: number; accent: string }) {
  return (
    <View style={styles.compactSetRow}>
      <Text style={styles.compactRank}>{rank}</Text>
      <View style={styles.compactSetCopy}>
        <Text numberOfLines={1} style={styles.compactSetName}>{item.setName || item.setCode || 'Tracked set'}</Text>
        <Text numberOfLines={1} style={styles.compactSetMeta}>{item.tcgCode?.toUpperCase() || 'TCG'} · {item.pricedCardCount} priced</Text>
      </View>
      <Text style={[styles.compactMovement, { color: accent }]}>{movement(item.movementPercent)}</Text>
    </View>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.evidenceMetric}>
      <Text style={styles.evidenceMetricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.evidenceMetricValue}>{value}</Text>
    </View>
  );
}

function SetRow({ item, rank }: { item: FatePulseRankedSet; rank: number }) {
  const positive = (item.movementPercent ?? 0) >= 0;
  const accent = positive ? FateDropColors.manifested : FateDropColors.vanished;
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNumber}>{rank}</Text>
      <View style={[styles.thumb, { borderColor: `${accent}54` }]}><Ionicons name="layers-outline" size={17} color={accent} /></View>
      <View style={styles.rankCopy}>
        <Text numberOfLines={1} style={styles.rankName}>{item.setName || item.setCode || 'Tracked set'}</Text>
        <Text style={styles.rankMeta}>{item.tcgCode?.toUpperCase() || 'TCG'} · {item.pricedCardCount} priced · {item.baselineCardCount} baseline</Text>
      </View>
      <View style={styles.rankRight}>
        <Text style={[styles.rankMovement, { color: accent }]}>{movement(item.movementPercent)}</Text>
        <Text style={styles.coverageTiny}>{item.currentPriceCoveragePct == null ? '—' : `${item.currentPriceCoveragePct.toFixed(0)}%`} cover</Text>
      </View>
    </View>
  );
}

function CardRow({ item, rank }: { item: FatePulseRankedCard; rank: number }) {
  const positive = (item.movementPercent ?? 0) >= 0;
  const accent = positive ? FateDropColors.manifested : FateDropColors.vanished;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name || 'card'} in FatePrice`}
      onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.cardIdentityId } })}
      style={({ pressed }) => [styles.rankRow, pressed && styles.pressed]}
    >
      <Text style={styles.rankNumber}>{rank}</Text>
      <View style={[styles.cardThumb, { borderColor: `${accent}54` }]}><Ionicons name="sparkles-outline" size={16} color={accent} /></View>
      <View style={styles.rankCopy}>
        <Text numberOfLines={1} style={styles.rankName}>{item.name || 'Verified card'}</Text>
        <Text numberOfLines={1} style={styles.rankMeta}>{item.setName || item.setCode || 'Set'}{item.collectorNumber ? ` · #${item.collectorNumber}` : ''}</Text>
      </View>
      <View style={styles.rankRight}>
        <Text style={[styles.rankMovement, { color: accent }]}>{movement(item.movementPercent)}</Text>
        <Text style={styles.coverageTiny}>FatePrice ›</Text>
      </View>
    </Pressable>
  );
}

function PeriodRail({ value, onChange }: { value: PulsePeriod; onChange: (value: PulsePeriod) => void }) {
  return (
    <View style={styles.periodRail}>
      {PERIODS.map((item) => (
        <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: value === item.key }} onPress={() => onChange(item.key)} style={[styles.periodButton, value === item.key && styles.periodButtonActive]}>
          <Text style={[styles.periodText, value === item.key && styles.periodTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.searchBox}>
      <Ionicons name="search" size={17} color={FateDropColors.goldBright} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={FateDropColors.muted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value ? <Pressable accessibilityLabel="Clear search" onPress={() => onChange('')}><Ionicons name="close-circle" size={17} color={FateDropColors.muted} /></Pressable> : null}
    </View>
  );
}

function FilterRail({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
      {options.map(([key, label]) => (
        <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={[styles.filterChip, value === key && styles.filterChipActive]}>
          <Text style={[styles.filterText, value === key && styles.filterTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function OrbMetric({ position, label, value, accent }: { position: 'left' | 'right' | 'bottom'; label: string; value: string; accent: string }) {
  return (
    <View style={[styles.orbMetric, position === 'left' ? styles.orbLeft : position === 'right' ? styles.orbRight : styles.orbBottom, { borderColor: `${accent}54` }]}>
      <Text style={styles.orbLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.orbValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function BreadthPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={[styles.breadthPill, { borderColor: `${accent}48` }]}>
      <Text style={[styles.breadthValue, { color: accent }]}>{value}</Text>
      <Text style={styles.breadthLabel}>{label}</Text>
    </View>
  );
}

function EvidenceNotice({ icon, text, accent }: { icon: keyof typeof Ionicons.glyphMap; text: string; accent: string }) {
  return (
    <View style={[styles.notice, { borderColor: `${accent}48` }]}>
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <Text style={styles.emptyCopy}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,16,.72)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 122, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1 },
  iconButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.86)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  eyebrow: { color: FateDropColors.manifested, fontSize: 10, fontWeight: '900', letterSpacing: 1.65 },
  title: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 23, lineHeight: 27, marginTop: 5 },
  subtitle: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 5 },
  viewTabs: { flexDirection: 'row', borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, overflow: 'hidden', backgroundColor: 'rgba(5,10,19,.78)' },
  viewTab: { flex: 1, minHeight: 37, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: FateDropColors.borderSoft },
  viewTabActive: { backgroundColor: 'rgba(91,69,195,.34)' },
  viewTabText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '800' },
  viewTabTextActive: { color: FateDropColors.text },
  scopeRail: { gap: 7, paddingVertical: 1 },
  scopeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.82)' },
  scopeChipActive: { borderColor: `${FateDropColors.manifested}80`, backgroundColor: 'rgba(84,55,181,.42)' },
  scopeText: { color: FateDropColors.muted, fontSize: 8.5, fontWeight: '800' },
  scopeTextActive: { color: FateDropColors.text },
  sectionStack: { gap: 12 },
  loadingPanel: { minHeight: 86, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(8,15,25,.84)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: FateDropColors.secondary, fontSize: 9 },
  instrument: { height: 258, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(115,79,230,.32)', backgroundColor: 'rgba(10,10,28,.56)' },
  orbitOuter: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(117,81,239,.34)' },
  orbitInner: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: 'rgba(78,164,255,.23)' },
  instrumentCore: { width: 116, height: 116, borderRadius: 58, borderWidth: 1, backgroundColor: 'rgba(13,17,40,.92)', alignItems: 'center', justifyContent: 'center', shadowColor: FateDropColors.manifested, shadowOpacity: .18, shadowRadius: 18 },
  instrumentLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .65 },
  instrumentValue: { fontFamily: Fonts.serif, fontSize: 27, marginTop: 4 },
  instrumentTrend: { fontSize: 8, fontWeight: '900', letterSpacing: .5, marginTop: 3 },
  orbMetric: { position: 'absolute', width: 88, minHeight: 58, borderRadius: 29, borderWidth: 1, backgroundColor: 'rgba(7,12,24,.94)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  orbLeft: { left: 18, top: 90 },
  orbRight: { right: 18, top: 90 },
  orbBottom: { bottom: 14 },
  orbLabel: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .45, textAlign: 'center' },
  orbValue: { fontSize: 11, fontWeight: '900', marginTop: 3, maxWidth: 72 },
  periodRail: { flexDirection: 'row', gap: 7 },
  periodButton: { flex: 1, minHeight: 35, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,14,24,.78)' },
  periodButtonActive: { borderColor: `${FateDropColors.manifested}84`, backgroundColor: 'rgba(91,55,199,.48)' },
  periodText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.text },
  indexCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,197,141,.38)', backgroundColor: 'rgba(21,17,27,.82)', padding: 12 },
  indexTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  indexIcon: { width: 35, height: 35, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.38)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(226,197,141,.06)' },
  indexCopy: { flex: 1 },
  indexTitle: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 14, marginTop: 2 },
  indexValue: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 26 },
  indexStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.2)' },
  indexStatus: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .65 },
  indexPeriod: { color: FateDropColors.muted, fontSize: 7, fontWeight: '800' },
  indexNote: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 7 },
  breadthCard: { borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.88)', padding: 12 },
  rankingCard: { borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.9)', padding: 12 },
  evidenceCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,110,255,.32)', backgroundColor: 'rgba(7,12,28,.88)', padding: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 },
  cardHeaderCopy: { flex: 1, minWidth: 0 },
  smallEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 14.5, marginTop: 3 },
  directionNumber: { fontFamily: Fonts.serif, fontSize: 18 },
  breadthRow: { flexDirection: 'row', gap: 7, marginTop: 7 },
  breadthPill: { flex: 1, minHeight: 59, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,10,18,.55)' },
  breadthValue: { fontFamily: Fonts.serif, fontSize: 18 },
  breadthLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', marginTop: 3 },
  coverageText: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 9 },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  evidenceMetric: { width: '48.8%', minHeight: 57, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.25)', backgroundColor: 'rgba(3,8,20,.52)', paddingHorizontal: 9, justifyContent: 'center' },
  evidenceMetricLabel: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .45 },
  evidenceMetricValue: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 13, marginTop: 3 },
  evidenceFoot: { color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11, marginTop: 9 },
  movementSplit: { flexDirection: 'row', gap: 8 },
  movementColumn: { flex: 1, minWidth: 0, borderRadius: 15, borderWidth: 1, backgroundColor: 'rgba(7,14,24,.9)', overflow: 'hidden' },
  movementColumnHead: { minHeight: 56, paddingHorizontal: 9, paddingTop: 10, paddingBottom: 7 },
  movementTitle: { fontSize: 8, fontWeight: '900', letterSpacing: .65 },
  movementSubtitle: { color: FateDropColors.muted, fontSize: 6.8, lineHeight: 10, marginTop: 3 },
  compactSetRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: FateDropColors.borderSoft },
  compactRank: { width: 12, color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 11, textAlign: 'center' },
  compactSetCopy: { flex: 1, minWidth: 0 },
  compactSetName: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 8.5 },
  compactSetMeta: { color: FateDropColors.muted, fontSize: 5.8, marginTop: 2 },
  compactMovement: { maxWidth: 42, fontSize: 7.5, fontWeight: '900', textAlign: 'right' },
  movementEmpty: { minHeight: 82, color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11, textAlign: 'center', padding: 12, paddingTop: 23 },
  searchBox: { minHeight: 43, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(5,12,22,.9)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11 },
  searchInput: { flex: 1, color: FateDropColors.text, fontSize: 10, paddingVertical: 10 },
  filterRail: { gap: 7 },
  filterChip: { minHeight: 31, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.78)', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { borderColor: `${FateDropColors.manifested}78`, backgroundColor: 'rgba(89,54,196,.44)' },
  filterText: { color: FateDropColors.muted, fontSize: 8, fontWeight: '800' },
  filterTextActive: { color: FateDropColors.text },
  resultCount: { minWidth: 27, height: 27, borderRadius: 14, backgroundColor: 'rgba(107,73,223,.22)', color: FateDropColors.manifested, textAlign: 'center', textAlignVertical: 'center', fontSize: 9, fontWeight: '900', paddingTop: 7 },
  rankRow: { minHeight: 62, borderTopWidth: 1, borderTopColor: FateDropColors.borderSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankNumber: { width: 20, color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 11, textAlign: 'center' },
  thumb: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,20,35,.94)' },
  cardThumb: { width: 34, height: 44, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,20,35,.94)' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankName: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 10.5 },
  rankMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 3 },
  rankRight: { alignItems: 'flex-end', minWidth: 58 },
  rankMovement: { fontSize: 12, fontWeight: '900' },
  coverageTiny: { color: FateDropColors.muted, fontSize: 7, marginTop: 3 },
  notice: { borderRadius: 13, borderWidth: 1, backgroundColor: 'rgba(8,15,25,.88)', padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  emptyCopy: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, paddingVertical: 13 },
  watchHero: { minHeight: 174, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(115,78,232,.42)', backgroundColor: 'rgba(31,17,70,.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  watchIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(115,78,232,.52)', backgroundColor: 'rgba(74,46,159,.28)', alignItems: 'center', justifyContent: 'center' },
  watchTitle: { color: FateDropColors.text, fontFamily: Fonts.serif, fontSize: 18, marginTop: 11 },
  watchCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 15, textAlign: 'center', marginTop: 6 },
  readinessCard: { borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.9)', padding: 13 },
  readinessText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 6 },
  primaryAction: { marginTop: 12, minHeight: 41, borderRadius: 12, backgroundColor: FateDropColors.violet, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12 },
  primaryActionText: { color: FateDropColors.text, fontSize: 8.5, fontWeight: '900', letterSpacing: .35 },
  truthBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(228,188,93,.26)', backgroundColor: 'rgba(32,24,10,.26)', padding: 11 },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  pressed: { opacity: .74, transform: [{ scale: .985 }] },
});
