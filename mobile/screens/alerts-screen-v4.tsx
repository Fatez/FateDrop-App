import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, markCanonicalAlertsSeen, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

const stages: CanonicalAlertStage[] = ['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'];
type AlertView = 'signals' | 'matches';
const meta: Record<CanonicalAlertStage, { label: string; companion: string; color: string; hero: number }> = {
  WHISPER: { label: 'Whisper', companion: 'Oru', color: FateDropColors.whisper, hero: require('../assets/images/alert-oru-hero-final.webp') },
  ECHO: { label: 'Echo', companion: 'Fenn', color: FateDropColors.echo, hero: require('../assets/images/alert-fenn-hero-final.webp') },
  MANIFESTED: { label: 'Manifested', companion: 'Koru', color: FateDropColors.manifested, hero: require('../assets/images/alert-koru-hero-final.webp') },
  VANISHED: { label: 'Vanished', companion: 'Nyxen', color: FateDropColors.vanished, hero: require('../assets/images/alert-nyxen-hero-final.webp') },
};
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(pence / 100).toFixed(2)}`;
function ago(value: string | number) { const ms = typeof value === 'number' ? value * (value < 10_000_000_000 ? 1000 : 1) : new Date(value).getTime(); const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000)); return mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`; }
function companionName(value: unknown) { return value === 'fenn' ? 'Fenn' : value === 'oru' ? 'Oru' : value === 'nyxen' ? 'Nyxen' : 'Koru'; }
function stockLabel(value: string | null | undefined) { const key = String(value || '').toLowerCase(); if (key === 'in_stock') return 'In stock'; if (key === 'low_stock') return 'Low stock'; if (key === 'preorder') return 'Pre-order'; if (key === 'coming_soon') return 'Coming soon'; if (key === 'out_of_stock') return 'Out of stock'; return key ? key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) : 'Observed'; }
function confidenceLabel(value: number | null | undefined) { if (!Number.isFinite(value)) return null; const score = Math.max(0, Math.min(1, Number(value))); const band = score >= .85 ? 'High' : score >= .65 ? 'Moderate' : 'Developing'; return `${band} · ${Math.round(score * 100)}%`; }
function referenceLabel(alert: CanonicalMobileAlert) { const kind = alert.presentation?.referenceKind; const market = String(alert.presentation?.sourceMarket || '').toUpperCase(); if (kind === 'source_market_msrp') return market ? `Official ${market} MSRP` : 'Official source-market MSRP'; if (kind === 'source_market_component_reference') return market ? `${market} MSRP reference` : 'Source-market MSRP reference'; if (kind === 'component_reference') return 'Component RRP reference'; if (kind === 'pack_reference') return 'Pack RRP reference'; if (kind === 'official') return 'Verified RRP'; return 'Verified reference'; }
function nativeMsrpLabel(alert: CanonicalMobileAlert) { const amount = alert.presentation?.sourceMsrp; const currency = alert.presentation?.sourceCurrency; if (!amount || !currency) return null; const symbol = currency === 'JPY' ? '¥' : currency === 'KRW' ? '₩' : currency === 'CNY' ? 'CN¥' : currency === 'TWD' ? 'NT$' : currency === 'HKD' ? 'HK$' : `${currency} `; return `${symbol}${amount}`; }
function valueLine(alert: CanonicalMobileAlert) { const price = money(alert.product?.pricePence); const reference = alert.priceIntelligence?.rrpPence; const delta = alert.priceIntelligence?.rrpDeltaPercent; if (reference == null || delta == null) return `${price} · Reference not yet verified`; return `${price} · ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs ${referenceLabel(alert)}`; }
function referenceLine(alert: CanonicalMobileAlert) { const reference = alert.priceIntelligence?.rrpPence; if (reference == null) return null; const native = nativeMsrpLabel(alert); if (native) return `${referenceLabel(alert)} · ${native} · GBP ref ${money(reference)}`; return `${referenceLabel(alert)} · ${money(reference)}`; }

export default function AlertsScreenV4() {
  const insets = useSafeAreaInsets();
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
    if (incomingView === 'matches' || incomingView === 'fatematch') setView('matches');
  }, [params.stage, params.view]);

  const load = useCallback(async () => {
    if (!signedIn) { setAlerts([]); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const [next] = await Promise.all([fetchCanonicalAlerts(100), refresh()]);
      setAlerts(next);
      const userId = snapshot?.user?.id;
      if (userId) await markCanonicalAlertsSeen(userId, next);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Alert inbox unavailable.'); }
    finally { setLoading(false); }
  }, [refresh, signedIn, snapshot?.user?.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => Object.fromEntries(stages.map((value) => [value, alerts.filter((alert) => alert.fateStage === value).length])) as Record<CanonicalAlertStage, number>, [alerts]);
  const filtered = useMemo(() => alerts.filter((alert) => alert.fateStage === stage), [alerts, stage]);
  const active = meta[stage];

  return (
    <View style={styles.safe}>
      <FateDropBackground />
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.gold} />} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={active.hero} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" />
          <Image source={require('../assets/images/fatedrop-wordmark.png')} style={[styles.wordmark, { top: insets.top + 8 }]} contentFit="contain" contentPosition="left center" />
          <Pressable onPress={() => router.push('/notification-preferences')} style={[styles.settings, { top: insets.top + 13 }]}><Ionicons name="options-outline" size={18} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.heroCopy}><Text style={[styles.heroEyebrow, { color: active.color }]}>{active.companion.toUpperCase()} · {active.label.toUpperCase()}</Text><Text style={styles.heroTitle}>Signals without the noise.</Text><Text style={styles.heroSub}>Lifecycle intelligence stays separate from your personal FateFinds and FateMatches.</Text></View>
        </View>

        <View style={styles.switch}><Pressable onPress={() => setView('signals')} style={[styles.switchItem, view === 'signals' && styles.switchActive]}><Text style={[styles.switchText, view === 'signals' && styles.switchTextActive]}>SIGNALS</Text></Pressable><Pressable onPress={() => setView('matches')} style={[styles.switchItem, view === 'matches' && styles.switchActive]}><Text style={[styles.switchText, view === 'matches' && styles.switchTextActive]}>FATEMATCHES</Text></Pressable></View>

        {view === 'signals' ? <>
          <View style={styles.tabs}>{stages.map((value) => { const item = meta[value]; const selected = value === stage; return <Pressable key={value} onPress={() => setStage(value)} style={[styles.tab, selected && { borderColor: `${item.color}77`, backgroundColor: `${item.color}0F` }]}><Text style={[styles.tabLabel, selected && { color: item.color }]}>{item.label.toUpperCase()}</Text><Text style={styles.tabCount}>{signedIn ? counts[value] : '—'}</Text></Pressable>; })}</View>
          {!signedIn ? <SignIn /> : <>
            {error ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.warning} /><Text style={styles.errorText}>{error}</Text></View> : null}
            <View style={styles.sectionHead}><View><Text style={[styles.sectionEyebrow, { color: active.color }]}>{active.companion.toUpperCase()} IS WATCHING</Text><Text style={styles.sectionTitle}>{active.label} alerts</Text></View><Text style={styles.sectionCount}>{filtered.length}</Text></View>
            {filtered.length ? filtered.map((alert) => <AlertRow key={alert.id} alert={alert} />) : !loading && !error ? <View style={styles.empty}><Ionicons name="radio-outline" size={24} color={active.color} /><Text style={styles.emptyTitle}>Quiet by design</Text><Text style={styles.emptyCopy}>No {active.label.toLowerCase()} alert has met FateDrop policy for your inbox. We do not fill the feed with weak signals.</Text></View> : null}
          </>}
        </> : <Matches signedIn={signedIn} snapshot={snapshot} />}
      </ScrollView>
    </View>
  );
}

function AlertRow({ alert }: { alert: CanonicalMobileAlert }) {
  const item = meta[alert.fateStage];
  const reference = referenceLine(alert);
  const confidence = confidenceLabel(alert.confidence);
  const truePrice = alert.product?.deliveredPricePence == null ? null : money(alert.product.deliveredPricePence);
  return <Pressable onPress={() => alert.productUrl ? void Linking.openURL(alert.productUrl) : undefined} style={styles.alertRow}>
    <View style={[styles.alertDot, { backgroundColor: item.color }]} />
    <View style={styles.flex}>
      <View style={styles.alertTop}><Text style={[styles.alertStage, { color: item.color }]}>{item.companion.toUpperCase()} · {item.label.toUpperCase()}</Text><Text style={styles.alertTime}>{ago(alert.detectedAt)}</Text></View>
      <Text style={styles.alertTitle}>{alert.product?.title || alert.title}</Text>
      <Text style={styles.alertValue}>{valueLine(alert)}</Text>
      {reference ? <Text style={styles.alertReference}>{reference}</Text> : null}
      <Text style={styles.alertMeta}>{alert.retailer || 'Retailer'} · {stockLabel(alert.preparedLinks?.primary?.stockStatus)}{confidence ? ` · ${confidence}` : ''}</Text>
      {truePrice ? <Text style={styles.alertTruePrice}>True Price · {truePrice}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
  </Pressable>;
}

function Matches({ signedIn, snapshot }: { signedIn: boolean; snapshot: ReturnType<typeof useFateDropId>['snapshot'] }) {
  if (!signedIn) return <SignIn />;
  const finds = (snapshot?.fateFinds ?? []).filter((item) => item.enabled !== false);
  const matches = [...(snapshot?.fateMatches ?? [])].sort((a, b) => b.matchedAt - a.matchedAt);
  return <>
    <View style={styles.matchIntro}><Text style={styles.matchEyebrow}>FATEFIND → FATEMATCH</Text><Text style={styles.matchTitle}>Your hunts and what they found.</Text><Text style={styles.matchCopy}>A FateFind stays active while it searches. When an offer satisfies your conditions, that successful result becomes a FateMatch.</Text><Pressable onPress={() => router.push('/fatefind')} style={styles.newFind}><Ionicons name="add" size={17} color={FateDropColors.ink} /><Text style={styles.newFindText}>NEW FATEFIND</Text></Pressable></View>
    <View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>ACTIVE FATEFINDS</Text><Text style={styles.sectionTitle}>Still hunting</Text></View><Text style={styles.sectionCount}>{finds.length}</Text></View>
    {finds.length ? finds.map((find) => <View key={find.id} style={styles.findRow}><View style={styles.findPulse} /><View style={styles.flex}><Text style={styles.findTitle}>{String(find.query || find.queryText || 'FateFind')}</Text><Text style={styles.findMeta}>{companionName(find.companionId)} is searching the network</Text></View><Ionicons name="cloud-done-outline" size={18} color={FateDropColors.success} /></View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No active FateFinds</Text><Text style={styles.emptyCopy}>Start one when you want FateDrop to keep looking under your conditions.</Text></View>}
    <View style={styles.sectionHead}><View><Text style={[styles.sectionEyebrow, { color: FateDropColors.manifested }]}>FATEMATCH — LIVE NOW</Text><Text style={styles.sectionTitle}>Successful results</Text></View><Text style={styles.sectionCount}>{matches.length}</Text></View>
    {matches.length ? matches.slice(0, 20).map((match) => <Pressable key={match.id} onPress={() => match.url ? void Linking.openURL(match.url) : undefined} style={styles.matchRow}><View style={styles.flex}><Text style={styles.matchLive}>{companionName(match.companionId).toUpperCase()} FOUND THIS</Text><Text style={styles.matchProduct}>{match.title}</Text><Text style={styles.matchMeta}>{match.retailerName} · Item {money(match.itemPricePence)} · True Price {money(match.deliveredPricePence)}</Text><Text style={styles.matchTime}>{ago(match.matchedAt)}</Text></View><Ionicons name="bag-handle-outline" size={19} color={FateDropColors.manifested} /></Pressable>) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing has qualified yet</Text><Text style={styles.emptyCopy}>A qualifying result will appear here as a FateMatch.</Text></View>}
  </>;
}
function SignIn() { return <View style={styles.empty}><Ionicons name="person-circle-outline" size={28} color={FateDropColors.gold} /><Text style={styles.emptyTitle}>Sign in to your FateDrop ID</Text><Text style={styles.emptyCopy}>Your personal alert inbox and FateMatches sync with your account.</Text><Pressable onPress={() => router.push('/account')} style={styles.signIn}><Text style={styles.signInText}>SIGN IN</Text></Pressable></View>; }

const heroShadow = { textShadowColor: 'rgba(0,0,0,.94)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingBottom: 120 },
  hero: { height: 350, overflow: 'hidden', backgroundColor: FateDropColors.background },
  wordmark: { position: 'absolute', left: 18, width: 150, height: 44 }, settings: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(4,7,12,.58)' },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 24 }, heroEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, ...heroShadow }, heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 28, fontWeight: '700', marginTop: 4, ...heroShadow }, heroSub: { color: FateDropColors.ivory, fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 340, ...heroShadow },
  switch: { flexDirection: 'row', marginHorizontal: 18, marginTop: 12, padding: 4, borderRadius: 14, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft }, switchItem: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 }, switchActive: { backgroundColor: FateDropColors.card }, switchText: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900' }, switchTextActive: { color: FateDropColors.goldBright },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginTop: 10 }, tab: { flex: 1, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, tabLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' }, tabCount: { color: FateDropColors.ivory, fontSize: 18, fontWeight: '900', marginTop: 3 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginHorizontal: 18, marginTop: 20, marginBottom: 8 }, sectionEyebrow: { color: FateDropColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: FateDropColors.ivory, fontSize: 19, fontWeight: '900', marginTop: 2 }, sectionCount: { color: FateDropColors.ivory, fontSize: 19, fontWeight: '900' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 7, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, alertDot: { width: 8, height: 8, borderRadius: 4 }, alertTop: { flexDirection: 'row', justifyContent: 'space-between' }, alertStage: { fontSize: 8, fontWeight: '900' }, alertTime: { color: FateDropColors.muted, fontSize: 9 }, alertTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900', marginTop: 3 }, alertValue: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '800', marginTop: 5 }, alertReference: { color: FateDropColors.goldBright, fontSize: 9, marginTop: 3 }, alertMeta: { color: FateDropColors.secondary, fontSize: 9, marginTop: 4 }, alertTruePrice: { color: FateDropColors.manifested, fontSize: 9, fontWeight: '800', marginTop: 3 },
  error: { flexDirection: 'row', gap: 9, margin: 18, padding: 13, borderRadius: 15, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft }, errorText: { color: FateDropColors.secondary, flex: 1, fontSize: 11 },
  empty: { marginHorizontal: 18, marginTop: 10, alignItems: 'center', padding: 22, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, emptyTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 6 }, emptyCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4 }, signIn: { marginTop: 12, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 11, backgroundColor: FateDropColors.violet }, signInText: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900' },
  matchIntro: { margin: 18, padding: 17, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: FateDropColors.surface }, matchEyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, matchTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 22, fontWeight: '700', marginTop: 4 }, matchCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 5 }, newFind: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: FateDropColors.goldBright }, newFindText: { color: FateDropColors.ink, fontSize: 10, fontWeight: '900' },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 7, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, findPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: FateDropColors.goldBright }, findTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' }, findMeta: { color: FateDropColors.secondary, fontSize: 10, marginTop: 3 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 7, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.manifested}44`, backgroundColor: FateDropColors.surface }, matchLive: { color: FateDropColors.manifested, fontSize: 8, fontWeight: '900', letterSpacing: .7 }, matchProduct: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 3 }, matchMeta: { color: FateDropColors.secondary, fontSize: 10, marginTop: 3 }, matchTime: { color: FateDropColors.muted, fontSize: 9, marginTop: 4 }, flex: { flex: 1 },
});