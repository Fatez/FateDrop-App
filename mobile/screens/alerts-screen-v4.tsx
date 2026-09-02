import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { countCanonicalAlertBasisByStage } from '@/lib/canonical-alert-counts';
import { FALLBACK_ALERT_MARKETS } from '@/services/alert-facets';
import { countUnreadCanonicalAlertsByStage, markCanonicalAlertStageSeen, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';
import {
  EARLIER_ALERT_PAGE_SIZE,
  INITIAL_ALERT_LIMITS,
  invalidateCanonicalAlertQueries,
  peekCanonicalAlertPage,
  peekCanonicalAlertReadBasis,
  queryCanonicalAlertPage,
  queryCanonicalAlertReadBasis,
  type CanonicalAlertCursor,
  type CanonicalAlertQuery,
  type CanonicalAlertReadBasisItem,
  type CanonicalAlertReadBasisQuery,
} from '@/services/canonical-alert-query';
import { updateRemoteNotificationPreferences } from '@/services/fatedrop-id';
import {
  LIFECYCLE_MARKET_GROUPS,
  nextLifecycleMarketSelection,
  type LifecycleMarketGroup,
  type LifecycleMarketStage,
  type LifecycleMarketSelection,
} from '@/services/notification-preference-contract';
import { openExternalRetailerLink, openTrackedRetailerLink } from '@/services/outbound-links';

const stages: CanonicalAlertStage[] = ['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'];
type AlertView = 'signals' | 'matches';
const meta: Record<CanonicalAlertStage, { label: string; companion: string; color: string; hero: number }> = {
  WHISPER: { label: 'Whisper', companion: 'Oru', color: FateDropColors.whisper, hero: require('../assets/images/alert-oru-hero-final.webp') },
  ECHO: { label: 'Echo', companion: 'Fenn', color: FateDropColors.echo, hero: require('../assets/images/alert-fenn-hero-final.webp') },
  MANIFESTED: { label: 'Manifested', companion: 'Koru', color: FateDropColors.manifested, hero: require('../assets/images/alert-koru-hero-final.webp') },
  VANISHED: { label: 'Vanished', companion: 'Nyxen', color: FateDropColors.vanished, hero: require('../assets/images/alert-nyxen-hero-final.webp') },
};
const stagePreferenceKey: Record<CanonicalAlertStage, LifecycleMarketStage> = {
  WHISPER: 'whisper',
  ECHO: 'echo',
  MANIFESTED: 'manifested',
  VANISHED: 'vanished',
};
const marketLabels = new Map(FALLBACK_ALERT_MARKETS.map(({ key, label }) => [key, label]));
const lifecycleMarketOptions = LIFECYCLE_MARKET_GROUPS.map((key) => ({ key, label: marketLabels.get(key) ?? key }));
const emptyUnreadCounts = (): Record<CanonicalAlertStage, number> => ({ WHISPER: 0, ECHO: 0, MANIFESTED: 0, VANISHED: 0 });
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
function facetLine(alert: CanonicalMobileAlert) { const language = alert.facets?.languageLabel || 'Unknown language'; const set = alert.facets?.setName || 'Unknown set'; return `${language} · ${set}`; }

export default function AlertsScreenV4() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ stage?: string | string[]; view?: string | string[]; tcg?: string | string[] }>();
  const { signedIn, snapshot, refresh } = useFateDropId();
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [alertReadBasis, setAlertReadBasis] = useState<CanonicalAlertReadBasisItem[]>([]);
  const [nextCursor, setNextCursor] = useState<CanonicalAlertCursor | null>(null);
  const [stage, setStage] = useState<CanonicalAlertStage>('ECHO');
  const [view, setView] = useState<AlertView>('signals');
  const [tcgFilter,setTcgFilter]=useState<'all'|TcgCode>('all');
  const [unreadCounts, setUnreadCounts] = useState<Record<CanonicalAlertStage, number>>(emptyUnreadCounts);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketWorking, setMarketWorking] = useState<string | null>(null);
  const [marketMessage, setMarketMessage] = useState<string | null>(null);
  const pageRequestGeneration = useRef(0);
  const readBasisRequestGeneration = useRef(0);
  const userId = snapshot?.user?.id ?? null;
  const preferences = snapshot?.notificationPreferences ?? null;
  const activePreferenceStage = stagePreferenceKey[stage];
  const marketSelection = preferences?.lifecycleMarkets?.[activePreferenceStage] ?? 'all';
  const selectedTcgs = useMemo<TcgCode[]>(() => snapshot?.tcgPreferences?.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences?.selectedTcgCodes]);
  const alertFilterKey = useMemo(() => JSON.stringify({
    notificationUpdatedAt: snapshot?.notificationPreferences?.updatedAt ?? 0,
    tcgAlertPreferences: snapshot?.tcgPreferences?.alertPreferences ?? null,
  }), [snapshot?.notificationPreferences?.updatedAt, snapshot?.tcgPreferences?.alertPreferences]);
  const pageQuery = useMemo<CanonicalAlertQuery | null>(() => userId ? ({
    accountId: userId,
    stage,
    selectedTcgCodes: selectedTcgs,
    filterKey: alertFilterKey,
    limit: INITIAL_ALERT_LIMITS[stage],
    cursor: null,
  }) : null, [alertFilterKey, selectedTcgs, stage, userId]);
  const readBasisQuery = useMemo<CanonicalAlertReadBasisQuery | null>(() => userId ? ({
    accountId: userId,
    selectedTcgCodes: selectedTcgs,
    filterKey: alertFilterKey,
  }) : null, [alertFilterKey, selectedTcgs, userId]);
  const counts = useMemo(() => countCanonicalAlertBasisByStage(alertReadBasis, tcgFilter), [alertReadBasis, tcgFilter]);
  const filtered = useMemo(() => alerts.filter((alert) => alert.fateStage === stage && isTcgCode(alert.tcgCode) && selectedTcgs.includes(alert.tcgCode) && (tcgFilter === 'all' || alert.tcgCode === tcgFilter)), [alerts, selectedTcgs, stage, tcgFilter]);
  const initialVisibleAlerts = useMemo(() => filtered.slice(0, INITIAL_ALERT_LIMITS[stage]), [filtered, stage]);

  useEffect(() => {
    const incomingStage = first(params.stage)?.toUpperCase();
    const incomingView = first(params.view)?.toLowerCase();
    const incomingTcg = first(params.tcg)?.toLowerCase();
    if (incomingStage && stages.includes(incomingStage as CanonicalAlertStage)) setStage(incomingStage as CanonicalAlertStage);
    if (incomingView === 'matches' || incomingView === 'fatematch') setView('matches');
    if (isTcgCode(incomingTcg) && selectedTcgs.includes(incomingTcg)) setTcgFilter(incomingTcg);
  }, [params.stage, params.tcg, params.view, selectedTcgs]);

  useEffect(() => {
    pageRequestGeneration.current += 1;
    setLoadingEarlier(false);
    if (!pageQuery) {
      setAlerts([]);
      setNextCursor(null);
      return;
    }
    const cached = peekCanonicalAlertPage(pageQuery);
    setAlerts(cached.data?.alerts.filter((alert) => alert.fateStage === pageQuery.stage) ?? []);
    setNextCursor(cached.data?.nextCursor ?? null);
  }, [pageQuery]);

  useEffect(() => {
    readBasisRequestGeneration.current += 1;
    if (!readBasisQuery) {
      setAlertReadBasis([]);
      setUnreadCounts(emptyUnreadCounts());
      return;
    }
    const cached = peekCanonicalAlertReadBasis(readBasisQuery);
    setAlertReadBasis(cached.data ?? []);
    if (cached.data === undefined) setUnreadCounts(emptyUnreadCounts());
  }, [readBasisQuery]);

  const updateUnreadFromBasis = useCallback(async (allowNetwork = true, force = false) => {
    const generation = readBasisRequestGeneration.current;
    if (!signedIn || !userId || !readBasisQuery) {
      setAlertReadBasis([]);
      setUnreadCounts(emptyUnreadCounts());
      return;
    }
    const cached = peekCanonicalAlertReadBasis(readBasisQuery);
    if (cached.data && generation === readBasisRequestGeneration.current) {
      setAlertReadBasis(cached.data);
      const nextUnread = await countUnreadCanonicalAlertsByStage(userId, cached.data);
      if (generation !== readBasisRequestGeneration.current) return;
      setUnreadCounts(nextUnread);
    }
    if (!allowNetwork || (!force && cached.data !== undefined && cached.fresh)) return;
    try {
      const basis = await queryCanonicalAlertReadBasis(readBasisQuery, { force });
      if (generation !== readBasisRequestGeneration.current) return;
      setAlertReadBasis(basis);
      const nextUnread = await countUnreadCanonicalAlertsByStage(userId, basis);
      if (generation !== readBasisRequestGeneration.current) return;
      setUnreadCounts(nextUnread);
    } catch {
      if (generation !== readBasisRequestGeneration.current) return;
      if (cached.data === undefined) {
        setAlertReadBasis([]);
        setUnreadCounts(emptyUnreadCounts());
      }
    }
  }, [readBasisQuery, signedIn, userId]);

  const loadSelectedStage = useCallback(async (force = false) => {
    const generation = ++pageRequestGeneration.current;
    if (!signedIn || !pageQuery) {
      setAlerts([]);
      setNextCursor(null);
      setError(null);
      return;
    }
    const cached = peekCanonicalAlertPage(pageQuery);
    if (cached.data) {
      setAlerts(cached.data.alerts.filter((alert) => alert.fateStage === pageQuery.stage));
      setNextCursor(cached.data.nextCursor);
    }
    setLoading(cached.data === undefined);
    setRefreshing(force);
    setError(null);
    try {
      const next = await queryCanonicalAlertPage(pageQuery, { force });
      if (generation !== pageRequestGeneration.current) return;
      setAlerts(next.alerts.filter((alert) => alert.fateStage === pageQuery.stage));
      setNextCursor(next.nextCursor);
    } catch (cause) {
      if (generation !== pageRequestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : 'Alert inbox unavailable.');
    } finally {
      if (generation === pageRequestGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [pageQuery, signedIn]);

  useFocusEffect(useCallback(() => {
    if (view !== 'signals') return;
    void loadSelectedStage(false);
    void updateUnreadFromBasis(true, false);
  }, [loadSelectedStage, updateUnreadFromBasis, view]));

  useEffect(() => {
    if (!signedIn || !userId || view !== 'signals') return;
    const visibleAlerts = initialVisibleAlerts;
    if (visibleAlerts.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        await markCanonicalAlertStageSeen(userId, stage, visibleAlerts);
        if (!cancelled) await updateUnreadFromBasis(false, false);
      } catch {
        // Read-state persistence is presentation UX; keep the current dot if local storage is unavailable.
      }
    })();
    return () => { cancelled = true; };
  }, [initialVisibleAlerts, signedIn, stage, updateUnreadFromBasis, userId, view]);

  const pullRefresh = useCallback(async () => {
    await Promise.all([loadSelectedStage(true), updateUnreadFromBasis(true, true)]);
  }, [loadSelectedStage, updateUnreadFromBasis]);

  const loadEarlier = useCallback(async () => {
    if (!pageQuery || !nextCursor || stage === 'MANIFESTED' || loadingEarlier) return;
    const generation = pageRequestGeneration.current;
    const requestedStage = stage;
    setLoadingEarlier(true);
    setError(null);
    try {
      const page = await queryCanonicalAlertPage({ ...pageQuery, limit: EARLIER_ALERT_PAGE_SIZE, cursor: nextCursor });
      if (generation !== pageRequestGeneration.current) return;
      setAlerts((previous) => {
        const scoped = previous.filter((alert) => alert.fateStage === requestedStage);
        const seen = new Set(scoped.map((alert) => alert.id));
        return [...scoped, ...page.alerts.filter((alert) => alert.fateStage === requestedStage && !seen.has(alert.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (generation !== pageRequestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : 'Earlier alert history is temporarily unavailable.');
    } finally {
      if (generation === pageRequestGeneration.current) setLoadingEarlier(false);
    }
  }, [loadingEarlier, nextCursor, pageQuery, stage]);

  const toggleLifecycleMarket = async (option: 'all' | LifecycleMarketGroup) => {
    if (!signedIn || !preferences || marketWorking) return;
    const nextSelection = nextLifecycleMarketSelection(marketSelection, option);
    setMarketWorking(option);
    setMarketMessage(null);
    try {
      await updateRemoteNotificationPreferences({ lifecycleMarkets: { [activePreferenceStage]: nextSelection } });
      if (userId) invalidateCanonicalAlertQueries({ accountId: userId, stage });
      await refresh();
    } catch (cause) {
      setMarketMessage(cause instanceof Error ? cause.message : 'Market preference could not be updated.');
    } finally {
      setMarketWorking(null);
    }
  };

  const active = meta[stage];
  const earlierLabel = stage === 'WHISPER' ? 'View earlier Whispers' : stage === 'ECHO' ? 'View earlier Echoes' : stage === 'VANISHED' ? 'View earlier Vanished' : null;
  const signalsData = view === 'signals' && signedIn ? filtered : [];

  const header = <>
    <View style={styles.hero}>
      <Image source={active.hero} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" />
      <Pressable onPress={() => router.push('/notification-preferences')} style={[styles.settings, { top: insets.top + 13 }]}><Ionicons name="options-outline" size={18} color={FateDropColors.ivory} /></Pressable>
      <View style={styles.heroCopy}><Text style={[styles.heroEyebrow, { color: active.color }]}>{active.companion.toUpperCase()} · {active.label.toUpperCase()}</Text><Text style={styles.heroTitle}>Signals without the noise.</Text><Text style={styles.heroSub}>Lifecycle intelligence stays separate from your personal FateFinds and FateMatches.</Text></View>
    </View>

    <View style={styles.switch}><Pressable onPress={() => setView('signals')} style={[styles.switchItem, view === 'signals' && styles.switchActive]}><Text style={[styles.switchText, view === 'signals' && styles.switchTextActive]}>SIGNALS</Text></Pressable><Pressable onPress={() => setView('matches')} style={[styles.switchItem, view === 'matches' && styles.switchActive]}><Text style={[styles.switchText, view === 'matches' && styles.switchTextActive]}>FATEMATCHES</Text></Pressable></View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tcgFilters}><Pressable onPress={()=>setTcgFilter('all')} style={[styles.tcgFilter,tcgFilter==='all'&&styles.tcgFilterActive]}><Text style={[styles.tcgFilterText,tcgFilter==='all'&&styles.tcgFilterTextActive]}>ALL</Text></Pressable>{selectedTcgs.map((code)=>{const entry=TCG_REGISTRY.find((item)=>item.code===code);if(!entry)return null;return <Pressable key={code} onPress={()=>setTcgFilter(code)} style={[styles.tcgFilter,tcgFilter===code&&{borderColor:entry.accent,backgroundColor:`${entry.accent}15`}]}><Text style={[styles.tcgFilterText,tcgFilter===code&&{color:entry.accent}]}>{entry.shortName.toUpperCase()}</Text></Pressable>;})}</ScrollView>

    {view === 'signals' ? <>
      <View style={styles.tabs}>{stages.map((value) => { const item = meta[value]; const selected = value === stage; return <Pressable key={value} onPress={() => setStage(value)} style={[styles.tab, selected && { borderColor: `${item.color}77`, backgroundColor: `${item.color}0F` }]}><View style={styles.tabLabelRow}><Text style={[styles.tabLabel, selected && { color: item.color }]}>{item.label.toUpperCase()}</Text>{signedIn && unreadCounts[value] > 0 ? <View testID={`alert-unread-dot-${value}`} style={[styles.tabUnreadDot, { backgroundColor: item.color }]} /> : null}</View><Text style={styles.tabCount}>{signedIn ? counts[value] : '—'}</Text></Pressable>; })}</View>
      {!signedIn ? <SignIn /> : <>
        <LifecycleMarketFilter
          color={active.color}
          disabled={Boolean(marketWorking)}
          label={active.label}
          onToggle={(option) => void toggleLifecycleMarket(option)}
          selection={marketSelection}
        />
        {marketMessage ? <View style={styles.marketError}><Ionicons name="warning-outline" size={15} color={FateDropColors.warning} /><Text style={styles.marketErrorText}>{marketMessage}</Text></View> : null}
        {error ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.warning} /><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.sectionHead}><View><Text style={[styles.sectionEyebrow, { color: active.color }]}>{active.companion.toUpperCase()} IS WATCHING</Text><Text style={styles.sectionTitle}>{active.label} alerts</Text><Text style={styles.sectionHint}>Tap an alert for a quick in-app look · ↗ opens in your browser.</Text></View><Text style={styles.sectionCount}>{counts[stage]}</Text></View>
      </>}
    </> : <Matches signedIn={signedIn} snapshot={snapshot} tcgFilter={tcgFilter} />}
  </>;

  return (
    <View style={styles.safe}>
      <FateDropBackground />
      <FlatList
        data={signalsData}
        keyExtractor={(alert) => alert.id}
        renderItem={({ item }) => <AlertRow alert={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={view === 'signals' && signedIn && !loading && !error ? <View style={styles.empty}><Ionicons name="radio-outline" size={24} color={active.color} /><Text style={styles.emptyTitle}>Quiet by design</Text><Text style={styles.emptyCopy}>No {active.label.toLowerCase()} alert has met FateDrop policy for your inbox. We do not fill the feed with weak signals.</Text></View> : null}
        ListFooterComponent={view === 'signals' && signedIn && earlierLabel && nextCursor ? <View style={styles.earlierWrap}><Pressable disabled={loadingEarlier} onPress={() => void loadEarlier()} style={[styles.earlierButton, loadingEarlier && styles.earlierDisabled]}><Text style={styles.earlierText}>{loadingEarlier ? 'Loading earlier…' : earlierLabel}</Text><Ionicons name="chevron-down" size={15} color={FateDropColors.goldBright} /></Pressable></View> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullRefresh()} tintColor={FateDropColors.gold} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
      />
    </View>
  );
}

function LifecycleMarketFilter({ color, disabled, label, onToggle, selection }: {
  color: string;
  disabled: boolean;
  label: string;
  onToggle: (option: 'all' | LifecycleMarketGroup) => void;
  selection: LifecycleMarketSelection;
}) {
  const status = selection === 'all' ? 'ALL MARKETS' : `${selection.length} SELECTED`;
  return <View style={[styles.marketFilter, { borderColor: `${color}42` }]}>
    <View style={styles.marketFilterHead}>
      <View style={styles.flex}>
        <Text style={[styles.marketFilterEyebrow, { color }]}>CARD MARKET · {label.toUpperCase()}</Text>
        <Text style={styles.marketFilterHint}>Choose which verified product markets can appear in this {label.toLowerCase()} feed.</Text>
      </View>
      <Text style={styles.marketFilterStatus}>{status}</Text>
    </View>
    <View style={styles.marketPills}>
      <MarketPill color={color} disabled={disabled} enabled={selection === 'all'} onPress={() => onToggle('all')} title="All" />
      {lifecycleMarketOptions.map((market) => <MarketPill
        key={market.key}
        color={color}
        disabled={disabled}
        enabled={selection !== 'all' && selection.includes(market.key)}
        onPress={() => onToggle(market.key)}
        title={market.label}
      />)}
    </View>
  </View>;
}

function MarketPill({ color, disabled, enabled, onPress, title }: { color: string; disabled: boolean; enabled: boolean; onPress: () => void; title: string }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled, selected: enabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.marketPill, enabled && { borderColor: `${color}A6`, backgroundColor: `${color}16` }, disabled && styles.marketPillDisabled]}
  >
    <View style={[styles.marketPillDot, { borderColor: enabled ? color : FateDropColors.border, backgroundColor: enabled ? color : 'transparent' }]} />
    <Text style={[styles.marketPillText, enabled && { color }]}>{title}</Text>
  </Pressable>;
}

function AlertRow({ alert }: { alert: CanonicalMobileAlert }) {
  if (alert.signalKind === 'operator_readiness') return <OperatorEchoRow alert={alert} />;

  const item = meta[alert.fateStage];
  const reference = referenceLine(alert);
  const confidence = confidenceLabel(alert.confidence);
  const truePrice = alert.product?.deliveredPricePence == null ? null : money(alert.product.deliveredPricePence);
  const retailerId = alert.retailerId || alert.retailer || 'unknown-retailer';
  const openInApp = () => {
    if (!alert.productUrl) return;
    void openTrackedRetailerLink({ destinationUrl: alert.productUrl, retailerId, placement: 'lifecycle-alert' }).catch(() => undefined);
  };
  const openExternal = () => {
    if (!alert.productUrl) return;
    void openExternalRetailerLink({ destinationUrl: alert.productUrl, retailerId, placement: 'lifecycle-alert-external' }).catch(() => undefined);
  };

  return <View style={styles.alertRow}>
    <Pressable onPress={openInApp} style={styles.alertBody}>
      <View style={[styles.alertDot, { backgroundColor: item.color }]} />
      <View style={styles.flex}>
        <View style={styles.alertTop}><Text style={[styles.alertStage, { color: item.color }]}>{item.companion.toUpperCase()} · {item.label.toUpperCase()}</Text><Text style={styles.alertTime}>{ago(alert.detectedAt)}</Text></View>
        <View style={styles.alertTitleRow}><Text style={styles.alertTitle}>{alert.product?.title || alert.title}</Text><Text style={styles.tcgBadge}>{TCG_REGISTRY.find((entry)=>entry.code===alert.tcgCode)?.shortName??alert.tcgCode}</Text></View>
        <Text style={styles.alertFacets}>{facetLine(alert)}</Text>
        <Text style={styles.alertValue}>{valueLine(alert)}</Text>
        {reference ? <Text style={styles.alertReference}>{reference}</Text> : null}
        <Text style={styles.alertMeta}>{alert.retailer || 'Retailer'} · {stockLabel(alert.preparedLinks?.primary?.stockStatus)}{confidence ? ` · ${confidence}` : ''}</Text>
        {truePrice ? <Text style={styles.alertTruePrice}>True Price · {truePrice}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
    </Pressable>
    <Pressable accessibilityLabel="Open retailer in external browser" onPress={openExternal} style={styles.externalButton}>
      <Ionicons name="open-outline" size={17} color={FateDropColors.goldBright} />
    </Pressable>
  </View>;
}

function OperatorEchoRow({ alert }: { alert: CanonicalMobileAlert }) {
  const operatorMessage = alert.operatorIntelligence?.expectedLabel || alert.message;
  const retailerId = alert.retailerId || 'fatedrop-intelligence';
  const openLink = () => {
    if (!alert.productUrl) return;
    void openTrackedRetailerLink({ destinationUrl: alert.productUrl, retailerId, placement: 'global-operator-echo' }).catch(() => undefined);
  };

  return <View style={styles.operatorEcho}>
    <View style={styles.operatorEchoTop}>
      <View style={styles.operatorEchoIcon}><Ionicons name="radio-outline" size={18} color={FateDropColors.cyan} /></View>
      <View style={styles.flex}>
        <Text style={styles.operatorEchoEyebrow}>BIG FATE SIGNAL · ECHO</Text>
        <Text style={styles.operatorEchoTitle}>{alert.product?.title || alert.title}</Text>
      </View>
    </View>
    <Text style={styles.operatorEchoMessage}>{operatorMessage}</Text>
    <View style={styles.operatorEchoTruth}><Text style={styles.operatorEchoTruthText}>READINESS · NOT CONFIRMED STOCK</Text></View>
    <Text style={styles.operatorEchoMeta}>{alert.retailer || 'FateDrop Intelligence'} · {ago(alert.detectedAt)}</Text>
    {alert.productUrl ? <Pressable accessibilityRole="link" accessibilityLabel="Check the linked source" onPress={openLink} style={styles.operatorEchoButton}><Text style={styles.operatorEchoButtonText}>CHECK LINK</Text><Ionicons name="open-outline" size={15} color={FateDropColors.background} /></Pressable> : null}
  </View>;
}

function Matches({ signedIn, snapshot, tcgFilter }: { signedIn: boolean; snapshot: ReturnType<typeof useFateDropId>['snapshot']; tcgFilter: 'all' | TcgCode }) {
  if (!signedIn) return <SignIn />;
  const includesTcg = (value: unknown) => tcgFilter === 'all' || value === tcgFilter;
  const tcgLabel = (value: unknown) => isTcgCode(value) ? TCG_REGISTRY.find((entry) => entry.code === value)?.shortName ?? value : 'Unknown TCG';
  const finds = (snapshot?.fateFinds ?? []).filter((item) => item.enabled !== false && includesTcg(item.tcgCode));
  const matches = [...(snapshot?.fateMatches ?? [])].filter((match) => includesTcg(match.tcgCode)).sort((a, b) => b.matchedAt - a.matchedAt);
  return <>
    <View style={styles.matchIntro}><Text style={styles.matchEyebrow}>FATEFIND → FATEMATCH</Text><Text style={styles.matchTitle}>Your hunts and what they found.</Text><Text style={styles.matchCopy}>A FateFind stays active while it searches. When an offer satisfies your conditions, that successful result becomes a FateMatch.</Text><Pressable onPress={() => router.push('/fatefind')} style={styles.newFind}><Ionicons name="add" size={17} color={FateDropColors.ink} /><Text style={styles.newFindText}>NEW FATEFIND</Text></Pressable></View>
    <View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>ACTIVE FATEFINDS</Text><Text style={styles.sectionTitle}>Still hunting</Text></View><Text style={styles.sectionCount}>{finds.length}</Text></View>
    {finds.length ? finds.map((find) => <View key={find.id} style={styles.findRow}><View style={styles.findPulse} /><View style={styles.flex}><Text style={styles.findTitle}>{String(find.query || find.queryText || 'FateFind')}</Text><Text style={styles.findMeta}>{tcgLabel(find.tcgCode)} · {companionName(find.companionId)} is searching the network</Text></View><Ionicons name="cloud-done-outline" size={18} color={FateDropColors.success} /></View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No active FateFinds</Text><Text style={styles.emptyCopy}>Start one when you want FateDrop to keep looking under your conditions.</Text></View>}
    <View style={styles.sectionHead}><View><Text style={[styles.sectionEyebrow, { color: FateDropColors.manifested }]}>FATEMATCH — LIVE NOW</Text><Text style={styles.sectionTitle}>Successful results</Text></View><Text style={styles.sectionCount}>{matches.length}</Text></View>
    {matches.length ? matches.slice(0, 20).map((match) => <Pressable key={match.id} onPress={() => match.url ? void Linking.openURL(match.url) : undefined} style={styles.matchRow}><View style={styles.flex}><Text style={styles.matchLive}>{companionName(match.companionId).toUpperCase()} FOUND THIS</Text><Text style={styles.matchProduct}>{match.title}</Text><Text style={styles.matchMeta}>{tcgLabel(match.tcgCode)} · {match.retailerName} · Item {money(match.itemPricePence)} · True Price {money(match.deliveredPricePence)}</Text><Text style={styles.matchTime}>{ago(match.matchedAt)}</Text></View><Ionicons name="bag-handle-outline" size={19} color={FateDropColors.manifested} /></Pressable>) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing has qualified yet</Text><Text style={styles.emptyCopy}>A qualifying result will appear here as a FateMatch.</Text></View>}
  </>;
}
function SignIn() { return <View style={styles.empty}><Ionicons name="person-circle-outline" size={28} color={FateDropColors.gold} /><Text style={styles.emptyTitle}>Sign in to your FateDrop ID</Text><Text style={styles.emptyCopy}>Your personal alert inbox and FateMatches sync with your account.</Text><Pressable onPress={() => router.push('/account')} style={styles.signIn}><Text style={styles.signInText}>SIGN IN</Text></Pressable></View>; }

const heroShadow = { textShadowColor: 'rgba(0,0,0,.94)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingBottom: 120 },
  hero: { height: 350, overflow: 'hidden', backgroundColor: FateDropColors.background },
  settings: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(4,7,12,.58)' },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 24 }, heroEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, ...heroShadow }, heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 28, fontWeight: '700', marginTop: 4, ...heroShadow }, heroSub: { color: FateDropColors.ivory, fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 340, ...heroShadow },
  switch: { flexDirection: 'row', marginHorizontal: 18, marginTop: 12, padding: 4, borderRadius: 14, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft }, switchItem: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 }, switchActive: { backgroundColor: FateDropColors.card }, switchText: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900' }, switchTextActive: { color: FateDropColors.goldBright },
  tcgFilters:{gap:7,paddingHorizontal:18,paddingTop:11},tcgFilter:{paddingHorizontal:11,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:FateDropColors.borderSoft,backgroundColor:FateDropColors.surface},tcgFilterActive:{borderColor:FateDropColors.gold,backgroundColor:`${FateDropColors.gold}15`},tcgFilterText:{color:FateDropColors.muted,fontSize:8,fontWeight:'900'},tcgFilterTextActive:{color:FateDropColors.goldBright},
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginTop: 10 }, tab: { flex: 1, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, tabLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' }, tabUnreadDot: { width: 6, height: 6, borderRadius: 3 }, tabCount: { color: FateDropColors.ivory, fontSize: 18, fontWeight: '900', marginTop: 3 },
  marketFilter: { marginHorizontal: 18, marginTop: 10, padding: 13, borderRadius: 16, borderWidth: 1, backgroundColor: FateDropColors.surface }, marketFilterHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, marketFilterEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: .9 }, marketFilterHint: { color: FateDropColors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, marketFilterStatus: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: .5, marginTop: 1 }, marketPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }, marketPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card }, marketPillDisabled: { opacity: .55 }, marketPillDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 }, marketPillText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '800' }, marketError: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 18, marginTop: 7 }, marketErrorText: { color: FateDropColors.warning, flex: 1, fontSize: 9, lineHeight: 13 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginHorizontal: 18, marginTop: 20, marginBottom: 8 }, sectionEyebrow: { color: FateDropColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: FateDropColors.ivory, fontSize: 19, fontWeight: '900', marginTop: 2 }, sectionHint: { color: FateDropColors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, sectionCount: { color: FateDropColors.ivory, fontSize: 19, fontWeight: '900' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 24, marginBottom: 7, padding: 7, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, alertBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6 }, alertDot: { width: 8, height: 8, borderRadius: 4 }, alertTop: { flexDirection: 'row', justifyContent: 'space-between' }, alertStage: { fontSize: 8, fontWeight: '900' }, alertTime: { color: FateDropColors.muted, fontSize: 9 }, alertTitleRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:3},alertTitle: { flex:1,color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },tcgBadge:{paddingHorizontal:6,paddingVertical:3,borderRadius:999,borderWidth:1,borderColor:FateDropColors.border,color:FateDropColors.goldBright,fontSize:7,fontWeight:'900'}, alertFacets: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '800', marginTop: 3 }, alertValue: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '800', marginTop: 5 }, alertReference: { color: FateDropColors.goldBright, fontSize: 9, marginTop: 3 }, alertMeta: { color: FateDropColors.secondary, fontSize: 9, marginTop: 4 }, alertTruePrice: { color: FateDropColors.manifested, fontSize: 9, fontWeight: '800', marginTop: 3 }, externalButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}45`, backgroundColor: FateDropColors.cardElevated },
  operatorEcho:{marginHorizontal:18,marginBottom:9,padding:16,borderRadius:18,borderWidth:1,borderColor:`${FateDropColors.cyan}55`,backgroundColor:'rgba(7,12,20,.96)'},operatorEchoTop:{flexDirection:'row',alignItems:'center',gap:10},operatorEchoIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:`${FateDropColors.cyan}14`},operatorEchoEyebrow:{color:FateDropColors.cyan,fontSize:8,fontWeight:'900',letterSpacing:1},operatorEchoTitle:{color:FateDropColors.ivory,fontSize:15,fontWeight:'900',lineHeight:20,marginTop:3},operatorEchoMessage:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:12},operatorEchoTruth:{alignSelf:'flex-start',marginTop:10,paddingHorizontal:9,paddingVertical:5,borderRadius:999,borderWidth:1,borderColor:`${FateDropColors.echo}48`,backgroundColor:`${FateDropColors.echo}18`},operatorEchoTruthText:{color:FateDropColors.echo,fontSize:8,fontWeight:'900',letterSpacing:.7},operatorEchoMeta:{color:FateDropColors.muted,fontSize:8,marginTop:9},operatorEchoButton:{minHeight:42,marginTop:12,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,backgroundColor:FateDropColors.echo},operatorEchoButtonText:{color:FateDropColors.background,fontSize:9,fontWeight:'900',letterSpacing:.6},
  error: { flexDirection: 'row', gap: 9, margin: 18, padding: 13, borderRadius: 15, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft }, errorText: { color: FateDropColors.secondary, flex: 1, fontSize: 11 },
  empty: { marginHorizontal: 18, marginTop: 10, alignItems: 'center', padding: 22, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, emptyTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 6 }, emptyCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4 }, signIn: { marginTop: 12, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 11, backgroundColor: FateDropColors.violet }, signInText: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900' },
  earlierWrap: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 }, earlierButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: FateDropColors.surface }, earlierDisabled: { opacity: .55 }, earlierText: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900' },
  matchIntro: { margin: 18, padding: 17, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: FateDropColors.surface }, matchEyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, matchTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 22, fontWeight: '700', marginTop: 4 }, matchCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 5 }, newFind: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: FateDropColors.goldBright }, newFindText: { color: FateDropColors.ink, fontSize: 10, fontWeight: '900' },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 7, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, findPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: FateDropColors.goldBright }, findTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' }, findMeta: { color: FateDropColors.secondary, fontSize: 10, marginTop: 3 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 7, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.manifested}44`, backgroundColor: FateDropColors.surface }, matchLive: { color: FateDropColors.manifested, fontSize: 8, fontWeight: '900', letterSpacing: .7 }, matchProduct: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 3 }, matchMeta: { color: FateDropColors.secondary, fontSize: 10, marginTop: 3 }, matchTime: { color: FateDropColors.muted, fontSize: 9, marginTop: 4 }, flex: { flex: 1 },
});
