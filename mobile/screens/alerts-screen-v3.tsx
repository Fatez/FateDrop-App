import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

const stages: CanonicalAlertStage[] = ['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'];
type AlertView = 'signals' | 'matches';

const stageMeta: Record<CanonicalAlertStage, {
  color: string;
  companion: string;
  label: string;
  hero: number;
  thumbnail: number;
  headline: string;
  copy: string;
}> = {
  WHISPER: {
    color: FateDropColors.whisper,
    companion: 'Oru',
    label: 'Whisper',
    hero: require('../assets/images/alert-oru.webp'),
    thumbnail: require('../assets/images/alert-oru.webp'),
    headline: 'Something is stirring.',
    copy: 'Early movement worth watching. Whisper is evidence of change, not confirmed live stock.',
  },
  ECHO: {
    color: FateDropColors.echo,
    companion: 'Fenn',
    label: 'Echo',
    hero: require('../assets/images/alert-fenn.webp'),
    thumbnail: require('../assets/images/alert-fenn.webp'),
    headline: 'Readiness detected.',
    copy: 'Access, queue, traffic or security conditions changed. Get ready without pretending stock is confirmed.',
  },
  MANIFESTED: {
    color: FateDropColors.manifested,
    companion: 'Koru',
    label: 'Manifested',
    hero: require('../assets/images/alert-koru.webp'),
    thumbnail: require('../assets/images/alert-koru.webp'),
    headline: 'Verified stock is live.',
    copy: 'Manifested means FateDrop has observed confirmed purchasable availability from the current evidence.',
  },
  VANISHED: {
    color: FateDropColors.vanished,
    companion: 'Nyxen',
    label: 'Vanished',
    hero: require('../assets/images/alert-nyxen.webp'),
    thumbnail: require('../assets/images/alert-nyxen.webp'),
    headline: 'The signal has gone quiet.',
    copy: 'Previously verified availability is no longer observed. FateDrop keeps the history instead of inventing a new event.',
  },
};

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const pounds = (pence: number | null | undefined) => pence == null ? null : `£${(pence / 100).toFixed(2)}`;

function ago(value: string | number) {
  const timestamp = typeof value === 'number' ? value * (value < 10_000_000_000 ? 1000 : 1) : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recent';
  const mins = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function percentText(delta: number | null | undefined) {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (Math.abs(delta) < 0.05) return 'AT RRP';
  return delta < 0 ? `${Math.abs(delta).toFixed(1)}% BELOW RRP` : `${delta.toFixed(1)}% ABOVE RRP`;
}

export default function AlertsScreenV3() {
  const params = useLocalSearchParams<{ stage?: string | string[]; view?: string | string[] }>();
  const { signedIn, snapshot, refresh } = useFateDropId();
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [stage, setStage] = useState<CanonicalAlertStage>('ECHO');
  const [view, setView] = useState<AlertView>('signals');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const incomingStage = first(params.stage)?.toUpperCase();
    const incomingView = first(params.view)?.toLowerCase();
    if (incomingStage && stages.includes(incomingStage as CanonicalAlertStage)) setStage(incomingStage as CanonicalAlertStage);
    if (incomingView === 'matches' || incomingView === 'fatmatch' || incomingView === 'fatematch') setView('matches');
  }, [params.stage, params.view]);

  const load = useCallback(async () => {
    if (!signedIn) {
      setAlerts([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextAlerts] = await Promise.all([fetchCanonicalAlerts(100), refresh()]);
      setAlerts(nextAlerts);
    } catch (cause) {
      setAlerts([]);
      setError(cause instanceof Error ? cause.message : 'Alert inbox is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [refresh, signedIn]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const counts = useMemo(
    () => Object.fromEntries(stages.map((value) => [value, alerts.filter((alert) => alert.fateStage === value).length])) as Record<CanonicalAlertStage, number>,
    [alerts],
  );
  const filtered = useMemo(() => alerts.filter((alert) => alert.fateStage === stage), [alerts, stage]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <FateDropHeader
          title="Alerts"
          subtitle="SIGNALS & YOUR FATEMATCH HUNTS"
          rightAction={
            <Pressable onPress={() => router.push('/notification-preferences')} style={styles.headerButton}>
              <Ionicons name="options-outline" size={18} color={FateDropColors.ivory} />
            </Pressable>
          }
        />

        <View style={styles.viewSwitch}>
          <Pressable onPress={() => setView('signals')} style={[styles.viewOption, view === 'signals' && styles.viewOptionActive]}>
            <Text style={[styles.viewOptionText, view === 'signals' && styles.viewOptionTextActive]}>SIGNALS</Text>
          </Pressable>
          <Pressable onPress={() => setView('matches')} style={[styles.viewOption, view === 'matches' && styles.viewOptionActive]}>
            <Text style={[styles.viewOptionText, view === 'matches' && styles.viewOptionTextActive]}>FATEMATCH</Text>
          </Pressable>
        </View>

        {view === 'signals' ? (
          <SignalInbox signedIn={signedIn} alerts={alerts} filtered={filtered} counts={counts} stage={stage} setStage={setStage} loading={loading} error={error} />
        ) : (
          <FateMatchInbox signedIn={signedIn} snapshot={snapshot} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SignalInbox({
  signedIn,
  filtered,
  counts,
  stage,
  setStage,
  loading,
  error,
}: {
  signedIn: boolean;
  alerts: CanonicalMobileAlert[];
  filtered: CanonicalMobileAlert[];
  counts: Record<CanonicalAlertStage, number>;
  stage: CanonicalAlertStage;
  setStage: (stage: CanonicalAlertStage) => void;
  loading: boolean;
  error: string | null;
}) {
  const meta = stageMeta[stage];

  return (
    <>
      <View style={styles.tabs}>
        {stages.map((value) => {
          const item = stageMeta[value];
          const active = value === stage;
          return (
            <Pressable key={value} onPress={() => setStage(value)} style={[styles.tab, active && { borderColor: `${item.color}88`, backgroundColor: `${item.color}10` }]}>
              <Text style={[styles.tabLabel, active && { color: item.color }]}>{item.label.toUpperCase()}</Text>
              <Text style={[styles.tabCount, active && { color: FateDropColors.ivory }]}>{signedIn ? counts[value] : '—'}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.hero, { borderColor: `${meta.color}66` }]}>
        <Image source={meta.hero} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" transition={160} />
        <View style={styles.heroShade} />
        <View style={styles.heroContent}>
          <View style={styles.companionPill}>
            <Image source={meta.thumbnail} style={styles.companionThumb} contentFit="cover" />
            <View>
              <Text style={[styles.companionStage, { color: meta.color }]}>{meta.companion.toUpperCase()} · {meta.label.toUpperCase()}</Text>
              <Text style={styles.companionRole}>Your {meta.label.toLowerCase()} companion</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{meta.headline}</Text>
          <Text style={styles.heroCopy}>{meta.copy}</Text>
        </View>
      </View>

      {!signedIn ? (
        <SignInState />
      ) : (
        <>
          <View style={styles.sectionHead}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: meta.color }]}>{meta.companion.toUpperCase()} IS WATCHING</Text>
              <Text style={styles.sectionTitle}>{meta.label} alerts</Text>
            </View>
            <Pressable onPress={() => router.push('/fatefind')}>
              <Text style={styles.sectionAction}>FATEFIND →</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="warning-outline" size={18} color={FateDropColors.warning} />
              <View style={styles.flex}>
                <Text style={styles.errorTitle}>Canonical inbox unavailable</Text>
                <Text style={styles.errorCopy}>{error}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.alertList}>
            {filtered.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
            {!loading && !error && !filtered.length ? (
              <View style={styles.emptyState}>
                <Image source={meta.thumbnail} style={styles.emptyCompanion} contentFit="cover" />
                <Text style={styles.emptyTitle}>No {meta.label.toLowerCase()} alerts right now</Text>
                <Text style={styles.emptyCopy}>FateDrop leaves the feed quiet when nothing has met the policy for this signal stage.</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </>
  );
}

function FateMatchInbox({ signedIn, snapshot }: { signedIn: boolean; snapshot: ReturnType<typeof useFateDropId>['snapshot'] }) {
  if (!signedIn) return <SignInState />;

  const hunts = (snapshot?.fateFinds ?? []).filter((item) => item.enabled !== false);
  const matches = [...(snapshot?.fateMatches ?? [])].sort((a, b) => b.matchedAt - a.matchedAt);

  return (
    <>
      <View style={styles.matchHero}>
        <View style={styles.matchHeroIcon}><Ionicons name="radio-outline" size={28} color={FateDropColors.goldBright} /></View>
        <Text style={styles.matchHeroEyebrow}>YOUR LIVE HUNTS</Text>
        <Text style={styles.matchHeroTitle}>Wait for the deal you actually want.</Text>
        <Text style={styles.matchHeroCopy}>FateMatch watches in FateDrop Cloud. A hunt stays here while it is waiting and becomes LIVE NOW when stock and price satisfy your rules.</Text>
        <Pressable onPress={() => router.push('/fate-match')} style={styles.createMatch}>
          <Ionicons name="add" size={17} color={FateDropColors.ink} />
          <Text style={styles.createMatchText}>NEW FATEMATCH</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionEyebrowGold}>WATCHING</Text>
          <Text style={styles.sectionTitle}>Waiting for a match</Text>
        </View>
        <Text style={styles.countText}>{hunts.length}</Text>
      </View>

      {hunts.length ? hunts.map((hunt) => {
        const query = String(hunt.query || hunt.queryText || 'FateMatch');
        const maxPercent = typeof hunt.maxPercentAboveRrp === 'number' ? hunt.maxPercentAboveRrp : null;
        const maxItem = typeof hunt.maxItemPricePence === 'number' ? pounds(hunt.maxItemPricePence) : null;
        const maxTrue = typeof hunt.maxTruePricePence === 'number' ? pounds(hunt.maxTruePricePence) : null;
        return (
          <View key={hunt.id} style={styles.huntCard}>
            <View style={styles.huntPulse}><View style={styles.huntPulseDot} /></View>
            <View style={styles.flex}>
              <Text style={styles.huntTitle}>{query}</Text>
              <Text style={styles.huntMeta}>
                {maxPercent != null ? `max +${maxPercent}% vs RRP` : 'RRP threshold not shown'}
                {maxItem ? ` · item ≤ ${maxItem}` : ''}
                {maxTrue ? ` · True Price ≤ ${maxTrue}` : ''}
              </Text>
              <Text style={styles.huntCloud}>Watching in Cloud</Text>
            </View>
            <Ionicons name="cloud-done-outline" size={18} color={FateDropColors.success} />
          </View>
        );
      }) : (
        <View style={styles.emptyState}>
          <Ionicons name="radio-outline" size={24} color={FateDropColors.gold} />
          <Text style={styles.emptyTitle}>No FateMatch hunts yet</Text>
          <Text style={styles.emptyCopy}>Create one when a product is not live yet or when you only want it at a price that fits your rules.</Text>
        </View>
      )}

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionEyebrowLive}>MATCHED</Text>
          <Text style={styles.sectionTitle}>FATEMATCH — LIVE NOW</Text>
        </View>
        <Text style={styles.countText}>{matches.length}</Text>
      </View>

      {matches.length ? matches.slice(0, 20).map((match) => (
        <Pressable key={match.id} onPress={() => match.url ? void Linking.openURL(match.url) : undefined} style={styles.liveMatchCard}>
          <View style={styles.flex}>
            <Text style={styles.liveMatchLabel}>FATEMATCH — LIVE NOW</Text>
            <Text style={styles.liveMatchTitle}>{match.title}</Text>
            <Text style={styles.liveMatchRetailer}>{match.retailerName} · {match.stockStatus}</Text>
            <View style={styles.matchMetrics}>
              <MatchMetric label="ITEM" value={pounds(match.itemPricePence) ?? 'Unknown'} />
              <MatchMetric label="RRP" value={pounds(match.rrpPence) ?? '—'} />
              <MatchMetric label="TRUE PRICE" value={pounds(match.deliveredPricePence) ?? 'Delivery unknown'} />
            </View>
            {match.percentAboveRrp != null ? (
              <Text style={[styles.matchDelta, { color: match.percentAboveRrp <= 0 ? FateDropColors.success : FateDropColors.warning }]}>
                {percentText(match.percentAboveRrp)}
              </Text>
            ) : null}
            <Text style={styles.liveMatchTime}>Matched {ago(match.matchedAt)}</Text>
          </View>
          <Ionicons name="bag-handle-outline" size={20} color={FateDropColors.manifested} />
        </Pressable>
      )) : (
        <View style={styles.emptyState}>
          <Ionicons name="hourglass-outline" size={24} color={FateDropColors.secondary} />
          <Text style={styles.emptyTitle}>Nothing has qualified yet</Text>
          <Text style={styles.emptyCopy}>When one of your hunts meets its stock and price rules, the live result will appear here.</Text>
        </View>
      )}
    </>
  );
}

function AlertCard({ alert }: { alert: CanonicalMobileAlert }) {
  const meta = stageMeta[alert.fateStage];
  const itemPrice = pounds(alert.product.pricePence);
  const rrp = pounds(alert.priceIntelligence.rrpPence ?? alert.product.rrpPence);
  const truePrice = pounds(alert.product.deliveredPricePence);
  const delta = percentText(alert.priceIntelligence.rrpDeltaPercent);
  const buyNow = alert.fateStage === 'MANIFESTED' && Boolean(alert.productUrl);

  return (
    <Pressable onPress={() => alert.productUrl ? void Linking.openURL(alert.productUrl) : undefined} style={({ pressed }) => [styles.alertCard, { borderColor: `${meta.color}38` }, pressed && styles.pressed]}>
      <View style={styles.alertTop}>
        {alert.product.imageUrl ? (
          <Image source={{ uri: alert.product.imageUrl }} style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={[styles.productFallback, { borderColor: `${meta.color}44` }]}>
            <Ionicons name="cube-outline" size={24} color={meta.color} />
          </View>
        )}

        <View style={styles.alertTopCopy}>
          <View style={styles.alertMetaRow}>
            <Text style={[styles.stageLabel, { color: meta.color }]}>{meta.companion.toUpperCase()} · {meta.label.toUpperCase()}</Text>
            <Text style={styles.time}>{ago(alert.detectedAt)}</Text>
          </View>
          <Text style={styles.alertTitle} numberOfLines={2}>{alert.product.title || alert.title}</Text>
          <Text style={styles.retailer}>{alert.retailer}</Text>
        </View>
      </View>

      <View style={styles.priceGrid}>
        <MatchMetric label="ITEM" value={itemPrice ?? 'Unknown'} />
        <MatchMetric label="RRP / REF" value={rrp ?? 'Unavailable'} />
        <MatchMetric label="TRUE PRICE" value={truePrice ?? 'Delivery unknown'} />
      </View>

      {delta ? <Text style={[styles.deltaText, { color: meta.color }]}>{delta}</Text> : null}
      <Text style={styles.reason}>{alert.message}</Text>

      <View style={styles.alertFooter}>
        <Text style={styles.inspectText}>{buyNow ? 'BUY NOW' : 'INSPECT'}</Text>
        <Ionicons name={buyNow ? 'bag-handle-outline' : 'arrow-forward'} size={14} color={FateDropColors.ivory} />
      </View>
    </Pressable>
  );
}

function MatchMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.priceMetric}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{value}</Text>
    </View>
  );
}

function SignInState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="lock-closed-outline" size={24} color={FateDropColors.gold} />
      <Text style={styles.emptyTitle}>Sign in to FateDrop ID</Text>
      <Text style={styles.emptyCopy}>Your canonical alert history and FateMatch hunts follow your account across FateDrop.</Text>
      <Pressable onPress={() => router.push('/account')} style={styles.signInButton}>
        <Text style={styles.signInText}>SIGN IN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  headerButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  viewSwitch: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, marginBottom: 10 },
  viewOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  viewOptionActive: { backgroundColor: `${FateDropColors.gold}12`, borderWidth: 1, borderColor: `${FateDropColors.gold}45` },
  viewOptionText: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  viewOptionTextActive: { color: FateDropColors.goldBright },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tab: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  tabLabel: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.35 },
  tabCount: { color: FateDropColors.secondary, fontSize: 13, fontWeight: '900', marginTop: 2 },
  hero: { height: 265, borderRadius: 24, overflow: 'hidden', borderWidth: 1, backgroundColor: FateDropColors.card, marginBottom: 20 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,10,.46)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  companionPill: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingRight: 11, paddingLeft: 5, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}44`, backgroundColor: 'rgba(8,14,20,.72)' },
  companionThumb: { width: 34, height: 34, borderRadius: 17 },
  companionStage: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  companionRole: { color: FateDropColors.secondary, fontSize: 11, marginTop: 1 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 27, lineHeight: 30, fontWeight: '700', marginTop: 10 },
  heroCopy: { color: FateDropColors.ivory, fontSize: 13, lineHeight: 18, marginTop: 5, maxWidth: 335 },
  matchHero: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 18 },
  matchHeroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0E`, borderWidth: 1, borderColor: `${FateDropColors.gold}35`, marginBottom: 12 },
  matchHeroEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  matchHeroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 26, lineHeight: 29, fontWeight: '700', marginTop: 5 },
  matchHeroCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  createMatch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: FateDropColors.goldBright },
  createMatchText: { color: FateDropColors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, marginTop: 4 },
  sectionEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionEyebrowGold: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionEyebrowLive: { color: FateDropColors.manifested, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: FateDropTypography.sectionTitle, fontWeight: '700', marginTop: 3 },
  sectionAction: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900' },
  countText: { color: FateDropColors.goldBright, fontSize: 18, fontWeight: '900' },
  alertList: { gap: 10 },
  alertCard: { padding: 14, borderRadius: 18, borderWidth: 1, backgroundColor: FateDropColors.surface },
  alertTop: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  productImage: { width: 68, height: 68, borderRadius: 12, backgroundColor: FateDropColors.card },
  productFallback: { width: 68, height: 68, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: FateDropColors.card },
  alertTopCopy: { flex: 1 },
  alertMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stageLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.75 },
  time: { color: FateDropColors.muted, fontSize: 11 },
  alertTitle: { color: FateDropColors.ivory, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 4 },
  retailer: { color: FateDropColors.secondary, fontSize: 12, fontWeight: '800', marginTop: 5 },
  priceGrid: { flexDirection: 'row', gap: 7, marginTop: 13 },
  priceMetric: { flex: 1, minHeight: 58, padding: 9, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  priceLabel: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  priceValue: { color: FateDropColors.ivory, fontSize: 12, lineHeight: 15, fontWeight: '900', marginTop: 4 },
  deltaText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 9 },
  reason: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  alertFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: FateDropColors.borderSoft, marginTop: 12, paddingTop: 11 },
  inspectText: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  huntCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, marginBottom: 8 },
  huntPulse: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}50`, backgroundColor: `${FateDropColors.gold}0C` },
  huntPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: FateDropColors.success },
  huntTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  huntMeta: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  huntCloud: { color: FateDropColors.success, fontSize: 10, fontWeight: '800', marginTop: 5 },
  liveMatchCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.manifested}48`, backgroundColor: FateDropColors.surface, marginBottom: 9 },
  liveMatchLabel: { color: FateDropColors.manifested, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  liveMatchTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900', marginTop: 4 },
  liveMatchRetailer: { color: FateDropColors.secondary, fontSize: 12, marginTop: 3 },
  matchMetrics: { flexDirection: 'row', gap: 7, marginTop: 10 },
  matchDelta: { fontSize: 10, fontWeight: '900', marginTop: 8 },
  liveMatchTime: { color: FateDropColors.muted, fontSize: 10, marginTop: 5 },
  emptyState: { alignItems: 'center', padding: 26, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  emptyCompanion: { width: 62, height: 62, borderRadius: 18 },
  emptyTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900', marginTop: 10 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 310 },
  signInButton: { marginTop: 15, borderWidth: 1, borderColor: FateDropColors.gold, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: `${FateDropColors.gold}16` },
  signInText: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, marginBottom: 10, borderRadius: 15, borderWidth: 1, borderColor: `${FateDropColors.warning}50`, backgroundColor: `${FateDropColors.warning}0C` },
  errorTitle: { color: FateDropColors.warning, fontSize: 13, fontWeight: '900' },
  errorCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  flex: { flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
