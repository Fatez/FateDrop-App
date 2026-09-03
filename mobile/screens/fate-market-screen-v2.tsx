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

type MarketAreaKey = 'pulse' | 'price' | 'collectors';

const marketAreas: Record<MarketAreaKey, {
  accent: string;
  detail: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}> = {
  pulse: {
    accent: FateDropColors.manifested,
    detail: 'Direction, volatility and unusual movement.',
    eyebrow: 'WHAT IS MOVING?',
    icon: 'pulse-outline',
    title: 'FatePulse',
  },
  price: {
    accent: FateDropColors.goldBright,
    detail: 'Exact-card value with evidence and history.',
    eyebrow: 'WHAT IS IT WORTH?',
    icon: 'pricetag-outline',
    title: 'FatePrice',
  },
  collectors: {
    accent: FateDropColors.echo,
    detail: 'Ownership, completion and personal value.',
    eyebrow: 'WHAT DOES IT MEAN TO ME?',
    icon: 'albums-outline',
    title: 'Fate Collectors',
  },
};

const marketAreaOrder: MarketAreaKey[] = ['pulse', 'price', 'collectors'];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function marketArea(value: string | string[] | undefined): MarketAreaKey {
  const candidate = first(value)?.trim().toLowerCase();
  return candidate === 'price' || candidate === 'collectors' ? candidate : 'pulse';
}

export default function FateMarketScreenV2() {
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadMarket()} tintColor={FateDropColors.goldBright} />}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>FATE MARKET</Text>
            <Text style={styles.title}>Understand the market before you act.</Text>
            <Text style={styles.copy}>FatePrice gives value. FatePulse gives trend. Fate Collectors makes it personal.</Text>
          </View>
          <View style={styles.marketMark}>
            <View style={styles.marketMarkOuter} />
            <View style={styles.marketMarkInner} />
            {loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name="analytics-outline" size={27} color={FateDropColors.goldBright} />}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaRail}>
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
        </ScrollView>

        {activeArea === 'pulse' ? <PulsePanel data={pulse} error={pulseError} loading={loading} /> : null}
        {activeArea === 'price' ? <PricePanel /> : null}
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
        <MarketMetric label="PRICE INDEX" value={movementText(movement?.medianPercent)} detail={`7D · ${movement?.contributors ?? 0}/${movement?.eligible ?? 0} lanes`} />
        <MarketMetric label="VOLATILITY" value="—" detail="Amplitude" />
      </View>
      <View style={styles.readinessRow}>
        <Ionicons name={error ? 'cloud-offline-outline' : 'time-outline'} size={17} color={FateDropColors.manifested} />
        <Text style={styles.readinessCopy}>{error || `${historyDetail} Heat, volatility and rankings stay blank until their calibration gates pass.`}</Text>
      </View>
      <View style={styles.list}>
        <SignalRow label="Heating up" />
        <SignalRow label="Cooling down" />
        <SignalRow label="Market movers" />
      </View>
    </View>
  );
}

function PricePanel() {
  return (
    <View style={[styles.panel, { borderColor: `${FateDropColors.goldBright}55` }]}>
      <PanelHeading eyebrow="FATEPRICE" title="What is this card actually worth?" accent={FateDropColors.goldBright} status="EVIDENCE GATED" />
      <View style={styles.priceHero}>
        <Text style={styles.priceLabel}>CANONICAL EXACT-CARD VALUE</Text>
        <Text style={styles.priceValue}>—</Text>
        <Text style={styles.priceCoverage}>No synthetic price · no silent FX conversion</Text>
      </View>
      <View style={styles.metricGrid}>
        <MarketMetric label="7D" value="—" detail="Movement" />
        <MarketMetric label="30D" value="—" detail="Movement" />
        <MarketMetric label="CONFIDENCE" value="—" detail="Evidence quality" />
      </View>
      <View style={styles.readinessRow}>
        <Ionicons name="lock-closed-outline" size={17} color={FateDropColors.goldBright} />
        <Text style={styles.readinessCopy}>FatePrice stays blank until an exact canonical card, market scope and fresh price evidence can be read safely. Asking prices are not silently treated as sold value.</Text>
      </View>
    </View>
  );
}

function valueText(data: FateCollectorsSnapshot | null) {
  const collection = data?.summary.collection;
  if (!collection || collection.pricedUnits === 0) return '—';
  return `€${collection.knownValue.toFixed(2)}`;
}

function CollectorsPanel({ data, error, loading, signedIn }: { data: FateCollectorsSnapshot | null; error: string; loading: boolean; signedIn: boolean }) {
  const summary = data?.summary;
  const status = !signedIn ? 'FATEDROP ID REQUIRED' : data ? 'PRIVATE EVIDENCE' : loading ? 'LOADING' : 'PRIVATE PREVIEW';
  const collectionCopy = !signedIn
    ? 'Connect a FateDrop ID now; ownership, imports and valuation are always private and owner-scoped.'
    : error
      ? error
      : data?.status === 'empty'
        ? 'Your collection is empty. FateDrop will accept only a user-exported Collectr CSV and preview exact matches before anything can be added.'
        : 'Completion uses verified canonical printings. Price gaps and incomplete set catalogues stay visible instead of becoming fake precision.';

  return (
    <View style={[styles.panel, { borderColor: `${FateDropColors.echo}55` }]}>
      <PanelHeading eyebrow="FATE COLLECTORS" title="What do I own, and what does it mean?" accent={FateDropColors.echo} status={status} />
      <View style={styles.collectorHero}>
        <Text style={styles.priceLabel}>KNOWN COLLECTION VALUE</Text>
        <Text style={styles.priceValue}>{valueText(data)}</Text>
        <Text style={styles.priceCoverage}>Price coverage {summary ? `${summary.collection.priceCoveragePercent}%` : '—'} · native EUR evidence</Text>
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

function SignalRow({ label }: { label: string }) {
  return <View style={styles.signalRow}><Text style={styles.signalRowLabel}>{label}</Text><Text style={styles.signalRowValue}>Awaiting eligible history</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 124 },
  flex: { flex: 1 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 18 },
  heroCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 34, fontWeight: '700', marginTop: 6 },
  copy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 7 },
  marketMark: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,19,27,.92)' },
  marketMarkOuter: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: `${FateDropColors.goldBright}42` },
  marketMarkInner: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: `${FateDropColors.manifested}42` },
  areaRail: { gap: 10, paddingRight: 20, paddingBottom: 16 },
  areaCard: { width: 174, minHeight: 146, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(15,21,29,.86)' },
  areaIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  areaEyebrow: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.85, marginTop: 10 },
  areaTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 3 },
  areaDetail: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  panel: { borderRadius: 22, borderWidth: 1, backgroundColor: 'rgba(11,17,24,.92)', padding: 16, marginTop: 2 },
  panelHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  panelEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { color: FateDropColors.ivory, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 4 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metric: { flex: 1, minWidth: 0, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.78)' },
  metricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  metricValue: { color: FateDropColors.ivory, fontSize: 17, fontWeight: '900', marginTop: 5 },
  metricDetail: { color: FateDropColors.secondary, fontSize: 7.5, lineHeight: 11, marginTop: 3 },
  readinessRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(18,24,32,.72)' },
  readinessCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 15 },
  list: { marginTop: 10 },
  signalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: FateDropColors.borderSoft },
  signalRowLabel: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '800' },
  signalRowValue: { color: FateDropColors.muted, fontSize: 8.5 },
  priceHero: { alignItems: 'center', paddingVertical: 23, marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.goldBright}33`, backgroundColor: `${FateDropColors.goldBright}08` },
  collectorHero: { alignItems: 'center', paddingVertical: 23, marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.echo}33`, backgroundColor: `${FateDropColors.echo}08` },
  priceLabel: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  priceValue: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 34, fontWeight: '700', marginTop: 3 },
  priceCoverage: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 3 },
  collectorStats: { flexDirection: 'row', gap: 8, marginTop: 9 },
  collectorMetric: { flex: 1, minWidth: 0, alignItems: 'center', padding: 10, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.78)' },
  collectorMetricValue: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  collectorMetricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', marginTop: 3 },
  panelCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 14 },
  importNote: { color: FateDropColors.echo, fontSize: 8, lineHeight: 13, fontWeight: '800', marginTop: 10 },
  secondaryButton: { minHeight: 46, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.echo}55`, backgroundColor: `${FateDropColors.echo}0D`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { color: FateDropColors.echo, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  truthCard: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(14,20,28,.74)' },
  truthTitle: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900' },
  truthCopy: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
});
