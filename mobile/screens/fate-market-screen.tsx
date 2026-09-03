import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  fetchFateCollectorsSummary,
  fetchFatePulse,
  type FateCollectorsSnapshot,
  type FatePulseSnapshot,
} from '@/services/fate-market';

type MarketAreaKey = 'trader' | 'pulse' | 'collectors';

const marketAreas: Record<MarketAreaKey, {
  accent: string;
  detail: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}> = {
  trader: {
    accent: FateDropColors.goldBright,
    detail: 'Have, want and compatible opportunities.',
    eyebrow: 'ACT IN THE MARKET',
    icon: 'swap-horizontal-outline',
    title: 'Fate Trader',
  },
  pulse: {
    accent: FateDropColors.manifested,
    detail: 'Direction, volatility and unusual movement.',
    eyebrow: 'READ THE MARKET',
    icon: 'pulse-outline',
    title: 'FatePulse',
  },
  collectors: {
    accent: FateDropColors.echo,
    detail: 'Ownership, completion and personal value.',
    eyebrow: 'YOUR POSITION',
    icon: 'albums-outline',
    title: 'Fate Collectors',
  },
};

const marketAreaOrder: MarketAreaKey[] = ['trader', 'pulse', 'collectors'];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function marketArea(value: string | string[] | undefined): MarketAreaKey {
  const candidate = first(value)?.trim().toLowerCase();
  return candidate === 'trader' || candidate === 'collectors' ? candidate : 'pulse';
}

export default function FateMarketScreen() {
  const params = useLocalSearchParams<{ area?: string | string[] }>();
  const { signedIn } = useFateDropId();
  const [activeArea, setActiveArea] = useState<MarketAreaKey>(() => marketArea(params.area));
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState<FatePulseSnapshot | null>(null);
  const [pulseError, setPulseError] = useState('');
  const [collectors, setCollectors] = useState<FateCollectorsSnapshot | null>(null);
  const [collectorsError, setCollectorsError] = useState('');

  useEffect(() => {
    setActiveArea(marketArea(params.area));
  }, [params.area]);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    const pulseRequest = fetchFatePulse();
    const collectorsRequest = signedIn ? fetchFateCollectorsSummary() : Promise.resolve(null);
    const [pulseResult, collectorsResult] = await Promise.allSettled([pulseRequest, collectorsRequest]);
    if (pulseResult.status === 'fulfilled') {
      setPulse(pulseResult.value);
      setPulseError('');
    } else {
      setPulseError('Verified market evidence is temporarily unavailable.');
    }
    if (collectorsResult.status === 'fulfilled') {
      setCollectors(collectorsResult.value);
      setCollectorsError('');
    } else {
      setCollectorsError('Your collection could not be read safely right now.');
    }
    setLoading(false);
  }, [signedIn]);

  useFocusEffect(useCallback(() => { void loadMarket(); }, [loadMarket]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadMarket()} tintColor={FateDropColors.goldBright} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FATEDROP MARKET</Text>
            <Text style={styles.title}>The market, your trades, your collection.</Text>
            <Text style={styles.copy}>Three views of the same canonical evidence—without inventing price, demand or performance.</Text>
          </View>
          <View pointerEvents="none" style={styles.marketMark}>
            <View style={styles.marketMarkOuter} />
            <View style={styles.marketMarkInner} />
            {loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name="analytics-outline" size={27} color={FateDropColors.goldBright} />}
          </View>
        </View>

        <View style={styles.areaRail}>
          {marketAreaOrder.map((key) => {
            const area = marketAreas[key];
            const selected = activeArea === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setActiveArea(key)}
                style={({ pressed }) => [
                  styles.areaCard,
                  selected && { borderColor: `${area.accent}88`, backgroundColor: `${area.accent}12` },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.areaIcon, { borderColor: `${area.accent}55`, backgroundColor: `${area.accent}10` }]}>
                  <Ionicons name={area.icon} size={20} color={area.accent} />
                </View>
                <Text style={[styles.areaEyebrow, selected && { color: area.accent }]}>{area.eyebrow}</Text>
                <Text style={styles.areaTitle}>{area.title}</Text>
                <Text style={styles.areaDetail}>{area.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeArea === 'trader' ? <TraderPanel /> : null}
        {activeArea === 'pulse' ? <PulsePanel data={pulse} error={pulseError} loading={loading} /> : null}
        {activeArea === 'collectors' ? <CollectorsPanel data={collectors} error={collectorsError} loading={loading} signedIn={signedIn} /> : null}

        <View style={styles.truthCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={FateDropColors.goldBright} />
          <View style={styles.flex}>
            <Text style={styles.truthTitle}>One evidence boundary</Text>
            <Text style={styles.truthCopy}>Cloud owns identity, history and calculations. Missing evidence stays unknown; the App never fills a gap with a synthetic score or value.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TraderPanel() {
  return (
    <View style={[styles.panel, { borderColor: `${FateDropColors.goldBright}55` }]}>
      <PanelHeading eyebrow="FATE TRADER" title="Turn have and want into a useful match." accent={FateDropColors.goldBright} status="AVAILABLE" />
      <View style={styles.traderFlow}>
        <FlowStep icon="cube-outline" label="HAVE" />
        <Ionicons name="arrow-forward" size={16} color={FateDropColors.muted} />
        <FlowStep icon="search-outline" label="MATCH" />
        <Ionicons name="arrow-forward" size={16} color={FateDropColors.muted} />
        <FlowStep icon="sparkles-outline" label="WANT" />
      </View>
      <Text style={styles.panelCopy}>Manage structured trading intentions and compatible collector opportunities without mixing trade evidence into retailer stock truth.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/fate-trader')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>OPEN FATE TRADER</Text>
        <Ionicons name="arrow-forward" size={16} color={FateDropColors.ink} />
      </Pressable>
    </View>
  );
}

function movementText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function PulsePanel({ data, error, loading }: { data: FatePulseSnapshot | null; error: string; loading: boolean }) {
  const movement = data?.pulse?.movement.d7 ?? null;
  const status = data?.status === 'available' ? 'EVIDENCE LIVE' : loading && !data ? 'LOADING' : 'HISTORY BUILDING';
  const historyDetail = data
    ? `${data.readiness.history.distinctMarketDays} verified market days · ${data.readiness.canonical.mappedCards} exact card mappings.`
    : 'Waiting for the Cloud evidence boundary.';
  return (
    <View style={[styles.panel, { borderColor: `${FateDropColors.manifested}55` }]}>
      <PanelHeading eyebrow="FATEPULSE" title="What is happening in the market?" accent={FateDropColors.manifested} status={status} />
      <View style={styles.metricGrid}>
        <MarketMetric label="MARKET HEAT" value="—" detail="Activity" />
        <MarketMetric label="PRICE" value={movementText(movement?.medianPercent)} detail={`7D · ${movement?.contributors ?? 0}/${movement?.eligible ?? 0} lanes`} />
        <MarketMetric label="VOLATILITY" value="—" detail="Stability" />
      </View>
      <View style={styles.readinessRow}>
        <Ionicons name={error ? 'cloud-offline-outline' : 'time-outline'} size={17} color={FateDropColors.manifested} />
        <Text style={styles.readinessCopy}>{error || `${historyDetail} Heat, volatility and rankings stay blank until their calibration gates pass.`}</Text>
      </View>
      <View style={styles.pulseList}>
        <PulseRow label="Heating up" />
        <PulseRow label="Cooling down" />
        <PulseRow label="Market movers" />
      </View>
    </View>
  );
}

function valueText(data: FateCollectorsSnapshot | null) {
  const collection=data?.summary.collection;
  if (!collection || collection.pricedUnits === 0) return '—';
  return `€${collection.knownValue.toFixed(2)}`;
}

function CollectorsPanel({ data, error, loading, signedIn }: { data: FateCollectorsSnapshot | null; error: string; loading: boolean; signedIn: boolean }) {
  const summary=data?.summary;
  const status=!signedIn?'FATEDROP ID REQUIRED':data?'PRIVATE EVIDENCE':loading?'LOADING':'PRIVATE PREVIEW';
  const collectionCopy = !signedIn
    ? 'Connect a FateDrop ID now; ownership, imports and valuation are always private and owner-scoped.'
    : error
      ? error
      : data?.status === 'empty'
        ? 'Your collection is empty. FateDrop will accept only a user-exported Collectr CSV and will preview exact matches before anything can be added.'
        : 'Completion uses verified canonical printings. Price gaps and incomplete set catalogues stay visible instead of becoming fake precision.';
  return (
    <View style={[styles.panel, { borderColor: `${FateDropColors.echo}55` }]}>
      <PanelHeading eyebrow="FATE COLLECTORS" title="What do I own, and what does it mean?" accent={FateDropColors.echo} status={status} />
      <View style={styles.collectorHero}>
        <Text style={styles.collectorLabel}>KNOWN COLLECTION VALUE</Text>
        <Text style={styles.collectorValue}>{valueText(data)}</Text>
        <Text style={styles.collectorCoverage}>Price coverage {summary ? `${summary.collection.priceCoveragePercent}%` : '—'} · native EUR evidence</Text>
      </View>
      <View style={styles.collectorStats}>
        <CollectorMetric label="CARDS" value={summary ? String(summary.cardUnits) : '—'} />
        <CollectorMetric label="SETS" value={summary ? String(summary.setsOwned) : '—'} />
        <CollectorMetric label="CLOSEST SET" value={summary?.closestSet ? `${summary.closestSet.completionPercent}%` : '—'} />
      </View>
      <Text style={styles.panelCopy}>{collectionCopy}</Text>
      {signedIn ? <Text style={styles.importNote}>COLLECTR · User-export preview only. No account automation, scraping or imported price claims.</Text> : null}
      {!signedIn ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>CONNECT FATEDROP ID</Text>
          <Ionicons name="arrow-forward" size={16} color={FateDropColors.echo} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PanelHeading({ accent, eyebrow, status, title }: { accent: string; eyebrow: string; status: string; title: string }) {
  return (
    <View style={styles.panelHeading}>
      <View style={styles.flex}>
        <Text style={[styles.panelEyebrow, { color: accent }]}>{eyebrow}</Text>
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      <View style={[styles.statusPill, { borderColor: `${accent}66`, backgroundColor: `${accent}10` }]}>
        <Text style={[styles.statusText, { color: accent }]}>{status}</Text>
      </View>
    </View>
  );
}

function MarketMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

function CollectorMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.collectorMetric}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.collectorMetricValue}>{value}</Text><Text style={styles.collectorMetricLabel}>{label}</Text></View>;
}

function FlowStep({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return <View style={styles.flowStep}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /><Text style={styles.flowLabel}>{label}</Text></View>;
}

function PulseRow({ label }: { label: string }) {
  return <View style={styles.pulseRow}><Text style={styles.pulseRowLabel}>{label}</Text><Text style={styles.pulseRowValue}>Awaiting eligible history</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 124 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 18 },
  headerCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 34, fontWeight: '700', marginTop: 6 },
  copy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 7 },
  marketMark: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,19,27,.92)' },
  marketMarkOuter: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: `${FateDropColors.goldBright}42` },
  marketMarkInner: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: `${FateDropColors.manifested}42` },
  areaRail: { flexDirection: 'row', gap: 8, marginBottom: 13 },
  areaCard: { flex: 1, minHeight: 150, padding: 11, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(15,21,29,.94)' },
  areaIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  areaEyebrow: { color: FateDropColors.muted, fontSize: 6.5, lineHeight: 9, fontWeight: '900', letterSpacing: .55 },
  areaTitle: { color: FateDropColors.ivory, fontSize: 12, lineHeight: 15, fontWeight: '900', marginTop: 4 },
  areaDetail: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 12, marginTop: 5 },
  panel: { padding: 16, borderRadius: 23, borderWidth: 1, backgroundColor: 'rgba(12,18,26,.96)' },
  panelHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  panelEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 23, lineHeight: 27, fontWeight: '700', marginTop: 4 },
  statusPill: { maxWidth: 108, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusText: { fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: .55, textAlign: 'center' },
  panelCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 14 },
  importNote: { color: FateDropColors.muted, fontSize: 8, lineHeight: 13, fontWeight: '800', letterSpacing: .35, marginTop: 10 },
  traderFlow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 18 },
  flowStep: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.goldBright}35`, backgroundColor: `${FateDropColors.goldBright}0A` },
  flowLabel: { color: FateDropColors.ivory, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  primaryButton: { marginTop: 16, minHeight: 48, paddingHorizontal: 16, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FateDropColors.goldBright },
  primaryButtonText: { color: FateDropColors.ink, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  metricGrid: { flexDirection: 'row', gap: 7, marginTop: 18 },
  metric: { flex: 1, minHeight: 100, padding: 11, borderRadius: 15, borderWidth: 1, borderColor: `${FateDropColors.manifested}32`, backgroundColor: `${FateDropColors.manifested}09` },
  metricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .45 },
  metricValue: { color: FateDropColors.ivory, fontSize: 26, fontWeight: '900', marginTop: 8 },
  metricDetail: { color: FateDropColors.secondary, fontSize: 8, marginTop: 4 },
  readinessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: `${FateDropColors.manifested}0A` },
  readinessCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  pulseList: { marginTop: 10, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: FateDropColors.borderSoft },
  pulseRow: { minHeight: 43, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FateDropColors.borderSoft },
  pulseRowLabel: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900' },
  pulseRowValue: { color: FateDropColors.muted, fontSize: 8, textAlign: 'right' },
  collectorHero: { marginTop: 18, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.echo}35`, backgroundColor: `${FateDropColors.echo}08` },
  collectorLabel: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  collectorValue: { color: FateDropColors.ivory, fontSize: 36, fontWeight: '900', marginTop: 5 },
  collectorCoverage: { color: FateDropColors.muted, fontSize: 9, marginTop: 2 },
  collectorStats: { flexDirection: 'row', gap: 7, marginTop: 8 },
  collectorMetric: { flex: 1, minHeight: 74, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  collectorMetricValue: { color: FateDropColors.ivory, fontSize: 20, fontWeight: '900' },
  collectorMetricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .45, marginTop: 6 },
  secondaryButton: { marginTop: 14, minHeight: 46, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.echo}55`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${FateDropColors.echo}0B` },
  secondaryButtonText: { color: FateDropColors.echo, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  truthCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(18,24,32,.92)' },
  truthTitle: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900' },
  truthCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  flex: { flex: 1 },
  pressed: { opacity: .76, transform: [{ scale: .985 }] },
});
