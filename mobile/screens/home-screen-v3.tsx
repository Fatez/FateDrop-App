import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomePersonalBriefing } from '@/components/home-personal-briefing';
import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import { API_BASE_URL } from '@/constants/api';
import { profileWallpaperMeta } from '@/constants/profile-customisation';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { formatEventDate } from '@/lib/encounters';
import type { HomeSignalKind } from '@/lib/home-signal-state';
import { fetchCanonicalLiveOpportunities, type CanonicalMobileAlert } from '@/services/canonical-alerts';
import { fetchFateCollectorsSummary, fetchFatePulse, type FateCollectorsSnapshot, type FatePulseDirectionPeriod, type FatePulseSnapshot } from '@/services/fate-market';
import { fetchNetworkPulse, type NetworkPulse, type NetworkSignalState } from '@/services/network-signals';
import { openExternalRetailerLink } from '@/services/outbound-links';
import { loadProfileCustomisation, type ProfileWallpaperId } from '@/services/profile-customisation';
import type { CalendarEvent } from '@/types/encounter';

const stageMeta: Record<NetworkSignalState, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  whisper: { label: 'Whisper', color: FateDropColors.whisper, icon: 'sparkles-outline' },
  echo: { label: 'Echo', color: FateDropColors.echo, icon: 'radio-outline' },
  manifested: { label: 'Manifested', color: FateDropColors.manifested, icon: 'diamond-outline' },
  vanished: { label: 'Vanished', color: FateDropColors.vanished, icon: 'moon-outline' },
};
const stageOrder: NetworkSignalState[] = ['whisper', 'echo', 'manifested', 'vanished'];
const emptyPulse: NetworkPulse = { whisper: 0, echo: 0, manifested: 0, vanished: 0 };
const HOME_EVENTS_TTL_MS = 5 * 60_000;
const LIVE_OPPORTUNITY_LIMIT = 5;
const LIVE_CARD_GAP = 12;

type LoadState = 'loading' | 'ready' | 'error';
type SheetState = { kind: 'live-details'; alert: CanonicalMobileAlert } | null;

let eventsCache: { cachedAt: number; data: CalendarEvent[] } | null = null;
let eventsFlight: Promise<CalendarEvent[]> | null = null;

async function fetchHomeEvents() {
  if (eventsCache && Date.now() - eventsCache.cachedAt < HOME_EVENTS_TTL_MS) return eventsCache.data;
  if (eventsFlight) return eventsFlight;
  const flight = fetch(`${API_BASE_URL}/api/calendar-events`)
    .then(async (response) => {
      const payload = await response.json().catch(() => null) as { events?: CalendarEvent[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || `Events HTTP ${response.status}`);
      const data = Array.isArray(payload?.events) ? payload.events : [];
      eventsCache = { cachedAt: Date.now(), data };
      return data;
    })
    .finally(() => {
      if (eventsFlight === flight) eventsFlight = null;
    });
  eventsFlight = flight;
  return flight;
}

export default function HomeScreenV3() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { snapshot, signedIn, refreshIfStale } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [pulse, setPulse] = useState<NetworkPulse>(emptyPulse);
  const [pulseState, setPulseState] = useState<LoadState>('loading');
  const [liveOpportunities, setLiveOpportunities] = useState<CanonicalMobileAlert[]>([]);
  const [liveState, setLiveState] = useState<LoadState>('loading');
  const [marketPulse, setMarketPulse] = useState<FatePulseSnapshot | null>(null);
  const [marketState, setMarketState] = useState<LoadState>('loading');
  const [collectors, setCollectors] = useState<FateCollectorsSnapshot | null>(null);
  const [collectorsState, setCollectorsState] = useState<LoadState>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsState, setEventsState] = useState<LoadState>('loading');
  const [observedNow, setObservedNow] = useState(0);
  const [homeWallpaperId, setHomeWallpaperId] = useState<ProfileWallpaperId>('koruHome');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [liveIndex, setLiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [homeSignalState, setHomeSignalState] = useState<HomeSignalKind>('loading');
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const intelligenceEntrance = useRef(new Animated.Value(0)).current;
  const lowerEntrance = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const [nextPulse, nextLive, , customisation, nextMarketPulse, nextCollectors, nextEvents] = await Promise.all([
      fetchNetworkPulse(7).then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: null })),
      signedIn
        ? fetchCanonicalLiveOpportunities(50).then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: [] as CanonicalMobileAlert[] }))
        : Promise.resolve({ ok: true as const, data: [] as CanonicalMobileAlert[] }),
      signedIn ? refreshIfStale().catch(() => null) : Promise.resolve(null),
      loadProfileCustomisation(identity).catch(() => null),
      fetchFatePulse().then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: null })),
      signedIn
        ? fetchFateCollectorsSummary().then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: null }))
        : Promise.resolve({ ok: true as const, data: null }),
      fetchHomeEvents().then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: [] as CalendarEvent[] })),
    ]);

    if (nextPulse.ok && nextPulse.data) {
      setPulse(nextPulse.data);
      setPulseState('ready');
    } else {
      setPulseState('error');
    }
    setLiveOpportunities(nextLive.data);
    setLiveState(nextLive.ok ? 'ready' : 'error');
    if (customisation) setHomeWallpaperId(customisation.wallpaperId);
    setMarketPulse(nextMarketPulse.data);
    setMarketState(nextMarketPulse.ok ? 'ready' : 'error');
    setCollectors(nextCollectors.data);
    setCollectorsState(nextCollectors.ok ? 'ready' : 'error');
    setEvents(nextEvents.data);
    setEventsState(nextEvents.ok ? 'ready' : 'error');
    setObservedNow(Date.now());
  }, [identity, refreshIfStale, signedIn]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion == null) return;
    const values = [heroEntrance, intelligenceEntrance, lowerEntrance];
    values.forEach((value) => value.stopAnimation());
    if (reduceMotion) {
      values.forEach((value) => value.setValue(1));
      return;
    }
    values.forEach((value) => value.setValue(0));
    const animation = Animated.stagger(105, values.map((value) => Animated.timing(value, {
      toValue: 1,
      duration: 460,
      useNativeDriver: true,
    })));
    animation.start();
    return () => animation.stop();
  }, [heroEntrance, intelligenceEntrance, lowerEntrance, reduceMotion]);

  const selectedTcgCodes = useMemo<TcgCode[]>(
    () => snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'],
    [snapshot?.tcgPreferences.selectedTcgCodes],
  );
  const activeFinds = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const recentMatches = useMemo(() => {
    if (!observedNow) return null;
    const floor = Math.floor(observedNow / 1000) - 7 * 86_400;
    return snapshot?.fateMatches?.filter((item) => item.matchedAt >= floor).length ?? 0;
  }, [observedNow, snapshot?.fateMatches]);
  const saved = snapshot?.wishlist?.length ?? 0;
  const wantedProductIds = useMemo(() => new Set(
    snapshot?.wishlist?.map((item) => item.productIdentityId).filter((id): id is string => Boolean(id)) ?? [],
  ), [snapshot?.wishlist]);
  const rankedLiveOpportunities = useMemo(() => rankLiveOpportunities(
    liveOpportunities,
    wantedProductIds,
    selectedTcgCodes,
  ).slice(0, LIVE_OPPORTUNITY_LIMIT), [liveOpportunities, selectedTcgCodes, wantedProductIds]);
  const wallpaperAccent = profileWallpaperMeta[homeWallpaperId].accent;
  const pulse30d = marketPulse?.pulse?.direction?.periods.d30;
  const marketPresentation = useMemo(
    () => buildMarketPresentation(pulse30d, marketState),
    [marketState, pulse30d],
  );
  const collectionPresentation = useMemo(
    () => buildCollectionPresentation(collectors, collectorsState, signedIn),
    [collectors, collectorsState, signedIn],
  );
  const featuredEvent = useMemo(
    () => chooseHomeEvent(events, selectedTcgCodes, observedNow),
    [events, observedNow, selectedTcgCodes],
  );
  const liveCardWidth = Math.min(344, Math.max(276, width - 72));
  const entranceStyle = (value: Animated.Value, distance: number) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });
  const backdropTranslate = reduceMotion
    ? 0
    : scrollY.interpolate({ inputRange: [0, 650], outputRange: [0, -14], extrapolate: 'clamp' });

  return (
    <View style={styles.safe}>
      <Animated.View pointerEvents="none" style={[styles.themeBackdrop, { transform: [{ translateY: backdropTranslate }] }]}>
        {homeWallpaperId === 'koruHome'
          ? <Image source={require('../assets/images/home-living-stage-v2.png')} style={StyleSheet.absoluteFill} cachePolicy="disk" contentFit="cover" contentPosition="top center" enforceEarlyResizing recyclingKey="home-theme:koru" />
          : <ProfileWallpaperArt wallpaperId={homeWallpaperId} home />}
        <View style={[styles.themeAccent, { backgroundColor: `${wallpaperAccent}0A` }]} />
        <View style={styles.themeContrast} />
        <View style={styles.lowerAtmosphere} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <Animated.View style={[styles.hero, entranceStyle(heroEntrance, 10)]}>
          <View style={[styles.heroBriefing, { top: insets.top + 8 }]}>
            <HomePersonalBriefing embedded liveOpportunities={liveOpportunities} liveState={liveState} onSignalStateChange={setHomeSignalState} />
          </View>
          <View style={styles.heroLifecycle}>
            <LifecycleRibbon pulse={pulse} state={pulseState} />
          </View>
        </Animated.View>

        <Animated.View style={entranceStyle(intelligenceEntrance, 14)}>
          <OrbitalIntelligenceHub
            market={marketPresentation}
            collection={collectionPresentation}
            accent={wallpaperAccent}
            signalState={homeSignalState}
            reduceMotion={Boolean(reduceMotion)}
          />
        </Animated.View>

        <Animated.View
          accessible
          accessibilityLabel="Verified live opportunities"
          accessibilityHint="Seeing one here never repeats the alarm"
          style={[styles.liveSection, entranceStyle(lowerEntrance, 16)]}
        >
          <SectionHeading
            title="VERIFIED LIVE NOW"
            action="View all"
            current={rankedLiveOpportunities.length ? liveIndex + 1 : 0}
            total={rankedLiveOpportunities.length}
            onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: 'MANIFESTED' } })}
          />
          {rankedLiveOpportunities.length ? (
            <>
              <FlatList
                data={rankedLiveOpportunities}
                horizontal
                keyExtractor={(alert) => alert.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.liveCarousel}
                ItemSeparatorComponent={() => <View style={{ width: LIVE_CARD_GAP }} />}
                renderItem={({ item }) => (
                  <LiveOpportunityCard
                    alert={item}
                    observedNow={observedNow}
                    width={liveCardWidth}
                    onDetails={() => setSheet({ kind: 'live-details', alert: item })}
                  />
                )}
                snapToInterval={liveCardWidth + LIVE_CARD_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                onMomentumScrollEnd={(event) => {
                  const next = Math.round(event.nativeEvent.contentOffset.x / (liveCardWidth + LIVE_CARD_GAP));
                  setLiveIndex(Math.max(0, Math.min(rankedLiveOpportunities.length - 1, next)));
                }}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
              />
            </>
          ) : (
            <VerifiedLiveEmpty state={liveState} signedIn={signedIn} />
          )}
        </Animated.View>

        <Animated.View style={[styles.lowerSections, entranceStyle(lowerEntrance, 18)]}>
          <PersonalLedger signedIn={signedIn} activeFinds={activeFinds} recentMatches={recentMatches} saved={saved} />
          <OrbitalCommandPortal event={featuredEvent} state={eventsState} />
        </Animated.View>
      </Animated.ScrollView>

      <HomeSheet sheet={sheet} observedNow={observedNow} onClose={() => setSheet(null)} />
    </View>
  );
}

function LifecycleRibbon({ pulse, state }: { pulse: NetworkPulse; state: LoadState }) {
  return (
    <View accessibilityLabel="Network signals · Last 7 days" style={styles.lifecycleRibbon}>
      <View pointerEvents="none" style={styles.lifecycleArcOuter} />
      <View pointerEvents="none" style={styles.lifecycleArcInner} />
      <View pointerEvents="none" style={styles.lifecycleArcCrown}><View style={styles.lifecycleArcCrownVertical} /><View style={styles.lifecycleArcCrownHorizontal} /></View>
      {stageOrder.map((stage, index) => {
        const meta = stageMeta[stage];
        return (
          <Pressable accessibilityRole="button" key={stage} onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: stage.toUpperCase() } })} style={[styles.lifecycleItem, index === stageOrder.length - 1 && styles.lifecycleItemLast, (index === 0 || index === stageOrder.length - 1) && styles.lifecycleItemOuter]}>
            <Ionicons name={meta.icon} size={11} color={meta.color} />
            <Text style={styles.lifecycleLabel}>{meta.label.toUpperCase()}</Text>
            <Text style={[styles.lifecycleValue, { color: meta.color }]}>{state === 'ready' ? pulse[stage] : '—'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type IntelligencePresentation = { value: string; detail: string; secondary: string; foot: string };

const crystalSignalMeta: Record<HomeSignalKind, {
  accent: string;
  artworkOpacity: number;
  glowOpacity: number;
  label: string;
}> = {
  loading: { accent: FateDropColors.muted, artworkOpacity: 0.62, glowOpacity: 0.05, label: 'Personal signal checking' },
  error: { accent: FateDropColors.muted, artworkOpacity: 0.55, glowOpacity: 0.03, label: 'Personal signal unavailable' },
  idle: { accent: FateDropColors.violetLight, artworkOpacity: 0.68, glowOpacity: 0.07, label: 'No personal signal requiring attention' },
  manifested: { accent: FateDropColors.manifested, artworkOpacity: 1, glowOpacity: 0.34, label: 'A wanted item is verified live' },
  echo: { accent: FateDropColors.echo, artworkOpacity: 0.96, glowOpacity: 0.27, label: 'A wanted-item Echo is unread' },
  pcuk: { accent: FateDropColors.cyan, artworkOpacity: 0.92, glowOpacity: 0.26, label: 'Pokémon Center UK activity is detected' },
  whisper: { accent: FateDropColors.whisper, artworkOpacity: 0.84, glowOpacity: 0.18, label: 'A wanted-item Whisper is unread' },
  vanished: { accent: FateDropColors.vanished, artworkOpacity: 0.62, glowOpacity: 0.13, label: 'A wanted-item Vanished update is unread' },
};

function OrbitalIntelligenceHub({ accent, collection, market, reduceMotion, signalState }: {
  accent: string;
  collection: IntelligencePresentation;
  market: IntelligencePresentation;
  reduceMotion: boolean;
  signalState: HomeSignalKind;
}) {
  const signalEnergy = useRef(new Animated.Value(0)).current;
  const signal = crystalSignalMeta[signalState];
  const active = signalState !== 'idle' && signalState !== 'loading' && signalState !== 'error';

  useEffect(() => {
    signalEnergy.stopAnimation();
    if (!active) {
      signalEnergy.setValue(0);
      return;
    }
    if (reduceMotion) {
      signalEnergy.setValue(0.42);
      return;
    }
    signalEnergy.setValue(0.12);
    const pulse = Animated.sequence([
      Animated.timing(signalEnergy, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(signalEnergy, { toValue: 0.42, duration: 760, useNativeDriver: true }),
    ]);
    pulse.start();
    return () => pulse.stop();
  }, [active, reduceMotion, signalEnergy, signalState]);

  const glowOpacity = signalEnergy.interpolate({
    inputRange: [0, 1],
    outputRange: [signal.glowOpacity, Math.min(0.68, signal.glowOpacity + 0.3)],
  });
  const crystalScale = signalEnergy.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <View style={styles.orbitalHub}>
      <View pointerEvents="none" style={styles.hubHorizon} />
      <View pointerEvents="none" style={styles.hubArc} />
      <OrbitalIntelligenceNode
        side="left"
        accent={FateDropColors.manifested}
        eyebrow="FATEPULSE"
        title="TCG MARKET"
        icon="pulse-outline"
        presentation={market}
        onPress={() => router.push({ pathname: '/(tabs)/market', params: { area: 'pulse' } })}
      />
      <View accessible accessibilityRole="image" accessibilityLabel={signal.label} style={styles.hubCrystal}>
        <Animated.View pointerEvents="none" style={[styles.hubCrystalBloom, {
          backgroundColor: signal.accent,
          opacity: glowOpacity,
          transform: [{ scale: crystalScale }],
        }]} />
        <View pointerEvents="none" style={[styles.hubCrystalOrbitOuter, { borderColor: `${signal.accent}${active ? 'B8' : '5C'}` }]} />
        <View pointerEvents="none" style={[styles.hubCrystalOrbitInner, { borderColor: `${signal.accent}${signalState === 'pcuk' ? 'C8' : '78'}` }]} />
        {signalState === 'pcuk' ? <View pointerEvents="none" style={styles.hubCrystalRadarRing} /> : null}
        <Animated.View pointerEvents="none" style={{ opacity: signal.artworkOpacity, transform: [{ scale: crystalScale }] }}>
          <Image
            source={require('../assets/images/home-orbital-crystal.png')}
            style={styles.hubCrystalArtwork}
            contentFit="contain"
            cachePolicy="memory-disk"
            enforceEarlyResizing
          />
        </Animated.View>
        <View pointerEvents="none" style={[styles.hubCrystalCore, { backgroundColor: signal.accent, opacity: active ? 0.22 : 0.08 }]} />
        <View pointerEvents="none" style={[styles.hubCrystalNeedle, { borderBottomColor: FateDropColors.goldBright }]} />
        <View pointerEvents="none" style={[styles.hubCrystalNeedle, styles.hubCrystalNeedleBottom, { borderBottomColor: FateDropColors.goldBright }]} />
      </View>
      <OrbitalIntelligenceNode
        side="right"
        accent={accent}
        eyebrow="FATE COLLECTORS"
        title="YOUR COLLECTION"
        icon="people-outline"
        presentation={collection}
        onPress={() => router.push({ pathname: '/(tabs)/market', params: { area: 'collectors' } })}
      />
    </View>
  );
}

function OrbitalIntelligenceNode({ accent, eyebrow, icon, onPress, presentation, side, title }: {
  accent: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  presentation: IntelligencePresentation;
  side: 'left' | 'right';
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.hubNode, side === 'left' ? styles.hubNodeLeft : styles.hubNodeRight, pressed && styles.pressed]}>
      <View pointerEvents="none" style={[styles.hubNodeRing, { borderColor: `${accent}60` }]} />
      <View pointerEvents="none" style={[styles.hubNodeRingInner, { borderColor: `${accent}25` }]} />
      <View style={[styles.hubNodeIcon, { borderColor: `${accent}70` }]}><Ionicons name={icon} size={18} color={accent} /></View>
      <Text style={styles.hubNodeEyebrow}>{eyebrow}</Text>
      <Text style={styles.hubNodeTitle}>{title}</Text>
      <Text style={[styles.hubNodeValue, { color: presentation.value === '—' ? FateDropColors.ivory : accent }]} numberOfLines={1} adjustsFontSizeToFit>{presentation.value}</Text>
      <Text style={styles.hubNodeDetail} numberOfLines={2}>{presentation.detail}</Text>
      {presentation.secondary ? <Text style={styles.hubNodeSecondary} numberOfLines={1}>{presentation.secondary}</Text> : null}
      <Text style={styles.hubNodeFoot} numberOfLines={1}>{presentation.foot}</Text>
    </Pressable>
  );
}

function SectionHeading({ action, current, onPress, title, total }: { action: string; current: number; onPress: () => void; title: string; total: number }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionStar}><View style={styles.sectionStarVertical} /><View style={styles.sectionStarHorizontal} /></View>
      <Text style={styles.sectionHeadingText}>{title}</Text>
      <View style={styles.sectionHeadingLine} />
      <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={styles.sectionCounter}>
        <Text style={styles.sectionCounterText}>{current} / {total}</Text>
        <View style={styles.sectionCounterDots}>
          {Array.from({ length: total }).map((_, index) => <View key={index} style={[styles.carouselDot, index === Math.max(0, current - 1) && styles.carouselDotActive]} />)}
        </View>
        <Ionicons name="chevron-forward" size={11} color={FateDropColors.goldBright} />
      </Pressable>
    </View>
  );
}

function LiveOpportunityCard({ alert, observedNow, onDetails, width }: { alert: CanonicalMobileAlert; observedNow: number; onDetails: () => void; width: number }) {
  const price = alert.product.deliveredPricePence ?? alert.product.pricePence;
  const verifiedLabel = freshnessLabel(alert, observedNow);
  const priceContext = pricingContext(alert);
  const tcg = TCG_REGISTRY.find((entry) => entry.code === alert.tcgCode)?.shortName ?? alert.tcgCode;
  const openRetailer = () => {
    if (!alert.productUrl) return;
    void openExternalRetailerLink({ destinationUrl: alert.productUrl, retailerId: alert.retailerId, placement: 'home-verified-live' }).catch(() => undefined);
  };
  return (
    <View style={[styles.liveCard, { width }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${alert.product.title || alert.title}`} onPress={onDetails} style={({ pressed }) => [styles.liveCardBody, pressed && styles.pressed]}>
        <View style={styles.liveIdentity}>
          <Text style={styles.liveGame} numberOfLines={1}>{tcg}{alert.facets.setName ? ` · ${alert.facets.setName}` : ''}</Text>
          <Text style={styles.liveTitle} numberOfLines={3}>{alert.product.title || alert.title}</Text>
          <Text style={styles.liveRetailer} numberOfLines={1}>{alert.retailer}</Text>
          <Text style={styles.liveVerified} numberOfLines={1}>{verifiedLabel}</Text>
        </View>
        <View style={styles.liveArtwork}>
          <View pointerEvents="none" style={styles.liveArtworkOrbit} />
          <View pointerEvents="none" style={styles.liveArtworkOrbitInner} />
          {alert.product.imageUrl
            ? <Image source={{ uri: alert.product.imageUrl }} style={styles.liveProductImage} cachePolicy="disk" contentFit="contain" enforceEarlyResizing recyclingKey={`live:${alert.productId}`} />
            : <Ionicons name="diamond-outline" size={48} color={FateDropColors.manifested} />}
        </View>
        <View style={styles.livePriceColumn}>
          <Text style={styles.livePrice}>{price == null ? 'Price unknown' : `£${(price / 100).toFixed(2)}`}</Text>
          <Text style={styles.livePriceContext} numberOfLines={2}>{priceContext || 'No fair price comparison'}</Text>
        </View>
      </Pressable>
      {alert.productUrl ? <Pressable accessibilityRole="link" accessibilityLabel={`Open ${alert.retailer} in your browser`} onPress={openRetailer} hitSlop={8} style={styles.liveExternal}><Ionicons name="open-outline" size={12} color={FateDropColors.goldBright} /><Text style={styles.liveExternalText}>RETAILER</Text></Pressable> : null}
    </View>
  );
}

function VerifiedLiveEmpty({ signedIn, state }: { signedIn: boolean; state: LoadState }) {
  const title = !signedIn ? 'Connect your FateDrop ID' : state === 'loading' ? 'Checking current verification' : state === 'error' ? 'Live verification is temporarily unavailable' : 'Nothing is freshly verified live right now';
  const detail = !signedIn ? 'Sign in to see verified opportunities selected for you.' : state === 'error' ? 'FateDrop will not fall back to stale stock.' : state === 'loading' ? 'Only current evidence will appear here.' : 'This space lights up only for current, verified availability.';
  return <View style={styles.liveEmpty}><Ionicons name={state === 'error' ? 'cloud-offline-outline' : 'diamond-outline'} size={20} color={state === 'error' ? FateDropColors.muted : FateDropColors.manifested} /><View style={styles.flex}><Text style={styles.liveEmptyTitle}>{title}</Text><Text style={styles.liveEmptyCopy}>{detail}</Text></View></View>;
}

function PersonalLedger({ activeFinds, recentMatches, saved, signedIn }: { activeFinds: number; recentMatches: number | null; saved: number; signedIn: boolean }) {
  const values = [
    { icon: 'telescope-outline' as const, label: 'ACTIVE FATEFINDS', value: signedIn ? String(activeFinds) : '—', onPress: () => router.push('/fate-match') },
    { icon: 'sparkles-outline' as const, label: '7D FATEMATCHES', value: signedIn && recentMatches != null ? String(recentMatches) : '—', onPress: () => router.push({ pathname: '/(tabs)/alerts', params: { view: 'matches' } }) },
    { icon: 'bookmark-outline' as const, label: 'WISHLIST', value: signedIn ? String(saved) : '—', onPress: () => router.push('/(tabs)/watchlist') },
  ];
  return (
    <View style={styles.ledgerSection}>
      <OrnamentTitle title="YOUR FATEDROP" />
      <View style={styles.ledger}>
        {values.map((item) => <Pressable key={item.label} onPress={item.onPress} style={styles.ledgerItem}><View pointerEvents="none" style={styles.ledgerOrbit} /><Ionicons name={item.icon} size={19} color={FateDropColors.goldBright} /><Text style={styles.ledgerValue}>{item.value}</Text><Text style={styles.ledgerLabel}>{item.label}</Text></Pressable>)}
      </View>
    </View>
  );
}

function OrnamentTitle({ title }: { title: string }) {
  return <View style={styles.ornamentTitle}><View style={styles.ornamentLine} /><View style={styles.ornamentDiamond} /><Text style={styles.ornamentText}>{title}</Text><View style={styles.ornamentDiamond} /><View style={styles.ornamentLine} /></View>;
}

function OrbitalCommandPortal({ event, state }: { event: CalendarEvent | null; state: LoadState }) {
  const open = () => {
    if (event) {
      router.push({ pathname: '/encounters/detail', params: { id: event.id, eventData: JSON.stringify(event) } });
      return;
    }
    router.push('/encounters');
  };
  const eventLine = event ? formatEventDate(event.startDateTime, event.endDateTime) : state === 'error' ? 'Upcoming encounters are temporarily unavailable' : state === 'loading' ? 'Finding the next relevant encounter' : 'Explore upcoming shows, trade nights and tournaments';
  return (
    <View style={styles.commandPortal}>
      <View pointerEvents="none" style={styles.commandArcOuter} />
      <View pointerEvents="none" style={styles.commandArcInner} />
      <View style={styles.orbitalActions}>
        <OrbitalAction icon="search-outline" title="Search" onPress={() => router.push('/(tabs)/search')} />
        <OrbitalAction icon="sparkles-outline" title="FateFind" onPress={() => router.push('/fatefind')} featured />
        <OrbitalAction icon="calendar-outline" title="Events" onPress={open} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={event ? `Open ${event.name}` : 'Explore Fate Encounters'} onPress={open} style={({ pressed }) => [styles.encounterPortal, pressed && styles.pressed]}>
        <Image source={require('../assets/images/event-signup.png.png')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="disk" enforceEarlyResizing />
        <View style={styles.encounterShade} />
        <View style={styles.encounterPortalCopy}>
          <Text style={styles.encounterPortalTitle}>FATE ENCOUNTERS</Text>
          <View style={styles.encounterPortalDiamond} />
          <Text style={styles.encounterPortalEvent} numberOfLines={1}>{event?.name || eventLine}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function OrbitalAction({ featured = false, icon, onPress, title }: { featured?: boolean; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; title: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.orbitalAction, featured && styles.orbitalActionFeatured, pressed && styles.pressed]}>
      <View style={[styles.orbitalActionCircle, featured && styles.orbitalActionCircleFeatured]}>
        <View pointerEvents="none" style={styles.orbitalActionRing} />
        <Ionicons name={icon} size={featured ? 22 : 21} color={featured ? FateDropColors.goldBright : FateDropColors.manifested} />
      </View>
      <Text style={styles.orbitalActionText}>{title}</Text>
    </Pressable>
  );
}

function HomeSheet({ observedNow, onClose, sheet }: { observedNow: number; onClose: () => void; sheet: SheetState }) {
  const alert = sheet?.kind === 'live-details' ? sheet.alert : null;
  const price = alert ? alert.product.deliveredPricePence ?? alert.product.pricePence : null;
  const openRetailer = () => {
    if (!alert?.productUrl) return;
    void openExternalRetailerLink({ destinationUrl: alert.productUrl, retailerId: alert.retailerId, placement: 'home-verified-live-details' }).catch(() => undefined);
  };
  return (
    <Modal visible={sheet !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.sheetBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetPanel}>
          <View style={styles.sheetHandle} />
          {alert ? <><Text style={styles.sheetEyebrow}>VERIFIED LIVE NOW</Text><Text style={styles.sheetTitle}>{alert.product.title || alert.title}</Text><Text style={styles.sheetDetail}>{alert.facets.setName || TCG_REGISTRY.find((entry) => entry.code === alert.tcgCode)?.name || alert.tcgCode}</Text><View style={styles.detailLedger}><DetailFact label="RETAILER" value={alert.retailer || 'Unknown'} /><DetailFact label="PRICE" value={price == null ? 'Unknown' : `£${(price / 100).toFixed(2)}`} /><DetailFact label="EVIDENCE" value={freshnessLabel(alert, observedNow)} /><DetailFact label="CONTEXT" value={pricingContext(alert) || 'No fair price comparison'} /></View>{alert.productUrl ? <Pressable accessibilityRole="link" onPress={openRetailer} style={styles.sheetPrimary}><Text style={styles.sheetPrimaryText}>OPEN RETAILER</Text><Ionicons name="open-outline" size={16} color={FateDropColors.ink} /></Pressable> : null}</> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailFact}><Text style={styles.detailFactLabel}>{label}</Text><Text style={styles.detailFactValue}>{value}</Text></View>;
}

function rankLiveOpportunities(alerts: CanonicalMobileAlert[], wantedProductIds: Set<string>, selectedTcgCodes: TcgCode[]) {
  return [...alerts].sort((left, right) => {
    const wantedDifference = Number(wantedProductIds.has(right.productId)) - Number(wantedProductIds.has(left.productId));
    if (wantedDifference) return wantedDifference;
    const selectedDifference = Number(isTcgCode(right.tcgCode) && selectedTcgCodes.includes(right.tcgCode)) - Number(isTcgCode(left.tcgCode) && selectedTcgCodes.includes(left.tcgCode));
    if (selectedDifference) return selectedDifference;
    return liveEvidenceTime(right) - liveEvidenceTime(left);
  });
}

function liveEvidenceTime(alert: CanonicalMobileAlert) {
  const value = alert.liveWindow?.lastConfirmedLiveAt || alert.opportunity?.lastVerifiedAt || alert.detectedAt;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function freshnessLabel(alert: CanonicalMobileAlert, observedNow: number) {
  const verifiedAt = liveEvidenceTime(alert);
  if (!verifiedAt || !observedNow) return 'Fresh confirmation';
  const ageMinutes = Math.max(0, Math.floor((observedNow - verifiedAt) / 60_000));
  if (ageMinutes < 1) return 'Verified just now';
  if (ageMinutes < 60) return `Verified ${ageMinutes}m ago`;
  const hours = Math.floor(ageMinutes / 60);
  return hours < 24 ? `Verified ${hours}h ago` : `Verified ${Math.floor(hours / 24)}d ago`;
}

function pricingContext(alert: CanonicalMobileAlert) {
  const delta = alert.priceIntelligence.rrpDeltaPercent;
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta < 0) return `${Math.abs(delta).toFixed(1)}% below RRP`;
  if (delta === 0) return 'At verified RRP';
  return `${delta.toFixed(1)}% over RRP`;
}

function buildMarketPresentation(period: FatePulseDirectionPeriod | undefined, state: LoadState) {
  if (state === 'loading') return { value: '—', detail: 'Loading market evidence', secondary: '', foot: '30D evidence window' };
  if (state === 'error') return { value: '—', detail: 'Market evidence unavailable', secondary: '', foot: 'No direction inferred' };
  if (!period || period.status !== 'available' || period.condition === 'insufficient_evidence') {
    const coverage = period?.coverage.currentPriceCoveragePct;
    return { value: '30D', detail: 'Building qualifying market evidence', secondary: '', foot: coverage == null ? 'Coverage unavailable' : `Coverage ${marketPercent(coverage)}` };
  }
  const value = period.condition === 'broadly_rising' ? 'Rising' : period.condition === 'broadly_falling' ? 'Falling' : period.condition === 'unchanged' ? 'Stable' : 'Mixed';
  return { value, detail: movementPercent(period.headlinePercent), secondary: `${period.breadth.risingSets} rising · ${period.breadth.unchangedSets} stable · ${period.breadth.fallingSets} falling`, foot: `Coverage ${marketPercent(period.coverage.currentPriceCoveragePct)}` };
}

function buildCollectionPresentation(data: FateCollectorsSnapshot | null, state: LoadState, signedIn: boolean) {
  if (!signedIn) return { value: 'Connect', detail: 'Make the market personal', secondary: '', foot: 'Import once. FateDrop does the thinking.' };
  if (state === 'loading') return { value: '—', detail: 'Loading collection evidence', secondary: '', foot: 'Value remains unknown until priced' };
  if (state === 'error' || !data) return { value: '—', detail: 'Collection evidence unavailable', secondary: '', foot: 'No value inferred' };
  const collection = data.summary.collection;
  const closestSet = data.summary.closestSet;
  const value = collection.status === 'unavailable' || collection.pricedUnits === 0 ? '—' : collectionValue(data);
  const detail = `${data.summary.cardUnits} ${data.summary.cardUnits === 1 ? 'card' : 'cards'} · ${data.summary.setsOwned} ${data.summary.setsOwned === 1 ? 'set' : 'sets'}`;
  return { value, detail, secondary: `Price coverage ${marketPercent(collection.priceCoveragePercent)}`, foot: closestSet ? `${closestSet.setName || 'Closest set'} · ${closestSet.completionPercent.toFixed(0)}%` : 'Closest set unavailable' };
}

function chooseHomeEvent(events: CalendarEvent[], selectedTcgCodes: TcgCode[], observedNow: number) {
  if (!observedNow) return null;
  const eligible = events.filter((event) => {
    const end = Date.parse(event.endDateTime || event.startDateTime);
    return Number.isFinite(end) && end >= observedNow;
  });
  return eligible.sort((left, right) => {
    const relevantDifference = Number(eventMatchesSelectedTcg(right, selectedTcgCodes)) - Number(eventMatchesSelectedTcg(left, selectedTcgCodes));
    if (relevantDifference) return relevantDifference;
    const featuredDifference = Number(Boolean(right.featured)) - Number(Boolean(left.featured));
    if (featuredDifference) return featuredDifference;
    return Date.parse(left.startDateTime) - Date.parse(right.startDateTime);
  })[0] || null;
}

function eventMatchesSelectedTcg(event: CalendarEvent, selectedTcgCodes: TcgCode[]) {
  const supported = (event.supportedTcgs || []).map((value) => value.toLowerCase());
  return selectedTcgCodes.some((code) => {
    const registry = TCG_REGISTRY.find((entry) => entry.code === code);
    return supported.some((value) => value === code || value.includes(registry?.shortName.toLowerCase() || code));
  });
}

function movementPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '30D direction unavailable';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% · 30D`;
}

function marketPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
}

function collectionValue(data: FateCollectorsSnapshot) {
  const collection = data.summary.collection;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: data.summary.currencyCode, maximumFractionDigits: 0 }).format(collection.knownValue);
  } catch {
    return `${collection.knownValue.toFixed(0)} ${data.summary.currencyCode}`;
  }
}

const heroShadow = { textShadowColor: 'rgba(0,0,0,.94)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: '#030713' },
  themeBackdrop: { ...StyleSheet.absoluteFill, top: -6, bottom: -18, backgroundColor: '#030713' },
  themeAccent: { ...StyleSheet.absoluteFill },
  themeContrast: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,14,.13)' },
  lowerAtmosphere: { position: 'absolute', left: 0, right: 0, top: '45%', bottom: 0, backgroundColor: 'rgba(2,6,16,.29)' },
  content: { paddingBottom: 92, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { height: 239, overflow: 'hidden' },
  heroBriefing: { position: 'absolute', left: 23, right: 19, zIndex: 2 },
  heroLifecycle: { position: 'absolute', left: 14, right: 14, bottom: 2, zIndex: 3 },
  lifecycleRibbon: { height: 44, flexDirection: 'row', alignItems: 'center', overflow: 'visible', backgroundColor: 'rgba(2,7,18,.12)' },
  lifecycleArcOuter: { position: 'absolute', width: '116%', height: 92, left: '-8%', top: -13, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.60)' },
  lifecycleArcInner: { position: 'absolute', width: '116%', height: 92, left: '-8%', top: -3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)' },
  lifecycleArcCrown: { position: 'absolute', left: '50%', top: -8, width: 14, height: 14, marginLeft: -7, alignItems: 'center', justifyContent: 'center' },
  lifecycleArcCrownVertical: { position: 'absolute', width: 1, height: 14, backgroundColor: FateDropColors.goldBright },
  lifecycleArcCrownHorizontal: { position: 'absolute', width: 14, height: 1, backgroundColor: FateDropColors.goldBright },
  lifecycleItem: { flex: 1, minWidth: 0, minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.18)' },
  lifecycleItemOuter: { transform: [{ translateY: 4 }] },
  lifecycleItemLast: { borderRightWidth: 0 },
  lifecycleLabel: { color: FateDropColors.secondary, fontSize: 6.3, fontWeight: '700', letterSpacing: .46 },
  lifecycleValue: { fontFamily: Fonts.serif, fontSize: 16, lineHeight: 19 },
  orbitalHub: { height: 175, marginTop: -1, overflow: 'visible' },
  hubHorizon: { position: 'absolute', left: 7, right: 7, top: 86, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.35)' },
  hubArc: { position: 'absolute', width: '88%', height: 170, left: '6%', top: -2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  hubNode: { position: 'absolute', width: 132, height: 132, top: 21, borderRadius: 66, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, zIndex: 2 },
  hubNodeLeft: { left: -2 },
  hubNodeRight: { right: -2 },
  hubNodeRing: { ...StyleSheet.absoluteFill, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  hubNodeRingInner: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: StyleSheet.hairlineWidth },
  hubNodeIcon: { width: 25, height: 25, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,7,18,.32)' },
  hubNodeEyebrow: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 8.2, letterSpacing: 1.1, marginTop: 4 },
  hubNodeTitle: { color: 'rgba(242,233,218,.64)', fontSize: 6.2, fontWeight: '700', letterSpacing: .72, marginTop: 1 },
  hubNodeValue: { fontFamily: Fonts.serif, fontSize: 20, lineHeight: 22, marginTop: 2, ...heroShadow },
  hubNodeDetail: { color: FateDropColors.secondary, fontSize: 7.1, lineHeight: 9, textAlign: 'center', maxWidth: 102 },
  hubNodeSecondary: { color: 'rgba(242,233,218,.57)', fontSize: 5.8, lineHeight: 8, textAlign: 'center', marginTop: 2 },
  hubNodeFoot: { color: 'rgba(242,233,218,.44)', fontSize: 5.8, lineHeight: 8, textAlign: 'center', marginTop: 1 },
  hubCrystal: { position: 'absolute', left: '50%', top: -3, width: 176, height: 178, marginLeft: -88, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  hubCrystalBloom: { position: 'absolute', width: 116, height: 116, borderRadius: 58 },
  hubCrystalOrbitOuter: { position: 'absolute', width: 164, height: 164, borderRadius: 82, borderWidth: 1, borderColor: 'rgba(226,197,141,.62)' },
  hubCrystalOrbitInner: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.60)' },
  hubCrystalRadarRing: { position: 'absolute', width: 174, height: 174, borderRadius: 87, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(99,225,255,.72)', transform: [{ scaleX: 1.08 }] },
  hubCrystalArtwork: { width: 160, height: 160 },
  hubCrystalCore: { position: 'absolute', width: 19, height: 34, borderRadius: 10 },
  hubCrystalNeedle: { position: 'absolute', top: -2, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 17, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  hubCrystalNeedleBottom: { top: undefined, bottom: -2, transform: [{ rotate: '180deg' }] },
  liveSection: { minHeight: 182, marginHorizontal: 12, marginBottom: 5, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', overflow: 'hidden', backgroundColor: 'rgba(2,7,18,.13)' },
  sectionHeading: { height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.28)' },
  sectionStar: { width: 13, height: 13, alignItems: 'center', justifyContent: 'center' },
  sectionStarVertical: { position: 'absolute', width: 1, height: 13, backgroundColor: FateDropColors.goldBright },
  sectionStarHorizontal: { position: 'absolute', width: 13, height: 1, backgroundColor: FateDropColors.goldBright },
  sectionHeadingText: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 10.5, letterSpacing: 1.5 },
  sectionHeadingLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.28)' },
  sectionCounter: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 5 },
  sectionCounterText: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 11 },
  sectionCounterDots: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 42, overflow: 'hidden' },
  liveCarousel: { paddingRight: 22 },
  liveCard: { height: 145, overflow: 'hidden', backgroundColor: 'transparent', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.18)' },
  liveCardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  liveIdentity: { width: 102, minWidth: 92, alignSelf: 'stretch', justifyContent: 'center', paddingLeft: 4, zIndex: 2 },
  liveArtwork: { flex: 1, minWidth: 116, height: 142, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  liveArtworkOrbit: { position: 'absolute', width: 150, height: 54, borderRadius: 75, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.64)', bottom: 12, transform: [{ rotate: '-4deg' }] },
  liveArtworkOrbitInner: { position: 'absolute', width: 116, height: 35, borderRadius: 58, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.44)', bottom: 20 },
  liveProductImage: { width: 126, height: 117 },
  livePriceColumn: { width: 79, minWidth: 70, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5, zIndex: 2 },
  liveGame: { color: FateDropColors.goldBright, fontSize: 6.4, lineHeight: 9, letterSpacing: .2 },
  liveTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13.2, lineHeight: 16, marginTop: 4, ...heroShadow },
  liveRetailer: { color: FateDropColors.secondary, fontSize: 7.8, lineHeight: 11, marginTop: 4 },
  livePrice: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, lineHeight: 25, textAlign: 'right', ...heroShadow },
  livePriceContext: { color: FateDropColors.manifested, fontSize: 6.5, lineHeight: 9, textAlign: 'right', marginTop: 4 },
  liveVerified: { color: FateDropColors.secondary, fontSize: 6.4, lineHeight: 9, marginTop: 3 },
  liveExternal: { position: 'absolute', left: 10, bottom: 7, minHeight: 19, flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveExternalText: { color: FateDropColors.goldBright, fontSize: 5.7, fontWeight: '800', letterSpacing: .55 },
  carouselDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(226,197,141,.66)', backgroundColor: 'transparent' },
  carouselDotActive: { borderColor: FateDropColors.manifested, backgroundColor: FateDropColors.manifested },
  liveEmpty: { minHeight: 144, marginHorizontal: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  liveEmptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  liveEmptyCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  lowerSections: { paddingTop: 1 },
  ledgerSection: { marginHorizontal: 14, marginBottom: 2 },
  ornamentTitle: { height: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ornamentLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.43)' },
  ornamentDiamond: { width: 5, height: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.goldBright, transform: [{ rotate: '45deg' }] },
  ornamentText: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 11, letterSpacing: 1.55 },
  ledger: { minHeight: 61, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(3,8,20,.08)' },
  ledgerItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  ledgerOrbit: { position: 'absolute', width: '112%', height: 47, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.22)' },
  ledgerValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, lineHeight: 23 },
  ledgerLabel: { maxWidth: 54, color: FateDropColors.secondary, fontSize: 5.7, lineHeight: 8, fontWeight: '700', letterSpacing: .45 },
  commandPortal: { height: 185, marginTop: 0, overflow: 'hidden' },
  commandArcOuter: { position: 'absolute', width: '110%', height: 215, left: '-5%', top: 16, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)' },
  commandArcInner: { position: 'absolute', width: '91%', height: 180, left: '4.5%', top: 29, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.32)' },
  orbitalActions: { height: 66, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingHorizontal: 42, zIndex: 3 },
  orbitalAction: { width: 72, alignItems: 'center' },
  orbitalActionFeatured: { transform: [{ translateY: -5 }] },
  orbitalActionCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.55)', backgroundColor: 'rgba(5,9,22,.74)' },
  orbitalActionCircleFeatured: { width: 48, height: 48, borderRadius: 24, borderColor: 'rgba(226,197,141,.72)' },
  orbitalActionRing: { position: 'absolute', width: '82%', height: '82%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.40)' },
  orbitalActionText: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 10, lineHeight: 12, marginTop: 4 },
  encounterPortal: { position: 'absolute', left: 22, right: 22, bottom: 0, height: 130, overflow: 'hidden', borderTopLeftRadius: 180, borderTopRightRadius: 180, backgroundColor: '#07101E' },
  encounterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,13,.31)' },
  encounterPortalCopy: { position: 'absolute', left: 22, right: 22, bottom: 11, alignItems: 'center', ...heroShadow },
  encounterPortalTitle: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 10.5, letterSpacing: 1.15 },
  encounterPortalDiamond: { width: 7, height: 7, marginTop: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.goldBright, transform: [{ rotate: '45deg' }] },
  encounterPortalEvent: { maxWidth: 280, color: 'rgba(242,233,218,.76)', fontSize: 6.5, lineHeight: 9, marginTop: 4 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(1,3,9,.72)' },
  sheetPanel: { paddingHorizontal: 21, paddingTop: 11, paddingBottom: 34, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.56)', backgroundColor: '#080E19' },
  sheetHandle: { width: 35, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 15, backgroundColor: 'rgba(226,197,141,.42)' },
  sheetEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '800', letterSpacing: 1.25 },
  sheetTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23, lineHeight: 28, marginTop: 5, marginBottom: 5 },
  sheetDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginBottom: 15 },
  detailLedger: { marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  detailFact: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.18)' },
  detailFactLabel: { color: FateDropColors.gold, fontSize: 7.5, fontWeight: '800', letterSpacing: .8 },
  detailFactValue: { flex: 1, color: FateDropColors.ivory, fontSize: 10.5, textAlign: 'right' },
  sheetPrimary: { minHeight: 48, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FateDropColors.goldBright },
  sheetPrimaryText: { color: FateDropColors.ink, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  pressed: { opacity: .72 },
  flex: { flex: 1 },
});
