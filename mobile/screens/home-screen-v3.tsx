import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArtworkEdgeBlend } from '@/components/artwork-edge-blend';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { HomePersonalBriefing } from '@/components/home-personal-briefing';
import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import { FATEDROP_WORDMARK_URI } from '@/constants/brand-wordmark-data';
import { profileWallpaperMeta } from '@/constants/profile-customisation';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalLiveOpportunities, type CanonicalMobileAlert } from '@/services/canonical-alerts';
import { fetchFateCollectorsSummary, fetchFatePulse, type FateCollectorsSnapshot, type FatePulseSnapshot } from '@/services/fate-market';
import { fetchNetworkPulse, type NetworkPulse, type NetworkSignalState } from '@/services/network-signals';
import { openExternalRetailerLink } from '@/services/outbound-links';
import { loadProfileCustomisation, type ProfileWallpaperId } from '@/services/profile-customisation';

const stageMeta: Record<NetworkSignalState, { label: string; companion: string; color: string }> = {
  whisper: { label: 'Whisper', companion: 'Oru', color: FateDropColors.whisper },
  echo: { label: 'Echo', companion: 'Fenn', color: FateDropColors.echo },
  manifested: { label: 'Manifested', companion: 'Koru', color: FateDropColors.manifested },
  vanished: { label: 'Vanished', companion: 'Nyxen', color: FateDropColors.vanished },
};
const stageOrder: NetworkSignalState[] = ['whisper', 'echo', 'manifested', 'vanished'];
const emptyPulse: NetworkPulse = { whisper: 0, echo: 0, manifested: 0, vanished: 0 };

// Keep the preference plumbing intact, but do not render profile wallpapers on Home
// until the wallpaper set has been redesigned around the Living Signal safe zones.
const HOME_PROFILE_WALLPAPER_ENABLED = false;

export default function HomeScreenV3() {
  const insets = useSafeAreaInsets();
  const { snapshot, signedIn, refreshIfStale } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [pulse, setPulse] = useState<NetworkPulse>(emptyPulse);
  const [pulseError, setPulseError] = useState(false);
  const [liveOpportunities, setLiveOpportunities] = useState<CanonicalMobileAlert[]>([]);
  const [liveError, setLiveError] = useState(false);
  const [marketPulse, setMarketPulse] = useState<FatePulseSnapshot | null>(null);
  const [collectors, setCollectors] = useState<FateCollectorsSnapshot | null>(null);
  const [selectedTcgFilter, setTcgFilter] = useState<'all' | TcgCode>('all');
  const [observedNow, setObservedNow] = useState(0);
  const [homeWallpaperId, setHomeWallpaperId] = useState<ProfileWallpaperId>('koruHome');

  const load = useCallback(async () => {
    const [nextPulse, nextLive, , customisation, nextMarketPulse, nextCollectors] = await Promise.all([
      fetchNetworkPulse(7).catch(() => null),
      signedIn ? fetchCanonicalLiveOpportunities(20).catch(() => null) : Promise.resolve([]),
      signedIn ? refreshIfStale().catch(() => null) : Promise.resolve(null),
      loadProfileCustomisation(identity).catch(() => null),
      fetchFatePulse().catch(() => null),
      signedIn ? fetchFateCollectorsSummary().catch(() => null) : Promise.resolve(null),
    ]);
    if (nextPulse) {
      setPulse(nextPulse);
      setPulseError(false);
    } else {
      setPulseError(true);
    }
    if (nextLive) {
      setLiveOpportunities(nextLive);
      setLiveError(false);
    } else {
      setLiveOpportunities([]);
      setLiveError(signedIn);
    }
    if (customisation) setHomeWallpaperId(customisation.wallpaperId);
    setMarketPulse(nextMarketPulse);
    setCollectors(nextCollectors);
    setObservedNow(Date.now());
  }, [identity, refreshIfStale, signedIn]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selectedTcgCodes = useMemo<TcgCode[]>(() => snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences.selectedTcgCodes]);
  const tcgFilter = selectedTcgFilter === 'all' || selectedTcgCodes.includes(selectedTcgFilter) ? selectedTcgFilter : 'all';
  const matchesFilter = useCallback((value: unknown) => tcgFilter === 'all' || (isTcgCode(value) && value === tcgFilter), [tcgFilter]);
  const activeFinds = snapshot?.fateFinds?.filter((item) => item.enabled !== false && matchesFilter(item.tcgCode)).length ?? 0;
  const recentMatches = useMemo(() => {
    const floor = Math.floor(observedNow / 1000) - 7 * 86_400;
    return snapshot?.fateMatches?.filter((item) => item.matchedAt >= floor && matchesFilter(item.tcgCode)).length ?? 0;
  }, [matchesFilter, observedNow, snapshot?.fateMatches]);
  const saved = snapshot?.wishlist?.filter((item) => matchesFilter(item.tcg)).length ?? 0;
  const visibleLiveOpportunities = useMemo(() => liveOpportunities.filter((alert) => (
    selectedTcgCodes.includes(alert.tcgCode as TcgCode)
    && (tcgFilter === 'all' || alert.tcgCode === tcgFilter)
  )), [liveOpportunities, selectedTcgCodes, tcgFilter]);
  const tcgParam = tcgFilter === 'all' ? undefined : tcgFilter;
  const filterLabel = tcgFilter === 'all' ? 'All selected games' : TCG_REGISTRY.find((entry) => entry.code === tcgFilter)?.shortName ?? tcgFilter;
  const wallpaperAccent = profileWallpaperMeta[homeWallpaperId].accent;
  const pulse30d = marketPulse?.pulse?.direction?.periods.d30;
  const pulseAvailable = pulse30d?.status === 'available';
  const collection = collectors?.summary.collection;
  const closestSet = collectors?.summary.closestSet;

  return (
    <View style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.livingStage}>
          <Image source={require('../assets/images/home-living-stage-v2.png')} style={StyleSheet.absoluteFill} cachePolicy="disk" contentFit="cover" contentPosition="top center" enforceEarlyResizing />
          {HOME_PROFILE_WALLPAPER_ENABLED && homeWallpaperId !== 'koruHome' ? <View pointerEvents="none" style={styles.selectedWallpaperLayer}>
            <ProfileWallpaperArt wallpaperId={homeWallpaperId} />
            <ArtworkEdgeBlend accentColor={wallpaperAccent} height={130} />
          </View> : null}
          <View pointerEvents="none" style={styles.stageVeil} />

          <View style={[styles.hero, { paddingTop: insets.top + 76 }]}>
            <Image source={{ uri: FATEDROP_WORDMARK_URI }} style={[styles.wordmark, { top: insets.top + 5 }]} contentFit="contain" contentPosition="left center" />
            <View style={styles.heroBriefing}>
              <HomePersonalBriefing embedded />
            </View>
            <View style={styles.heroLifecycle}>
              <View accessibilityLabel="Network signals · Last 7 days" style={styles.lifecycleRibbon}>
                {stageOrder.map((state, index) => {
                  const meta = stageMeta[state];
                  return (
                    <Pressable key={state} onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: state.toUpperCase(), tcg: tcgParam } })} style={[styles.lifecycleItem, index === stageOrder.length - 1 && styles.lifecycleItemLast]}>
                      <Ionicons name={state === 'whisper' ? 'sparkles-outline' : state === 'echo' ? 'radio-outline' : state === 'manifested' ? 'diamond-outline' : 'moon-outline'} size={12} color={meta.color} />
                      <Text style={styles.lifecycleLabel}>{meta.label.toUpperCase()}</Text>
                      <Text style={[styles.lifecycleValue, { color: meta.color }]}>{pulseError ? '—' : pulse[state]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.intelligenceGrid}>
            <IntelligenceCard accent={FateDropColors.manifested} eyebrow="FATEPULSE" icon="pulse-outline" title="Pokémon Market"
              value={pulseAvailable ? movementPercent(pulse30d?.headlinePercent) : '— · 30D'}
              detail={pulseAvailable ? `${pulse30d?.breadth.risingSets ?? 0} rising · ${pulse30d?.breadth.unchangedSets ?? 0} stable · ${pulse30d?.breadth.fallingSets ?? 0} falling` : 'Building qualifying market evidence'}
              foot={pulse30d ? `Coverage ${marketPercent(pulse30d.coverage.currentPriceCoveragePct)}` : 'Coverage unavailable'}
              breadth={pulseAvailable ? pulse30d?.breadth : undefined}
              onPress={() => router.push({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} />
            <IntelligenceCard accent={FateDropColors.manifested} eyebrow="FATE COLLECTORS" icon="people-outline"
              title="Your collection" value={signedIn ? collectionValue(collectors) : 'Connect'}
              detail={signedIn ? `${collectors?.summary.cardUnits ?? 0} cards · ${collectors?.summary.setsOwned ?? 0} sets` : 'Make the market personal'}
              foot={signedIn && closestSet ? `${closestSet.setName || 'Closest set'} · ${closestSet.completionPercent.toFixed(0)}% complete` : signedIn ? `Price coverage ${marketPercent(collection?.priceCoveragePercent)}` : 'Import once. FateDrop does the thinking.'}
              onPress={() => router.push({ pathname: '/(tabs)/market', params: { area: 'collectors' } })} />
          </View>

          <View style={styles.livePanel} accessible accessibilityLabel="Verified live opportunities" accessibilityHint="Seeing one here never repeats the alarm">
            <View style={styles.liveHead}>
              <Text style={[styles.sectionEyebrow, styles.liveEyebrow]}>✦ VERIFIED LIVE NOW</Text>
              <Pressable onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: 'MANIFESTED', tcg: tcgParam } })} style={styles.viewAllLink}><Text style={styles.viewAllText}>View all</Text><Ionicons name="chevron-forward" size={13} color={FateDropColors.goldBright} /></Pressable>
            </View>
            {visibleLiveOpportunities.length ? <View style={styles.liveRail}>
              <LiveOpportunityCard alert={visibleLiveOpportunities[0]} observedNow={observedNow} />
            </View> : <View style={styles.liveEmpty}>
              <Ionicons name={liveError ? 'cloud-offline-outline' : 'diamond-outline'} size={22} color={liveError ? FateDropColors.muted : FateDropColors.manifested} />
              <View style={styles.flex}>
                <Text style={styles.liveEmptyTitle}>{liveError ? 'Live verification is temporarily unavailable' : 'Nothing is freshly verified live right now'}</Text>
                <Text style={styles.liveEmptyCopy}>{liveError ? 'FateDrop will not fall back to stale stock.' : 'This space lights up only for current, verified availability.'}</Text>
              </View>
            </View>}
          </View>
          <ArtworkEdgeBlend accentColor={wallpaperAccent} height={90} />
        </View>

        <View style={styles.gameFilterHead}><Text style={styles.gameFilterEyebrow}>BROWSE YOUR HOME VIEW</Text><Text style={styles.sectionHint}>{filterLabel}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gameFilters}>
          <Pressable onPress={() => setTcgFilter('all')} style={[styles.gameFilter, tcgFilter === 'all' && styles.gameFilterActive]}><Text style={[styles.gameFilterText, tcgFilter === 'all' && styles.gameFilterTextActive]}>ALL</Text></Pressable>
          {selectedTcgCodes.map((code) => { const entry = TCG_REGISTRY.find((item) => item.code === code); return entry ? <Pressable key={code} onPress={() => setTcgFilter(code)} style={[styles.gameFilter, tcgFilter === code && { borderColor: entry.accent, backgroundColor: `${entry.accent}15` }]}><Text style={[styles.gameFilterText, tcgFilter === code && { color: entry.accent }]}>{entry.shortName.toUpperCase()}</Text></Pressable> : null; })}
        </ScrollView>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR FATEDROP</Text>
            <Text style={styles.sectionTitle}>{signedIn ? 'Your current picture' : 'Connect your FateDrop ID'}</Text>
          </View>
        </View>
        <View style={styles.personalGrid}>
          <MiniStat value={signedIn ? String(activeFinds) : '—'} label="ACTIVE FATEFINDS" icon="telescope-outline" onPress={() => router.push('/fate-match')} />
          <MiniStat value={signedIn ? String(recentMatches) : '—'} label="7D FATEMATCHES" icon="sparkles-outline" onPress={() => router.push('/fate-match')} />
          <MiniStat value={signedIn ? String(saved) : '—'} label="WISHLIST" icon="bookmark-outline" onPress={() => router.push('/(tabs)/watchlist')} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Open the FateDrop Guide" onPress={() => router.push('/demo')} style={({ pressed }) => [styles.guideCard, pressed && styles.pressed]}>
          <View style={styles.guideIcon}><Ionicons name="compass-outline" size={24} color={FateDropColors.goldBright} /></View>
          <View style={styles.flex}>
            <Text style={styles.guideEyebrow}>FATEDROP GUIDE</Text>
            <Text style={styles.guideTitle}>How FateDrop works — whenever you need it.</Text>
            <Text style={styles.guideCopy}>Replay the guided tour, learn every core tool and revisit Whisper → Echo → Manifested → Vanished whenever you need it.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright} />
        </Pressable>

        <Text style={styles.sectionEyebrow}>QUICK ACTIONS</Text>
        <View style={styles.actions}>
          <Action title="Search" detail="See what is available" icon="search-outline" onPress={() => router.push('/(tabs)/search')} />
          <Action title="FateFind" detail="Find it now or keep hunting" icon="telescope-outline" onPress={() => router.push({ pathname: '/fatefind', params: { tcg: tcgParam } })} />
          <Action title="Events" detail="Card shows, tournaments and meet-ups" icon="calendar-outline" onPress={() => router.push('/encounters')} />
        </View>

        <View style={styles.eventSectionHead}>
          <Text style={styles.eventSectionEyebrow}>FATE ENCOUNTERS</Text>
          <Text style={styles.eventSectionTitle}>Find your next encounter.</Text>
          <Text style={styles.eventSectionCopy}>Card shows, trade nights, tournaments and collector meet-ups — discover what is happening beyond the screen.</Text>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Explore FateDrop events" onPress={() => router.push('/encounters')} style={({ pressed }) => [styles.eventPromo, pressed && styles.pressed]}>
          <Image source={require('../assets/images/event-signup.png.png')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" />
          <View style={styles.eventPromoShade} />
          <View style={styles.eventPromoContent}>
            <Text style={styles.eventPromoEyebrow}>EVENTS · CARD SHOWS · COMMUNITY</Text>
            <Text style={styles.eventPromoTitle}>Where collectors become the community.</Text>
            <View style={styles.eventPromoCta}>
              <Text style={styles.eventPromoCtaText}>EXPLORE EVENTS</Text>
              <Ionicons name="arrow-forward" size={15} color={FateDropColors.ivory} />
            </View>
          </View>
        </Pressable>

        <View style={styles.explainer}>
          <Ionicons name="sparkles-outline" size={20} color={FateDropColors.goldBright} />
          <View style={styles.flex}>
            <Text style={styles.explainerTitle}>Search → Wishlist → FateFind → FateMatch</Text>
            <Text style={styles.explainerCopy}>Browse it. Remember it. Ask FateFind to hunt it. Get a FateMatch when your conditions line up.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function movementPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% · 30D`;
}

function marketPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
}

function collectionValue(data: FateCollectorsSnapshot | null) {
  const collection = data?.summary.collection;
  if (!collection || collection.status === 'unavailable' || collection.pricedUnits === 0) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: data.summary.currencyCode, maximumFractionDigits: 0 }).format(collection.knownValue);
  } catch {
    return `${collection.knownValue.toFixed(0)} ${data.summary.currencyCode}`;
  }
}

function IntelligenceCard({ accent, breadth, detail, eyebrow, foot, icon, onPress, title, value }: {
  accent: string;
  breadth?: { risingSets: number; unchangedSets: number; fallingSets: number };
  detail: string;
  eyebrow: string;
  foot: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  title: string;
  value: string;
}) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.intelligenceCard, pressed && styles.pressed]}>
    <View pointerEvents="none" style={styles.intelligenceOrbit} />
    <View pointerEvents="none" style={[styles.intelligenceStar, { borderColor: `${accent}66` }]} />
    <View style={styles.intelligenceHeading}>
      <View style={[styles.intelligenceIcon, { borderColor: `${accent}66`, backgroundColor: `${accent}0D` }]}><Ionicons name={icon} size={19} color={accent} /></View>
      <Text style={styles.intelligenceEyebrow}>{eyebrow}</Text>
    </View>
    <Text style={styles.intelligenceTitle}>{title}</Text>
    <Text style={[styles.intelligenceValue, { color: value === 'Connect' ? FateDropColors.ivory : accent }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.intelligenceDetail}>{detail}</Text>
    {breadth ? <MarketBreadth breadth={breadth} /> : null}
    <View style={styles.intelligenceRule} />
    <Text style={styles.intelligenceFoot} numberOfLines={2}>{foot}</Text>
  </Pressable>;
}

function MarketBreadth({ breadth }: { breadth: { risingSets: number; unchangedSets: number; fallingSets: number } }) {
  const total = breadth.risingSets + breadth.unchangedSets + breadth.fallingSets;
  if (total <= 0) return null;
  return <View accessibilityLabel={`${breadth.risingSets} rising, ${breadth.unchangedSets} stable, ${breadth.fallingSets} falling`} style={styles.breadthBar}>
    {breadth.risingSets > 0 ? <View style={[styles.breadthSegment, { flex: breadth.risingSets, backgroundColor: FateDropColors.manifested }]} /> : null}
    {breadth.unchangedSets > 0 ? <View style={[styles.breadthSegment, { flex: breadth.unchangedSets, backgroundColor: FateDropColors.muted }]} /> : null}
    {breadth.fallingSets > 0 ? <View style={[styles.breadthSegment, { flex: breadth.fallingSets, backgroundColor: FateDropColors.vanished }]} /> : null}
  </View>;
}

function MiniStat({ value, label, icon, onPress }: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.miniStat}><Ionicons name={icon} size={17} color={FateDropColors.goldBright} /><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></Pressable>;
}
function Action({ title, detail, icon, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons name={icon} size={19} color={FateDropColors.goldBright} /></View><View style={styles.flex}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} /></Pressable>;
}

function LiveOpportunityCard({ alert, observedNow }: { alert: CanonicalMobileAlert; observedNow: number }) {
  const price = alert.product.deliveredPricePence ?? alert.product.pricePence;
  const verifiedAt = alert.liveWindow?.lastConfirmedLiveAt ? Date.parse(alert.liveWindow.lastConfirmedLiveAt) : Number.NaN;
  const ageMinutes = observedNow > 0 && Number.isFinite(verifiedAt) ? Math.max(0, Math.floor((observedNow - verifiedAt) / 60_000)) : null;
  const verifiedLabel = ageMinutes == null ? 'Fresh confirmation' : ageMinutes < 1 ? 'Verified just now' : `Verified ${ageMinutes}m ago`;
  const delta = alert.priceIntelligence.rrpDeltaPercent;
  const priceContext = delta == null || !Number.isFinite(delta)
    ? null
    : delta < 0
      ? `${Math.abs(delta).toFixed(1)}% below RRP`
      : `${delta.toFixed(1)}% over RRP`;
  return <Pressable onPress={() => alert.productUrl ? void openExternalRetailerLink({ destinationUrl: alert.productUrl, retailerId: alert.retailerId, placement: 'home-verified-live' }).catch(() => undefined) : undefined} style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}>
    <View style={styles.liveArtwork}>
      <View pointerEvents="none" style={styles.liveArtworkOrbit} />
      {alert.product.imageUrl
        ? <Image source={{ uri: alert.product.imageUrl }} style={styles.liveProductImage} cachePolicy="disk" contentFit="contain" enforceEarlyResizing />
        : <Ionicons name="diamond-outline" size={52} color={FateDropColors.manifested} />}
    </View>
    <View style={styles.liveCopy}>
      <Text style={styles.liveTitle} numberOfLines={2}>{alert.product.title || alert.title}</Text>
      <Text style={styles.liveSet} numberOfLines={1}>{alert.facets.setName || alert.retailer}</Text>
      <Text style={styles.liveRetailer} numberOfLines={1}>{alert.facets.setName ? alert.retailer : verifiedLabel}</Text>
      <View style={styles.liveCardBottom}>
        <View>
          {priceContext ? <Text style={styles.livePriceContext}>{priceContext}</Text> : null}
          <Text style={styles.livePrice}>{price == null ? 'Price unknown' : `£${(price / 100).toFixed(2)}`}</Text>
        </View>
        {alert.facets.setName ? <Text style={styles.liveVerified}>{verifiedLabel}</Text> : null}
      </View>
    </View>
  </Pressable>;
}

const heroShadow = { textShadowColor: 'rgba(0,0,0,.92)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingBottom: 118 },
  livingStage: { overflow: 'hidden', backgroundColor: '#050A17' },
  selectedWallpaperLayer: { position: 'absolute', left: 0, right: 0, top: 0, height: 405, overflow: 'hidden' },
  stageVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,15,.10)' },
  hero: { minHeight: 405, paddingBottom: 18, overflow: 'hidden' },
  wordmark: { position: 'absolute', left: 24, width: 140, height: 48, zIndex: 2, opacity: .94 },
  heroBriefing: { marginLeft: 24, marginRight: 22, zIndex: 2 },
  heroLifecycle: { marginTop: 12, marginHorizontal: 18, zIndex: 3 },
  guideCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 18, marginBottom: 20, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.goldBright}45`, backgroundColor: 'rgba(19,17,12,.94)' },
  guideIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.goldBright}3D`, backgroundColor: `${FateDropColors.goldBright}12` },
  guideEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  guideTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 3 },
  guideCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 6, marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.25, paddingHorizontal: 18, marginBottom: 7 },
  sectionTitle: { color: FateDropColors.ivory, fontSize: 20, fontWeight: '900', marginTop: 2 },
  sectionHint: { color: FateDropColors.muted, fontSize: 10, paddingBottom: 2 },
  gameFilterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 0, marginBottom: 7 },
  gameFilterEyebrow: { color: FateDropColors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.05 },
  gameFilters: { gap: 7, paddingHorizontal: 18, paddingBottom: 20 },
  gameFilter: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: FateDropColors.border, borderRadius: 999, backgroundColor: 'rgba(8,13,23,.72)' },
  gameFilterActive: { borderColor: FateDropColors.goldBright, backgroundColor: `${FateDropColors.goldBright}14` },
  gameFilterText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900' },
  gameFilterTextActive: { color: FateDropColors.goldBright },
  intelligenceGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 0, marginBottom: 14, zIndex: 2 },
  intelligenceCard: { flex: 1, minHeight: 194, padding: 13, borderRadius: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', backgroundColor: 'rgba(3,8,20,.58)' },
  intelligenceOrbit: { position: 'absolute', width: 156, height: 156, borderRadius: 78, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(199,166,106,.13)', right: -54, top: 22 },
  intelligenceStar: { position: 'absolute', width: 9, height: 9, right: 18, bottom: 24, borderWidth: StyleSheet.hairlineWidth, transform: [{ rotate: '45deg' }] },
  intelligenceHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  intelligenceIcon: { width: 35, height: 35, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  intelligenceEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '800', letterSpacing: 1.12 },
  intelligenceTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 16, lineHeight: 19, marginTop: 10 },
  intelligenceValue: { fontFamily: Fonts?.serif, fontSize: 23, lineHeight: 28, marginTop: 5 },
  intelligenceDetail: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 4 },
  breadthBar: { height: 3, flexDirection: 'row', gap: 2, marginTop: 8, overflow: 'hidden', borderRadius: 2 },
  breadthSegment: { minWidth: 2, borderRadius: 2 },
  intelligenceRule: { height: StyleSheet.hairlineWidth, marginTop: 'auto', marginBottom: 7, backgroundColor: 'rgba(226,197,141,.30)' },
  intelligenceFoot: { color: 'rgba(242,233,218,.62)', fontSize: 8.5, lineHeight: 12 },
  lifecycleRibbon: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 5, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', backgroundColor: 'rgba(3,8,20,.52)' },
  lifecycleItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.18)' },
  lifecycleItemLast: { borderRightWidth: 0 },
  lifecycleLabel: { color: FateDropColors.secondary, fontSize: 6.1, fontWeight: '700', letterSpacing: .22 },
  lifecycleValue: { fontFamily: Fonts?.serif, fontSize: 15, lineHeight: 18 },
  livePanel: { marginHorizontal: 18, marginBottom: 30, overflow: 'hidden', borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.52)', backgroundColor: 'rgba(3,8,20,.57)', zIndex: 2 },
  liveHead: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.30)' },
  liveEyebrow: { paddingHorizontal: 0, marginBottom: 0, color: FateDropColors.goldBright },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 3 },
  viewAllText: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 10, letterSpacing: .15 },
  liveRail: { paddingHorizontal: 0 },
  liveCard: { width: '100%', minHeight: 150, padding: 12, flexDirection: 'row', gap: 14, backgroundColor: 'transparent' },
  liveArtwork: { width: 106, minHeight: 122, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  liveArtworkOrbit: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.46)', transform: [{ rotate: '25deg' }] },
  liveProductImage: { width: 92, height: 112 },
  liveCopy: { flex: 1, minWidth: 0, paddingVertical: 4 },
  liveTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 16, lineHeight: 19 },
  liveSet: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 14, marginTop: 5 },
  liveRetailer: { color: FateDropColors.goldBright, fontSize: 9, lineHeight: 13, marginTop: 3 },
  liveCardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8 },
  livePriceContext: { color: FateDropColors.manifested, fontSize: 8.5, marginBottom: 2 },
  livePrice: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 17 },
  liveVerified: { flex: 1, color: FateDropColors.secondary, fontSize: 7.5, textAlign: 'right', paddingBottom: 2 },
  liveEmpty: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15 },
  liveEmptyTitle: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900' },
  liveEmptyCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  personalGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 25 },
  miniStat: { flex: 1, padding: 12, minHeight: 108, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  miniValue: { color: FateDropColors.ivory, fontSize: 22, fontWeight: '900', marginTop: 9 },
  miniLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', lineHeight: 12, marginTop: 3 },
  actions: { paddingHorizontal: 18, gap: 8, marginBottom: 24 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  actionIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}10` },
  actionTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' },
  actionDetail: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  eventSectionHead: { paddingHorizontal: 18, marginBottom: 11 },
  eventSectionEyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.35 },
  eventSectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 24, lineHeight: 28, fontWeight: '700', marginTop: 4 },
  eventSectionCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 340 },
  eventPromo: { height: 232, marginHorizontal: 18, marginBottom: 24, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.goldBright}55`, backgroundColor: FateDropColors.surface },
  eventPromoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,6,11,.28)' },
  eventPromoContent: { position: 'absolute', left: 16, right: 16, bottom: 15 },
  eventPromoEyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.05, ...heroShadow },
  eventPromoTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 21, lineHeight: 25, fontWeight: '700', maxWidth: 280, marginTop: 4, ...heroShadow },
  eventPromoCta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.goldBright}77`, backgroundColor: 'rgba(6,9,15,.72)' },
  eventPromoCtaText: { color: FateDropColors.ivory, fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  explainer: { flexDirection: 'row', gap: 11, marginHorizontal: 18, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  explainerTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },
  explainerCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },
  flex: { flex: 1 },
});