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
        <View style={styles.hero}>
          <ProfileWallpaperArt wallpaperId={homeWallpaperId} />
          <View pointerEvents="none" style={styles.heroVeil} />
          <ArtworkEdgeBlend accentColor={wallpaperAccent} height={156} />
          <Image source={{ uri: FATEDROP_WORDMARK_URI }} style={[styles.wordmark, { top: insets.top + 8 }]} contentFit="contain" contentPosition="left center" />
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={[styles.profileButton, { top: insets.top + 13 }]}>
            <Ionicons name={signedIn ? 'settings-outline' : 'person-outline'} size={18} color={FateDropColors.goldBright} />
          </Pressable>
          <View style={[styles.heroBriefing, { top: insets.top + 80 }]}>
            <HomePersonalBriefing embedded />
          </View>
          <View style={styles.heroLifecycle}>
            <Text style={styles.lifecycleWindow}>NETWORK · Last 7 days</Text>
            <View style={styles.lifecycleRibbon}>
              {stageOrder.map((state) => {
                const meta = stageMeta[state];
                return (
                  <Pressable key={state} onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: state.toUpperCase(), tcg: tcgParam } })} style={styles.lifecycleItem}>
                    <View style={[styles.pulseDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.lifecycleLabel}>{meta.label.toUpperCase()}</Text>
                    <Text style={[styles.lifecycleValue, { color: meta.color }]}>{pulseError ? '—' : pulse[state]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.intelligenceGrid}>
          <IntelligenceCard accent={FateDropColors.manifested} eyebrow="FATEPULSE" icon="pulse-outline" title="Tracked set direction"
            value={pulseAvailable ? movementPercent(pulse30d?.headlinePercent) : 'Building'}
            detail={pulseAvailable ? `${pulse30d?.breadth.risingSets ?? 0} rising · ${pulse30d?.breadth.unchangedSets ?? 0} stable · ${pulse30d?.breadth.fallingSets ?? 0} falling` : 'Waiting for qualifying 30D evidence'}
            foot={pulse30d ? `${marketPercent(pulse30d.coverage.currentPriceCoveragePct)} price coverage` : 'Evidence unavailable'}
            breadth={pulseAvailable ? pulse30d?.breadth : undefined}
            onPress={() => router.push({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} />
          <IntelligenceCard accent={FateDropColors.echo} eyebrow="FATE COLLECTORS" icon="albums-outline"
            title={signedIn ? 'Known collection value' : 'Your collection'} value={signedIn ? collectionValue(collectors) : 'Connect'}
            detail={signedIn ? `${collectors?.summary.cardUnits ?? 0} cards · ${collectors?.summary.setsOwned ?? 0} sets` : 'Sign in to make the market personal'}
            foot={signedIn && closestSet ? `${closestSet.setName || 'Closest set'} · ${closestSet.completionPercent.toFixed(0)}%` : signedIn ? `Price coverage ${marketPercent(collection?.priceCoveragePercent)}` : 'Import once. FateDrop does the thinking.'}
            onPress={() => router.push({ pathname: '/(tabs)/market', params: { area: 'collectors' } })} />
        </View>

        <View style={styles.livePanel} accessible accessibilityLabel="Verified live opportunities" accessibilityHint="Seeing one here never repeats the alarm">
          <View style={styles.liveHead}>
            <Text style={[styles.sectionEyebrow, styles.liveEyebrow]}>✦ VERIFIED LIVE NOW</Text>
            <Pressable onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: 'MANIFESTED', tcg: tcgParam } })} style={styles.viewAllLink}><Text style={styles.viewAllText}>VIEW ALL</Text><Ionicons name="chevron-forward" size={14} color={FateDropColors.goldBright} /></Pressable>
          </View>
          {visibleLiveOpportunities.length ? <View style={styles.liveRail}>
            <LiveOpportunityCard alert={visibleLiveOpportunities[0]} observedNow={observedNow} />
          </View> : <View style={styles.liveEmpty}>
            <Ionicons name={liveError ? 'cloud-offline-outline' : 'hourglass-outline'} size={20} color={FateDropColors.muted} />
            <View style={styles.flex}>
              <Text style={styles.liveEmptyTitle}>{liveError ? 'Live verification is temporarily unavailable' : 'No stock is freshly verified live right now'}</Text>
              <Text style={styles.liveEmptyCopy}>{liveError ? 'FateDrop will not fall back to stale stock.' : 'Closed or stale Manifested alerts stay in history; they are never recycled as current availability.'}</Text>
            </View>
          </View>}
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
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.intelligenceCard, { borderColor: `${accent}55` }, pressed && styles.pressed]}>
    <View style={[styles.intelligenceIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}12` }]}><Ionicons name={icon} size={19} color={accent} /></View>
    <Text style={[styles.intelligenceEyebrow, { color: accent }]}>{eyebrow}</Text>
    <Text style={styles.intelligenceTitle}>{title}</Text>
    <Text style={[styles.intelligenceValue, { color: value === '—' || value === 'Building' || value === 'Connect' ? FateDropColors.ivory : accent }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.intelligenceDetail}>{detail}</Text>
    {breadth ? <MarketBreadth breadth={breadth} /> : null}
    <View style={[styles.intelligenceRule, { backgroundColor: `${accent}44` }]} />
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
  const definition = TCG_REGISTRY.find((entry) => entry.code === alert.tcgCode);
  const price = alert.product.deliveredPricePence ?? alert.product.pricePence;
  const verifiedAt = alert.liveWindow?.lastConfirmedLiveAt ? Date.parse(alert.liveWindow.lastConfirmedLiveAt) : Number.NaN;
  const ageMinutes = observedNow > 0 && Number.isFinite(verifiedAt) ? Math.max(0, Math.floor((observedNow - verifiedAt) / 60_000)) : null;
  const verifiedLabel = ageMinutes == null ? 'Fresh confirmation' : ageMinutes < 1 ? 'Verified just now' : `Verified ${ageMinutes}m ago`;
  return <Pressable onPress={() => alert.productUrl ? void openExternalRetailerLink({ destinationUrl: alert.productUrl, retailerId: alert.retailerId, placement: 'home-verified-live' }).catch(() => undefined) : undefined} style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}>
    <View style={styles.liveCardTop}><Text style={styles.liveStatus}>STILL VERIFIED LIVE</Text><Text style={[styles.liveTcg, { borderColor: definition?.accent ?? FateDropColors.gold }]}>{definition?.shortName ?? alert.tcgCode}</Text></View>
    <Text style={styles.liveTitle} numberOfLines={2}>{alert.product.title || alert.title}</Text>
    <Text style={styles.liveRetailer} numberOfLines={1}>{alert.retailer}</Text>
    <View style={styles.liveCardBottom}><Text style={styles.livePrice}>{price == null ? 'PRICE UNKNOWN' : `£${(price / 100).toFixed(2)}`}</Text><Text style={styles.liveVerified}>{verifiedLabel}</Text></View>
  </Pressable>;
}

const heroShadow = { textShadowColor: 'rgba(0,0,0,.92)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingBottom: 118 },
  hero: { height: 405, overflow: 'hidden', backgroundColor: FateDropColors.background },
  heroVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,14,.12)' },
  wordmark: { position: 'absolute', left: 20, width: 154, height: 52, zIndex: 2 },
  profileButton: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,7,12,.5)', borderWidth: 1, borderColor: 'rgba(226,197,141,.42)', zIndex: 2 },
  heroBriefing: { position: 'absolute', left: 24, right: 22, zIndex: 2 },
  heroLifecycle: { position: 'absolute', left: 18, right: 18, bottom: 12, zIndex: 3 },
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
  intelligenceGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 10, marginBottom: 14 },
  intelligenceCard: { flex: 1, minHeight: 190, padding: 13, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(6,11,21,.82)' },
  intelligenceIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  intelligenceEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: .95 },
  intelligenceTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 15, lineHeight: 18, marginTop: 4 },
  intelligenceValue: { fontFamily: Fonts?.serif, fontSize: 23, lineHeight: 28, marginTop: 7 },
  intelligenceDetail: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 5 },
  breadthBar: { height: 3, flexDirection: 'row', gap: 2, marginTop: 8, overflow: 'hidden', borderRadius: 2 },
  breadthSegment: { minWidth: 2, borderRadius: 2 },
  intelligenceRule: { height: 1, marginTop: 'auto', marginBottom: 7 },
  intelligenceFoot: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 12 },
  lifecycleWindow: { alignSelf: 'flex-start', color: FateDropColors.gold, fontSize: 7, fontWeight: '900', letterSpacing: 1.05, textTransform: 'uppercase', paddingHorizontal: 8, marginLeft: 9, marginBottom: 4, ...heroShadow },
  lifecycleRibbon: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 5, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(210,182,111,.32)', backgroundColor: 'rgba(5,10,19,.72)' },
  lifecycleItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,.055)' },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  lifecycleLabel: { color: FateDropColors.secondary, fontSize: 6.5, fontWeight: '900', letterSpacing: .25 },
  lifecycleValue: { fontFamily: Fonts?.serif, fontSize: 18, lineHeight: 21 },
  livePanel: { marginHorizontal: 18, marginBottom: 22, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(226,197,141,.34)', backgroundColor: 'rgba(6,11,21,.82)' },
  liveHead: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.24)' },
  liveEyebrow: { paddingHorizontal: 0, marginBottom: 0, color: FateDropColors.goldBright },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 3 },
  viewAllText: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: .65 },
  liveRail: { paddingHorizontal: 0 },
  liveCard: { width: '100%', minHeight: 132, padding: 14, backgroundColor: 'transparent' },
  liveCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  liveStatus: { color: FateDropColors.manifested, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  liveTcg: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, borderWidth: 1, color: FateDropColors.ivory, fontSize: 7, fontWeight: '900' },
  liveTitle: { color: FateDropColors.ivory, fontSize: 14, lineHeight: 18, fontWeight: '900', marginTop: 12 },
  liveRetailer: { color: FateDropColors.secondary, fontSize: 10, marginTop: 5 },
  liveCardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 13 },
  livePrice: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },
  liveVerified: { flex: 1, color: FateDropColors.muted, fontSize: 8, textAlign: 'right' },
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
