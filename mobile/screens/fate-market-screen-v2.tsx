import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateCollectorEnhancements } from '@/components/fate-collector-enhancements';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import type { FateCollectorsDashboardSnapshot } from '@/services/fate-collector';
import {
  fetchFateCollectorsSummary,
  fetchFatePulse,
  type FateCollectorsSnapshot,
  type FatePulseRankedCard,
  type FatePulseRankedSet,
  type FatePulseSnapshot,
} from '@/services/fate-market';

type MarketAreaKey = 'pulse' | 'price' | 'collectors';
type MarketScope = 'all' | TcgCode;
type PulsePeriodKey = 'd1' | 'd7' | 'd30';
type RankingScope = 'sets' | 'cards';
type RankedMover = FatePulseRankedSet | FatePulseRankedCard;

const marketAreas: Record<MarketAreaKey, {
  accent: string;
  detail: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}> = {
  pulse: {
    accent: FateDropColors.manifested,
    detail: 'Direction, breadth and evidence-backed movement.',
    eyebrow: 'WHAT IS MOVING?',
    icon: 'pulse-outline',
    title: 'FatePulse',
  },
  price: {
    accent: FateDropColors.goldBright,
    detail: 'Exact-card value with provenance and history.',
    eyebrow: 'WHAT IS IT WORTH?',
    icon: 'pricetag-outline',
    title: 'FatePrice',
  },
  collectors: {
    accent: FateDropColors.echo,
    detail: 'Your cards, active binders and graded collection.',
    eyebrow: 'WHAT AM I BUILDING?',
    icon: 'albums-outline',
    title: 'Collections',
  },
};

const marketAreaOrder: MarketAreaKey[] = ['pulse', 'price', 'collectors'];
const pulsePeriods: { key: PulsePeriodKey; label: string }[] = [
  { key: 'd1', label: '1D' },
  { key: 'd7', label: '7D' },
  { key: 'd30', label: '30D' },
];
const TOP_MOVER_LIMIT = 3;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function marketArea(value: string | string[] | undefined): MarketAreaKey {
  const candidate = first(value)?.trim().toLowerCase();
  return candidate === 'price' || candidate === 'collectors' ? candidate : 'pulse';
}

function movementText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function percentText(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
}

function conditionText(value: string | undefined) {
  if (value === 'broadly_rising') return 'Broadly rising';
  if (value === 'broadly_falling') return 'Broadly falling';
  if (value === 'mixed') return 'Mixed';
  if (value === 'unchanged') return 'Unchanged';
  return 'Building evidence';
}

function conditionAccent(value: string | undefined) {
  if (value === 'broadly_falling') return FateDropColors.vanished;
  if (value === 'mixed' || value === 'unchanged') return FateDropColors.goldBright;
  return FateDropColors.manifested;
}

function scopeLabel(scope: MarketScope) {
  if (scope === 'all') return 'All qualifying TCGs';
  return TCG_REGISTRY.find((entry) => entry.code === scope)?.shortName ?? scope;
}

function formatMoney(value: number | null | undefined, currencyCode: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const currency = currencyCode || 'EUR';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function moverKey(item: RankedMover) {
  return 'cardIdentityId' in item ? `${item.cardIdentityId}:${item.sourceVariantKey}` : item.key;
}

export default function FateMarketScreenV2() {
  const params = useLocalSearchParams<{ area?: string | string[] }>();
  const { signedIn, snapshot } = useFateDropId();
  const [activeArea, setActiveArea] = useState<MarketAreaKey>(() => marketArea(params.area));
  const [selectedScope, setSelectedScope] = useState<MarketScope>('all');
  const [pulseLoading, setPulseLoading] = useState(false);
  const [collectorsLoading, setCollectorsLoading] = useState(false);
  const [pulse, setPulse] = useState<FatePulseSnapshot | null>(null);
  const [loadedPulseScope, setLoadedPulseScope] = useState<MarketScope | null>(null);
  const [pulseError, setPulseError] = useState('');
  const [collectors, setCollectors] = useState<FateCollectorsSnapshot | null>(null);
  const [collectorsError, setCollectorsError] = useState('');
  const pulseGeneration = useRef(0);
  const collectorsGeneration = useRef(0);
  const loading = pulseLoading || collectorsLoading;

  const scopeOptions = useMemo<MarketScope[]>(() => {
    const selected = snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'];
    return ['all', ...selected.filter(isTcgCode)];
  }, [snapshot?.tcgPreferences.selectedTcgCodes]);

  useFocusEffect(useCallback(() => {
    const frame = requestAnimationFrame(() => setActiveArea(marketArea(params.area)));
    return () => cancelAnimationFrame(frame);
  }, [params.area]));

  const loadPulse = useCallback(async (force = false) => {
    const generation = ++pulseGeneration.current;
    setPulseLoading(true);
    setPulseError('');
    const tcgCode = selectedScope === 'all' ? undefined : selectedScope;
    try {
      const nextPulse = await fetchFatePulse(tcgCode, { force });
      if (generation !== pulseGeneration.current) return;
      setPulse(nextPulse);
      setLoadedPulseScope(selectedScope);
      setPulseError('');
    } catch {
      if (generation !== pulseGeneration.current) return;
      setPulseError('Verified market evidence is temporarily unavailable.');
    } finally {
      if (generation === pulseGeneration.current) setPulseLoading(false);
    }
  }, [selectedScope]);

  const loadCollectors = useCallback(async (force = false) => {
    const generation = ++collectorsGeneration.current;
    if (!signedIn) {
      setCollectors(null);
      setCollectorsError('');
      setCollectorsLoading(false);
      return;
    }
    setCollectorsLoading(true);
    try {
      const nextCollectors = await fetchFateCollectorsSummary({ force });
      if (generation !== collectorsGeneration.current) return;
      setCollectors(nextCollectors);
      setCollectorsError('');
    } catch {
      if (generation !== collectorsGeneration.current) return;
      setCollectorsError('Your collection could not be read safely right now.');
    } finally {
      if (generation === collectorsGeneration.current) setCollectorsLoading(false);
    }
  }, [signedIn]);

  const loadMarket = useCallback(async (force = false) => {
    await Promise.all([loadPulse(force), loadCollectors(force)]);
  }, [loadCollectors, loadPulse]);

  useFocusEffect(useCallback(() => {
    void loadPulse(false);
    return () => {
      pulseGeneration.current += 1;
    };
  }, [loadPulse]));

  useFocusEffect(useCallback(() => {
    void loadCollectors(false);
    return () => {
      collectorsGeneration.current += 1;
    };
  }, [loadCollectors]));

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
          recyclingKey="fate-market:orbital-theme"
        />
        <Image
          source={require('../assets/images/fate-market-guardians-gateway.webp')}
          style={styles.marketGuardians}
          contentFit="cover"
          contentPosition="top center"
          cachePolicy="disk"
          enforceEarlyResizing
          recyclingKey="fate-market:guardian-gateway"
        />
        <View style={styles.marketGuardianVeil} />
        <View style={styles.themeVeil} />
        <View style={styles.themeLowerVeil} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadMarket(true)} tintColor={FateDropColors.goldBright} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>FATE MARKET</Text>
            <Text style={styles.title}>Read the market. Know your position.</Text>
            <Text style={styles.copy}>Market direction, exact value and your collection—one evidence boundary, three useful views.</Text>
          </View>
          <View accessibilityLabel={loading ? 'Refreshing Fate Market' : 'Fate Market evidence ready'} style={styles.marketMark}>
            <View style={styles.marketMarkOuter} />
            <View style={styles.marketMarkInner} />
            {loading
              ? <ActivityIndicator color={FateDropColors.goldBright} />
              : <Image source={require('../assets/images/home-orbital-crystal.png')} style={styles.marketMarkCrystal} contentFit="contain" cachePolicy="memory-disk" />}
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.areaRail}>
          {marketAreaOrder.map((key) => {
            const area = marketAreas[key];
            const selected = activeArea === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => key === 'price' ? router.push('/fate-price') : setActiveArea(key)}
                style={({ pressed }) => [styles.areaTab, selected && styles.areaTabActive, pressed && styles.pressed]}
              >
                <Ionicons name={area.icon} size={16} color={selected ? area.accent : FateDropColors.muted} />
                <Text style={[styles.areaTitle, selected && { color: area.accent }]}>{area.title}</Text>
                {selected ? <View style={[styles.areaActiveGem, { backgroundColor: area.accent }]} /> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.areaContext}>
          <Text style={styles.areaContextEyebrow}>{marketAreas[activeArea].eyebrow}</Text>
          <Text style={styles.areaContextCopy}>{marketAreas[activeArea].detail}</Text>
        </View>

        {activeArea === 'pulse' ? (
          <PulsePanel data={loadedPulseScope === selectedScope ? pulse : null} error={pulseError} loading={loading} onScopeChange={setSelectedScope} scope={selectedScope} scopeOptions={scopeOptions} />
        ) : null}
        {activeArea === 'price' ? <PricePanel /> : null}
        {activeArea === 'collectors' ? <CollectorsPanel data={collectors} error={collectorsError} loading={collectorsLoading} onRefresh={() => loadCollectors(true)} signedIn={signedIn} /> : null}

        <View style={styles.truthLedger}>
          <Ionicons name="shield-checkmark-outline" size={17} color={FateDropColors.goldBright} />
          <Text style={styles.truthCopy}>Cloud owns identity, history and calculations. Missing evidence stays unknown; the App never fills gaps with synthetic scores or values.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PulsePanel({ data, error, loading, onScopeChange, scope, scopeOptions }: {
  data: FatePulseSnapshot | null;
  error: string;
  loading: boolean;
  onScopeChange: (scope: MarketScope) => void;
  scope: MarketScope;
  scopeOptions: MarketScope[];
}) {
  const [periodKey, setPeriodKey] = useState<PulsePeriodKey>('d30');
  const [rankingScope, setRankingScope] = useState<RankingScope>('cards');
  const [selectedMoverKey, setSelectedMoverKey] = useState<string | null>(null);
  const direction = data?.pulse?.direction;
  const period = direction?.periods[periodKey];
  const available = period?.status === 'available';
  const accent = conditionAccent(period?.condition);
  const risers = (rankingScope === 'sets' ? period?.setRisers : period?.cardRisers) ?? [];
  const decliners = (rankingScope === 'sets' ? period?.setDecliners : period?.cardDecliners) ?? [];
  const topRisers = risers.slice(0, TOP_MOVER_LIMIT);
  const topDecliners = decliners.slice(0, TOP_MOVER_LIMIT);
  const selectedMover = [...topRisers, ...topDecliners].find((item) => moverKey(item) === selectedMoverKey) ?? null;
  const scopeName = scopeLabel(scope);
  const historyDetail = data
    ? `${data.readiness.history.distinctMarketDays} verified market days · ${data.readiness.canonical.mappedCards} exact card mappings`
    : 'Waiting for the Cloud evidence boundary';
  const evidenceStatus = error ? 'EVIDENCE UNAVAILABLE' : available ? 'EVIDENCE LIVE' : loading && !data ? 'LOADING' : 'COVERAGE BUILDING';

  return (
    <View style={styles.panel}>
      <PanelHeading eyebrow="FATEPULSE" title="What is moving across the market?" accent={accent} status={evidenceStatus} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRail}>
        {scopeOptions.map((option) => (
          <ScopeButton key={option} label={option === 'all' ? 'ALL TCGs' : scopeLabel(option).toUpperCase()} selected={scope === option} onPress={() => { setSelectedMoverKey(null); onScopeChange(option); }} />
        ))}
      </ScrollView>
      <View style={styles.periodRail}>
        {pulsePeriods.map((option) => (
          <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: periodKey === option.key }} onPress={() => { setSelectedMoverKey(null); setPeriodKey(option.key); }} style={[styles.periodButton, periodKey === option.key && styles.periodButtonActive]}>
            <Text style={[styles.periodButtonText, periodKey === option.key && styles.periodButtonTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pulseInstrument}>
        <View pointerEvents="none" style={[styles.pulseOrbitOuter, { borderColor: `${accent}54` }]} />
        <View pointerEvents="none" style={styles.pulseOrbitMiddle} />
        <View pointerEvents="none" style={[styles.pulseOrbitInner, { borderColor: `${accent}74` }]} />
        <View pointerEvents="none" style={styles.pulseAxisHorizontal} />
        <View pointerEvents="none" style={styles.pulseAxisVertical} />
        <View style={[styles.pulseCore, { borderColor: `${accent}90`, backgroundColor: `${accent}0C` }]}>
          <Ionicons name="pulse-outline" size={18} color={accent} />
          <Text style={styles.pulseCoreEyebrow}>TRACKED SET DIRECTION</Text>
          <Text style={styles.pulseCoreScope}>{scopeName.toUpperCase()}</Text>
          <Text style={[styles.pulseCoreValue, { color: available ? accent : FateDropColors.muted }]}>{movementText(period?.headlinePercent)}</Text>
          <Text style={styles.pulseCoreCondition}>{conditionText(period?.condition)}</Text>
          <Text style={styles.pulseCorePeriod}>{periodKey.slice(1)}D MEDIAN SET RETURN</Text>
        </View>
        <BreadthOrbitalMetric position="left" label="RISING" value={available ? period?.breadth.risingSets : null} accent={FateDropColors.manifested} />
        <BreadthOrbitalMetric position="right" label="STABLE" value={available ? period?.breadth.unchangedSets : null} accent={FateDropColors.echo} />
        <BreadthOrbitalMetric position="bottom" label="FALLING" value={available ? period?.breadth.fallingSets : null} accent={FateDropColors.vanished} />
      </View>

      <View style={styles.coverageLedger}>
        <View style={styles.coverageTop}>
          <View style={styles.flex}>
            <Text style={styles.coverageEyebrow}>MARKET COVERAGE</Text>
            <Text style={styles.coverageTitle}>{period ? `${period.coverage.qualifyingSets} of ${period.coverage.trackedSets} tracked sets qualify` : 'Tracked-set evidence building'}</Text>
          </View>
          <Text style={styles.coverageThreshold}>≥{direction?.minimumSetCoveragePct ?? 95}%</Text>
        </View>
        <View style={styles.coverageTrack}><View style={[styles.coverageFill, { width: `${Math.min(100, Math.max(0, period?.coverage.exactBaselineCoveragePct ?? 0))}%`, backgroundColor: accent }]} /></View>
        <View style={styles.coverageFacts}>
          <Text style={styles.coverageCopy}>{percentText(period?.coverage.currentPriceCoveragePct)} current</Text>
          <Text style={styles.coverageCopy}>{percentText(period?.coverage.exactBaselineCoveragePct)} exact baseline</Text>
          <Text style={styles.coverageCopy}>{period ? `${period.coverage.excludedSets} excluded` : '— excluded'}</Text>
        </View>
      </View>

      <View style={styles.readinessLine}>
        <Ionicons name={error ? 'cloud-offline-outline' : 'time-outline'} size={15} color={accent} />
        <Text style={styles.readinessCopy}>{error || `${historyDetail}. Each headline is the median return of qualifying set baskets; incomplete sets cannot steer it.`}</Text>
      </View>

      <View style={styles.calibrationLedger}>
        <CalibrationMetric label="MARKET HEAT" value={data?.intelligence.marketHeat} />
        <View style={styles.ledgerDivider} />
        <CalibrationMetric label="VOLATILITY" value={data?.intelligence.volatility} />
      </View>

      <View style={styles.moversHead}>
        <View>
          <Text style={styles.moversEyebrow}>{rankingScope === 'cards' ? 'GLOBAL CARD MOVERS' : 'MARKET SET MOVERS'}</Text>
          <Text style={styles.moversTitle}>{rankingScope === 'cards' ? 'Top three across eligible exact cards' : 'Top three qualifying set baskets'}</Text>
        </View>
        <View style={styles.segmentedRow}>
          <SegmentButton label="SETS" selected={rankingScope === 'sets'} onPress={() => { setSelectedMoverKey(null); setRankingScope('sets'); }} />
          <SegmentButton label="CARDS" selected={rankingScope === 'cards'} onPress={() => { setSelectedMoverKey(null); setRankingScope('cards'); }} />
        </View>
      </View>
      <View style={styles.moverColumns}>
        <MoverColumn accent={FateDropColors.manifested} items={topRisers} label="RISERS" onSelect={(item) => setSelectedMoverKey((current) => current === moverKey(item) ? null : moverKey(item))} selectedKey={selectedMoverKey} />
        <MoverColumn accent={FateDropColors.vanished} items={topDecliners} label="FALLERS" onSelect={(item) => setSelectedMoverKey((current) => current === moverKey(item) ? null : moverKey(item))} selectedKey={selectedMoverKey} />
      </View>
      {selectedMover ? <MoverEvidence item={selectedMover} currencyCode={data?.source.currencyCode} periodLabel={periodKey.slice(1)} /> : null}
    </View>
  );
}

function PricePanel() {
  return (
    <View style={styles.panel}>
      <PanelHeading eyebrow="FATEPRICE" title="What is this exact card worth?" accent={FateDropColors.goldBright} status="DEDICATED VIEW" />
      <ValueInstrument accent={FateDropColors.goldBright} icon="pricetag-outline" label="CANONICAL EXACT-CARD VALUE" value="FatePrice" detail="Verified price · 7D and 30D movement · explicit market scope" />
      <View style={styles.readinessLine}><Ionicons name="shield-checkmark-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.readinessCopy}>FatePrice now has its own exact-card monitoring page. Cloud owns the price, movement, confidence and provenance; ambiguous scopes ask instead of guessing.</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.orbitalAction, pressed && styles.pressed]}>
        <Ionicons name="pricetag-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.orbitalActionText}>OPEN FATEPRICE</Text><Ionicons name="arrow-forward" size={15} color={FateDropColors.goldBright} />
      </Pressable>
    </View>
  );
}

function concisePercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function collectorStatus(data: FateCollectorsSnapshot | null, error: string, loading: boolean, signedIn: boolean) {
  if (!signedIn) return 'FATEDROP ID REQUIRED';
  if (error && !data) return 'EVIDENCE UNAVAILABLE';
  if (loading && !data) return 'READING COLLECTION';
  if (error && data) return 'LAST SAFE SNAPSHOT';
  if (data?.status === 'empty') return 'PRIVATE · EMPTY';
  if (data?.status === 'partial') return 'PRIVATE · PARTIAL';
  return data ? 'PRIVATE · READY' : 'PRIVATE VIEW';
}

function CollectorValueCard({ data, loading }: { data: FateCollectorsSnapshot | null; loading: boolean }) {
  const dashboard = data as FateCollectorsDashboardSnapshot | null;
  const summary = dashboard?.summary;
  const collection = summary?.rawCollection || summary?.collection;
  const fullyValued = Boolean(collection && collection.totalUnits > 0 && collection.totalValue != null);
  const hasKnownValue = Boolean(collection && collection.pricedUnits > 0);
  const value = fullyValued ? collection?.totalValue : collection?.knownValue;
  const currency = data?.evidence.valuationCurrencyCode || summary?.currencyCode;
  const sourceCurrency = data?.evidence.sourceMarketCurrencyCode;
  const coverage = collection && collection.totalUnits > 0 ? collection.priceCoveragePercent : 0;
  const missingPriceCount = collection ? Math.max(0, collection.totalUnits - collection.pricedUnits) : 0;
  const note = !collection
    ? loading ? 'Reading your private collection and verified FatePrice coverage…' : 'Collection value appears only when verified FatePrice evidence exists.'
    : collection.totalUnits === 0
      ? 'No cards are recorded yet. Add one exact card or preview a collection CSV to begin.'
      : collection.pricedUnits === 0
      ? `None of your ${collection.totalUnits} recorded ${collection.totalUnits === 1 ? 'copy has' : 'copies have'} a verified FatePrice yet.`
      : fullyValued
        ? `All ${collection.totalUnits} recorded ${collection.totalUnits === 1 ? 'copy is' : 'copies are'} included.`
        : `${collection.pricedUnits} of ${collection.totalUnits} recorded copies are included. ${missingPriceCount} ${missingPriceCount === 1 ? 'copy is' : 'copies are'} excluded—not estimated.`;

  return (
    <View style={styles.collectorValueCard}>
      <View style={styles.collectorValueTop}>
        <View style={styles.collectorValueSource}>
          <Ionicons name="shield-checkmark-outline" size={15} color={FateDropColors.echo} />
          <Text style={styles.collectorValueSourceText}>FATEPRICE VALUATION</Text>
        </View>
        <Text style={styles.collectorCurrency}>{currency || '—'}</Text>
      </View>
      <View style={styles.collectorValueLine}><View style={styles.flex}><Text style={styles.collectorValueLabel}>{fullyValued ? 'RAW COLLECTION VALUE' : 'KNOWN RAW-CARD VALUE'}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.collectorValueMain}>{hasKnownValue ? formatMoney(value, currency) : '—'}</Text></View><Text style={styles.collectorCoverageValue}>{collection && collection.totalUnits > 0 ? `${collection.pricedUnits}/${collection.totalUnits} priced` : 'No priced cards'}</Text></View>
      <Text style={styles.collectorValueNote}>{note}</Text>
      <View style={styles.collectorCoverageTrack}>
        <View style={[styles.collectorCoverageFill, { width: `${Math.min(100, Math.max(0, coverage))}%` }]} />
      </View>
      <Text style={styles.collectorSourceNote}>{sourceCurrency && currency ? `Cardmarket evidence in ${sourceCurrency} · values presented in ${currency}` : 'Verified exact-card evidence only'}</Text>
    </View>
  );
}

function CollectorsPanel({ data, error, loading, onRefresh, signedIn }: { data: FateCollectorsSnapshot | null; error: string; loading: boolean; onRefresh: () => Promise<void>; signedIn: boolean }) {
  const dashboard = data as FateCollectorsDashboardSnapshot | null;
  const summary = dashboard?.summary;
  const gradedCount = summary?.gradedCardUnits ?? 0;
  const rawCount = summary?.rawCardUnits ?? Math.max(0, (summary?.cardUnits ?? 0) - gradedCount);
  const collectionCopy = !signedIn
    ? 'Connect your FateDrop ID to see an owner-scoped view of your cards, values, binders and personal movement.'
    : error && data ? `${error} The last safely loaded snapshot remains visible.` : error
      ? error : data?.status === 'empty'
      ? 'Your collection is empty. Add an exact card from FatePrice or import a collection CSV.'
      : 'Owned copies reflect your recorded collection. Exact-card, binder and valuation figures use verified canonical identities; every gap stays visible.';
  return (
    <View style={styles.panel}>
      <PanelHeading eyebrow="FATE COLLECTIONS" title="The cards you own. The sets you are building." accent={FateDropColors.echo} status={collectorStatus(data, error, loading, signedIn)} />
      <View style={styles.collectionCabinet}>
        <View pointerEvents="none" style={styles.collectionCabinetOrbit} />
        <Ionicons name="albums-outline" size={26} color={FateDropColors.echo} />
        <Text style={styles.collectionCabinetEyebrow}>YOUR COLLECTION</Text>
        <Text style={styles.collectionCabinetTitle}>{summary ? `${rawCount} raw ${rawCount === 1 ? 'card' : 'cards'}` : loading ? 'Opening your collection…' : 'Ready when you are'}</Text>
        <Text style={styles.collectionCabinetCopy}>{summary ? `${summary.setsOwned} ${summary.setsOwned === 1 ? 'set' : 'sets'} represented · ${gradedCount} graded ${gradedCount === 1 ? 'card' : 'cards'} kept separately` : 'Add exact cards from FatePrice and build verified set binders.'}</Text>
        {signedIn ? <View style={styles.collectionDoorRow}>
          <CollectionDoor icon="layers-outline" label="RAW CARDS" value={String(rawCount)} onPress={() => router.push('/collection')} />
          <CollectionDoor icon="ribbon-outline" label="GRADED" value={String(gradedCount)} onPress={() => router.push('/graded-collection')} />
        </View> : null}
      </View>
      {summary?.closestSet ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${summary.closestSet.setName || 'closest set'} binder`} onPress={() => router.push({ pathname: '/binder/[setId]', params: { setId: summary.closestSet?.setId, setName: summary.closestSet?.setName || undefined } })} style={({ pressed }) => [styles.closestSetCard, pressed && styles.pressed]}>
          <View style={styles.closestSetTop}>
            <View style={styles.flex}><Text style={styles.closestSetEyebrow}>CLOSEST SET</Text><Text style={styles.closestSetName}>{summary.closestSet.setName || 'Verified set'}</Text></View>
            <Text style={styles.closestSetPercent}>{concisePercent(summary.closestSet.completionPercent)}</Text>
          </View>
          <View style={styles.closestSetTrack}><View style={[styles.closestSetFill, { width: `${Math.min(100, Math.max(0, summary.closestSet.completionPercent))}%` }]} /></View>
          <View style={styles.closestSetBottom}>
            <Text style={styles.closestSetDetail}>{summary.closestSet.missingCount} {summary.closestSet.missingCount === 1 ? 'card' : 'cards'} still missing</Text>
            <View style={styles.closestSetAction}><Text style={styles.closestSetActionText}>OPEN BINDER</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.echo} /></View>
          </View>
        </Pressable>
      ) : null}
      <CollectorValueCard data={data} loading={loading} />
      <View style={styles.collectorExplanation}><Ionicons name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={16} color={error ? FateDropColors.vanished : FateDropColors.echo} /><Text style={styles.panelCopy}>{collectionCopy}</Text></View>
      {error && signedIn ? <Pressable accessibilityRole="button" disabled={loading} onPress={() => void onRefresh()} style={({ pressed }) => [styles.retryAction, pressed && styles.pressed]}>{loading ? <ActivityIndicator size="small" color={FateDropColors.echo} /> : <Ionicons name="refresh-outline" size={15} color={FateDropColors.echo} />}<Text style={styles.retryActionText}>REFRESH PRIVATE EVIDENCE</Text></Pressable> : null}
      <FateCollectorEnhancements data={data} onCollectionChanged={onRefresh} signedIn={signedIn} />
      {!signedIn ? <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={({ pressed }) => [styles.orbitalAction, pressed && styles.pressed]}><Text style={[styles.orbitalActionText, { color: FateDropColors.echo }]}>CONNECT FATEDROP ID</Text><Ionicons name="arrow-forward" size={15} color={FateDropColors.echo} /></Pressable> : null}
    </View>
  );
}

function CollectionDoor({ icon, label, onPress, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; value: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label.toLowerCase()}`} onPress={onPress} style={({ pressed }) => [styles.collectionDoor, pressed && styles.pressed]}><Ionicons name={icon} size={17} color={FateDropColors.echo} /><View style={styles.flex}><Text style={styles.collectionDoorValue}>{value}</Text><Text style={styles.collectionDoorLabel}>{label}</Text></View><Ionicons name="chevron-forward" size={13} color={FateDropColors.muted} /></Pressable>;
}

function ValueInstrument({ accent, detail, icon, label, value }: { accent: string; detail: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.valueInstrument}><View style={[styles.valueOrbit, { borderColor: `${accent}48` }]} /><Ionicons name={icon} size={22} color={accent} /><Text style={styles.valueLabel}>{label}</Text><Text style={styles.valueMain}>{value}</Text><Text style={styles.valueSub}>{detail}</Text></View>;
}

function ScopeButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.scopeButton, selected && styles.scopeButtonActive]}><View style={[styles.scopeDot, selected && styles.scopeDotActive]} /><Text style={[styles.scopeButtonText, selected && styles.scopeButtonTextActive]}>{label}</Text></Pressable>;
}

function PanelHeading({ accent, eyebrow, status, title }: { accent: string; eyebrow: string; status: string; title: string }) {
  return <View style={styles.panelHeading}><View style={styles.flex}><Text style={[styles.panelEyebrow, { color: accent }]}>{eyebrow}</Text><Text style={styles.panelTitle}>{title}</Text></View><View style={[styles.statusPill, { borderColor: `${accent}58` }]}><Text style={[styles.statusText, { color: accent }]}>{status}</Text></View></View>;
}

function BreadthOrbitalMetric({ accent, label, position, value }: { accent: string; label: string; position: 'left' | 'right' | 'bottom'; value: number | null | undefined }) {
  return <View style={[styles.breadthOrbital, position === 'left' ? styles.breadthLeft : position === 'right' ? styles.breadthRight : styles.breadthBottom]}><View style={[styles.breadthRing, { borderColor: `${accent}62` }]} /><Text style={[styles.breadthValue, { color: accent }]}>{value == null ? '—' : value}</Text><Text style={styles.breadthLabel}>{label}</Text></View>;
}

function CalibrationMetric({ label, value }: { label: string; value: number | null | undefined }) {
  const scored = value != null && Number.isFinite(value);
  return <View style={styles.calibrationMetric}><Text style={styles.calibrationLabel}>{label}</Text>{scored ? <Text style={styles.calibrationValue}>{Math.round(value)}/100</Text> : <Text style={styles.calibrationValue}>NOT SCORED</Text>}<Text style={styles.calibrationDetail}>{scored ? 'Cloud evidence score' : 'Calibration building'}</Text></View>;
}

function SegmentButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.segmentButton, selected && styles.segmentButtonActive]}><Text style={[styles.segmentButtonText, selected && styles.segmentButtonTextActive]}>{label}</Text></Pressable>;
}

function MoverColumn({ accent, items, label, onSelect, selectedKey }: { accent: string; items: RankedMover[]; label: 'RISERS' | 'FALLERS'; onSelect: (item: RankedMover) => void; selectedKey: string | null }) {
  return (
    <View style={styles.moverColumn}>
      <View style={styles.moverColumnHead}><Ionicons name={label === 'RISERS' ? 'trending-up-outline' : 'trending-down-outline'} size={14} color={accent} /><Text style={[styles.moverColumnLabel, { color: accent }]}>{label}</Text><Text style={styles.moverColumnLimit}>TOP 3</Text></View>
      {items.length ? items.map((item, index) => {
        const key = moverKey(item);
        const selected = selectedKey === key;
        const isCard = 'cardIdentityId' in item;
        const title = isCard ? item.name || 'Unknown card' : item.setName || item.setCode || 'Unknown set';
        return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }} accessibilityHint="Shows the supporting movement evidence" onPress={() => onSelect(item)} style={({ pressed }) => [styles.moverRow, selected && { borderColor: `${accent}80` }, pressed && styles.pressed]}><Text style={styles.moverRank}>{index + 1}</Text><View style={styles.moverIdentity}><Text style={styles.moverName} numberOfLines={2}>{title}</Text><Text style={styles.moverMeta} numberOfLines={1}>{isCard ? item.setName || item.setCode || 'Canonical card' : `${item.pricedCardCount} cards priced`}</Text></View><Text style={[styles.moverValue, { color: accent }]}>{movementText(item.movementPercent)}</Text></Pressable>;
      }) : <Text style={styles.moverEmpty}>No qualifying movement.</Text>}
    </View>
  );
}

function MoverEvidence({ currencyCode, item, periodLabel }: { currencyCode: string | undefined; item: RankedMover; periodLabel: string }) {
  const isCard = 'cardIdentityId' in item;
  const title = isCard ? item.name || 'Unknown card' : item.setName || item.setCode || 'Unknown set';
  const facts = isCard ? [
    { label: 'CURRENT', value: formatMoney(item.currentPrice, currencyCode) },
    { label: `${periodLabel}D MOVE`, value: formatMoney(item.movementAmount, currencyCode) },
    { label: 'IDENTITY', value: item.collectorNumber ? `#${item.collectorNumber}` : 'Exact canonical card' },
  ] : [
    { label: 'CURRENT BASKET', value: formatMoney(item.currentBasketValue, currencyCode) },
    { label: 'BASELINE BASKET', value: formatMoney(item.baselineBasketValue, currencyCode) },
    { label: 'EXACT BASELINE', value: percentText(item.baselineCoveragePct) },
  ];
  const openFatePrice = () => {
    if (!isCard) return;
    router.push({
      pathname: '/fate-price',
      params: {
        cardId: item.cardIdentityId,
        collectorNumber: item.collectorNumber || undefined,
        name: item.name || undefined,
        setName: item.setName || undefined,
        tcg: item.tcgCode || undefined,
      },
    });
  };
  return <View style={styles.moverEvidence}><Text style={styles.moverEvidenceEyebrow}>SELECTED EVIDENCE · {periodLabel}D</Text><Text style={styles.moverEvidenceTitle}>{title}</Text><View style={styles.moverEvidenceFacts}>{facts.map((fact) => <View key={fact.label} style={styles.moverEvidenceFact}><Text style={styles.moverEvidenceLabel}>{fact.label}</Text><Text style={styles.moverEvidenceValue}>{fact.value}</Text></View>)}</View>{isCard ? <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${title}`} onPress={openFatePrice} style={({ pressed }) => [styles.moverPriceAction, pressed && styles.pressed]}><Ionicons name="pricetag-outline" size={14} color={FateDropColors.goldBright} /><Text style={styles.moverPriceActionText}>READ EXACT FATEPRICE</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.goldBright} /></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  marketGuardians: { position: 'absolute', left: 0, right: 0, top: 0, width: '100%', height: 520, opacity: .4 },
  marketGuardianVeil: { position: 'absolute', left: 0, top: 0, width: '67%', height: 520, backgroundColor: 'rgba(2,5,15,.58)' },
  themeVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,14,.48)' },
  themeLowerVeil: { position: 'absolute', left: 0, right: 0, top: '36%', bottom: 0, backgroundColor: 'rgba(3,7,18,.53)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 124 },
  flex: { flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  hero: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.65 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 29, lineHeight: 34, marginTop: 7, textShadowColor: 'rgba(0,0,0,.94)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 7, maxWidth: 300 },
  marketMark: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  marketMarkOuter: { position: 'absolute', width: 66, height: 66, borderRadius: 33, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.66)' },
  marketMarkInner: { position: 'absolute', width: 51, height: 51, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)' },
  marketMarkCrystal: { width: 58, height: 58 },
  areaRail: { height: 50, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(3,8,20,.18)' },
  areaTab: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.16)' },
  areaTabActive: { backgroundColor: 'rgba(124,110,255,.07)' },
  areaTitle: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 10.5 },
  areaActiveGem: { position: 'absolute', width: 5, height: 5, bottom: -3, transform: [{ rotate: '45deg' }] },
  areaContext: { alignItems: 'center', minHeight: 42, paddingTop: 10, paddingHorizontal: 12 },
  areaContextEyebrow: { color: FateDropColors.gold, fontSize: 6.5, fontWeight: '900', letterSpacing: 1.1 },
  areaContextCopy: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 12, marginTop: 3, textAlign: 'center' },
  panel: { marginTop: 7, paddingTop: 8, paddingBottom: 2 },
  panelHeading: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 5 },
  panelEyebrow: { fontSize: 7.5, fontWeight: '900', letterSpacing: 1.2 },
  panelTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19, lineHeight: 23, marginTop: 3 },
  statusPill: { maxWidth: 112, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(3,8,20,.42)' },
  statusText: { fontSize: 6.3, fontWeight: '900', letterSpacing: 0.55, textAlign: 'center' },
  scopeRail: { gap: 8, paddingHorizontal: 3, paddingVertical: 9, paddingRight: 18 },
  scopeButton: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(3,8,20,.38)' },
  scopeButtonActive: { borderColor: 'rgba(226,197,141,.74)', backgroundColor: 'rgba(226,197,141,.08)' },
  scopeDot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: FateDropColors.muted },
  scopeDotActive: { borderColor: FateDropColors.manifested, backgroundColor: FateDropColors.manifested },
  scopeButtonText: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: .55 },
  scopeButtonTextActive: { color: FateDropColors.ivory },
  periodRail: { width: 186, alignSelf: 'center', flexDirection: 'row', marginTop: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.27)' },
  periodButton: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  periodButtonActive: { borderBottomWidth: 1, borderBottomColor: FateDropColors.manifested },
  periodButtonText: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900' },
  periodButtonTextActive: { color: FateDropColors.ivory },
  pulseInstrument: { height: 260, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  pulseOrbitOuter: { position: 'absolute', width: 222, height: 222, borderRadius: 111, borderWidth: StyleSheet.hairlineWidth },
  pulseOrbitMiddle: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.29)' },
  pulseOrbitInner: { position: 'absolute', width: 158, height: 158, borderRadius: 79, borderWidth: StyleSheet.hairlineWidth },
  pulseAxisHorizontal: { position: 'absolute', left: 23, right: 23, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.23)' },
  pulseAxisVertical: { position: 'absolute', top: 13, bottom: 11, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.22)' },
  pulseCore: { width: 142, height: 142, borderRadius: 71, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  pulseCoreEyebrow: { color: FateDropColors.muted, fontSize: 5.3, fontWeight: '900', letterSpacing: .55, marginTop: 2 },
  pulseCoreScope: { color: FateDropColors.gold, fontSize: 5.8, fontWeight: '900', letterSpacing: .7, marginTop: 3 },
  pulseCoreValue: { fontFamily: Fonts.serif, fontSize: 32, lineHeight: 38, marginTop: 1 },
  pulseCoreCondition: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 10.5 },
  pulseCorePeriod: { color: FateDropColors.muted, fontSize: 5.6, fontWeight: '800', letterSpacing: .4, marginTop: 3 },
  breadthOrbital: { position: 'absolute', width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,8,20,.50)', zIndex: 4 },
  breadthLeft: { left: 0, top: 86 },
  breadthRight: { right: 0, top: 86 },
  breadthBottom: { bottom: 0 },
  breadthRing: { ...StyleSheet.absoluteFill, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  breadthValue: { fontFamily: Fonts.serif, fontSize: 18, lineHeight: 21 },
  breadthLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', letterSpacing: .5, marginTop: 2 },
  coverageLedger: { marginTop: 4, paddingHorizontal: 7, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.30)', backgroundColor: 'rgba(3,8,20,.18)' },
  coverageTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  coverageEyebrow: { color: FateDropColors.gold, fontSize: 6.2, fontWeight: '900', letterSpacing: .8 },
  coverageTitle: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  coverageThreshold: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 13 },
  coverageTrack: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,.08)', marginTop: 10, overflow: 'hidden' },
  coverageFill: { height: 2, borderRadius: 1 },
  coverageFacts: { flexDirection: 'row', justifyContent: 'space-between', gap: 7, marginTop: 7 },
  coverageCopy: { color: FateDropColors.muted, fontSize: 6.8 },
  readinessLine: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 7, paddingVertical: 12 },
  readinessCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  calibrationLedger: { minHeight: 58, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.22)' },
  calibrationMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  calibrationLabel: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .55 },
  calibrationValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13, marginTop: 3 },
  calibrationDetail: { color: FateDropColors.muted, fontSize: 6.2, marginTop: 1 },
  ledgerDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(226,197,141,.20)' },
  moversHead: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 14, paddingHorizontal: 4 },
  moversEyebrow: { color: FateDropColors.manifested, fontSize: 7.5, fontWeight: '900', letterSpacing: .95 },
  moversTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 3 },
  segmentedRow: { width: 118, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.27)' },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segmentButtonActive: { borderBottomWidth: 1, borderBottomColor: FateDropColors.manifested },
  segmentButtonText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' },
  segmentButtonTextActive: { color: FateDropColors.ivory },
  moverColumns: { flexDirection: 'row', gap: 9 },
  moverColumn: { flex: 1, minWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.25)' },
  moverColumnHead: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 5 },
  moverColumnLabel: { fontSize: 7, fontWeight: '900', letterSpacing: .65 },
  moverColumnLimit: { marginLeft: 'auto', color: FateDropColors.muted, fontSize: 5.7, fontWeight: '800' },
  moverRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.14)', borderLeftWidth: 1, borderLeftColor: 'transparent' },
  moverRank: { width: 12, color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 13 },
  moverIdentity: { flex: 1, minWidth: 0 },
  moverName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 9.8, lineHeight: 12 },
  moverMeta: { color: FateDropColors.muted, fontSize: 5.8, marginTop: 3 },
  moverValue: { maxWidth: 43, fontSize: 8.2, fontWeight: '900', textAlign: 'right' },
  moverEmpty: { minHeight: 112, color: FateDropColors.muted, fontSize: 7.5, lineHeight: 12, textAlign: 'center', paddingHorizontal: 8, paddingTop: 22 },
  moverEvidence: { marginTop: 9, paddingHorizontal: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)', backgroundColor: 'rgba(124,110,255,.06)' },
  moverEvidenceEyebrow: { color: FateDropColors.manifested, fontSize: 6.2, fontWeight: '900', letterSpacing: .7 },
  moverEvidenceTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15, marginTop: 3 },
  moverEvidenceFacts: { flexDirection: 'row', gap: 9, marginTop: 9 },
  moverEvidenceFact: { flex: 1, minWidth: 0 },
  moverEvidenceLabel: { color: FateDropColors.muted, fontSize: 5.6, fontWeight: '900' },
  moverEvidenceValue: { color: FateDropColors.ivory, fontSize: 8.5, lineHeight: 11, marginTop: 2 },
  moverPriceAction: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.24)' },
  moverPriceActionText: { color: FateDropColors.goldBright, fontSize: 6.5, fontWeight: '900', letterSpacing: .55 },
  valueInstrument: { minHeight: 230, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  valueOrbit: { position: 'absolute', width: 208, height: 208, borderRadius: 104, borderWidth: StyleSheet.hairlineWidth },
  valueLabel: { color: FateDropColors.gold, fontSize: 6.8, fontWeight: '900', letterSpacing: .8, marginTop: 8 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 37, lineHeight: 44, marginTop: 2 },
  valueSub: { maxWidth: 230, color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 2 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  metricLabel: { color: FateDropColors.muted, fontSize: 6.3, fontWeight: '900', letterSpacing: .55, textAlign: 'center' },
  metricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, marginTop: 2, textAlign: 'center' },
  metricDetail: { color: FateDropColors.muted, fontSize: 6.3, marginTop: 2 },
  collectionCabinet: { minHeight: 250, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 12, padding: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(3,8,20,.28)' },
  collectionCabinetOrbit: { position: 'absolute', top: 17, width: 178, height: 178, borderRadius: 89, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)' },
  collectionCabinetEyebrow: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  collectionCabinetTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 28, lineHeight: 34, marginTop: 3, textAlign: 'center' },
  collectionCabinetCopy: { maxWidth: 285, color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, textAlign: 'center', marginTop: 4 },
  collectionDoorRow: { width: '100%', flexDirection: 'row', gap: 9, marginTop: 22 },
  collectionDoor: { flex: 1, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.27)', borderRadius: 12, backgroundColor: 'rgba(4,9,23,.66)' },
  collectionDoorValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17 },
  collectionDoorLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .55, marginTop: 2 },
  collectorValueCard: { marginTop: 12, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.22)' },
  collectorValueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collectorValueSource: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collectorValueSourceText: { color: FateDropColors.echo, fontSize: 9, fontWeight: '900', letterSpacing: .85 },
  collectorCurrency: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  collectorValueLine: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  collectorValueLabel: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: .75 },
  collectorValueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24, lineHeight: 29, marginTop: 1 },
  collectorValueNote: { maxWidth: 330, color: FateDropColors.secondary, fontSize: 9, lineHeight: 13, marginTop: 5 },
  collectorCoverageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  collectorCoverageLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  collectorCoverageValue: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900' },
  collectorCoverageTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: 'rgba(255,255,255,.09)', marginTop: 7 },
  collectorCoverageFill: { height: 5, borderRadius: 3, backgroundColor: FateDropColors.echo },
  collectorSourceNote: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 12, marginTop: 9 },
  collectorFactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  collectorFact: { width: '48.7%', minHeight: 92, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)', borderRadius: 17, backgroundColor: 'rgba(3,8,20,.52)' },
  collectorFactLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .55 },
  collectorFactValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 22, lineHeight: 27, marginTop: 2 },
  collectorFactDetail: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 11, marginTop: 2 },
  closestSetCard: { marginTop: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.44)', borderRadius: 18, backgroundColor: 'rgba(7,12,25,.62)' },
  closestSetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  closestSetEyebrow: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: .75 },
  closestSetName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, lineHeight: 21, marginTop: 3 },
  closestSetPercent: { color: FateDropColors.echo, fontFamily: Fonts.serif, fontSize: 22 },
  closestSetTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(255,255,255,.09)', marginTop: 12 },
  closestSetFill: { height: 4, borderRadius: 2, backgroundColor: FateDropColors.echo },
  closestSetBottom: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, marginTop: 8 },
  closestSetDetail: { flex: 1, color: FateDropColors.secondary, fontSize: 9.5 },
  closestSetAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}66`, backgroundColor: `${FateDropColors.echo}0B` },
  closestSetActionText: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: .45 },
  collectorExplanation: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4, marginTop: 14 },
  panelCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 15 },
  collectionPrimaryAction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingHorizontal: 15, borderRadius: 15, backgroundColor: FateDropColors.echo },
  collectionPrimaryActionText: { flex: 1, color: FateDropColors.background, fontSize: 10, fontWeight: '900', letterSpacing: .65, textAlign: 'center' },
  retryAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}55`, borderRadius: 13 },
  retryActionText: { color: FateDropColors.echo, fontSize: 8.5, fontWeight: '900', letterSpacing: .55 },
  orbitalAction: { minHeight: 45, marginTop: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(3,8,20,.20)' },
  orbitalActionText: { color: FateDropColors.goldBright, fontSize: 7.8, fontWeight: '900', letterSpacing: .65 },
  truthLedger: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 19, paddingHorizontal: 8, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.27)' },
  truthCopy: { flex: 1, color: FateDropColors.muted, fontSize: 7.8, lineHeight: 12 },
});
