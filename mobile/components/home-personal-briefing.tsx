import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { deriveHomeSignalKind, type HomeSignalKind } from '@/lib/home-signal-state';
import { loadWatchlist } from '@/lib/watchlist';
import {
  countUnreadCanonicalAlertsByStage,
  type CanonicalAlertStage,
  type CanonicalMobileAlert,
} from '@/services/canonical-alerts';
import { INITIAL_ALERT_LIMITS, queryCanonicalAlertPage } from '@/services/canonical-alert-query';
import { migrateLegacyWatchlist } from '@/services/wishlist';
import type { WishlistItem } from '@/types/domain';

const POKEMON_CENTER_UK_ID = 'pokemon-center-uk';
const POKEMON_CENTER_ACTIVITY_WINDOW_MS = 30 * 60 * 1000;
const HOME_SIGNAL_STAGES: CanonicalAlertStage[] = ['WHISPER', 'ECHO', 'VANISHED'];

type LoadState = 'idle' | 'ready' | 'error';
const EMPTY_PERSONAL_UNREAD: Record<CanonicalAlertStage, number> = {
  WHISPER: 0,
  ECHO: 0,
  MANIFESTED: 0,
  VANISHED: 0,
};

function normalizeRetailerName(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function newestActivityAt(alert: CanonicalMobileAlert) {
  const values = [
    alert.opportunity?.lastVerifiedAt,
    alert.liveWindow?.lastConfirmedLiveAt,
    alert.detectedAt,
  ]
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

function isPokemonCenterUk(alert: CanonicalMobileAlert) {
  if (alert.retailerId === POKEMON_CENTER_UK_ID) return true;
  return normalizeRetailerName(alert.retailer) === 'pokemon center uk';
}

function wishlistItemMatchesLiveOpportunity(item: WishlistItem, alert: CanonicalMobileAlert) {
  if (item.targetType === 'OFFER') return Boolean(alert.offerId && item.targetId === alert.offerId);
  if (item.targetType === 'PRODUCT') return Boolean(alert.productId && item.targetId === alert.productId);
  return false;
}

export function HomePersonalBriefing({
  embedded = false,
  liveOpportunities,
  liveState,
  onSignalStateChange,
}: {
  embedded?: boolean;
  liveOpportunities: CanonicalMobileAlert[];
  liveState: 'loading' | 'ready' | 'error';
  onSignalStateChange?: (state: HomeSignalKind) => void;
}) {
  const { signedIn, snapshot } = useFateDropId();
  const fateId = snapshot?.user?.fateId || null;
  const userId = snapshot?.user?.id || null;
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [alertState, setAlertState] = useState<LoadState>('idle');
  const [wishlistState, setWishlistState] = useState<LoadState>('idle');
  const [personalUnread, setPersonalUnread] = useState<Record<CanonicalAlertStage, number>>(EMPTY_PERSONAL_UNREAD);
  const [observedNow, setObservedNow] = useState(0);
  const [glow] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);
  const selectedTcgCodes = useMemo(() => snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences.selectedTcgCodes]);
  const alertFilterKey = useMemo(() => JSON.stringify({
    notificationUpdatedAt: snapshot?.notificationPreferences?.updatedAt ?? 0,
    tcgAlertPreferences: snapshot?.tcgPreferences?.alertPreferences ?? null,
  }), [snapshot?.notificationPreferences?.updatedAt, snapshot?.tcgPreferences?.alertPreferences]);

  const load = useCallback(async () => {
    if (!signedIn || !userId) {
      setAlerts([]);
      setWishlistItems([]);
      setAlertState('idle');
      setWishlistState('idle');
      setPersonalUnread(EMPTY_PERSONAL_UNREAD);
      return;
    }

    const visitStartedAt = Date.now();
    setObservedNow(visitStartedAt);

    const [nextAlerts, nextWishlist] = await Promise.all([
      Promise.all(HOME_SIGNAL_STAGES.map((stage) => queryCanonicalAlertPage({
        accountId: userId,
        stage,
        selectedTcgCodes,
        filterKey: alertFilterKey,
        limit: INITIAL_ALERT_LIMITS[stage],
      })))
        .then((pages) => ({ ok: true as const, data: pages.flatMap((page) => page.alerts) }))
        .catch(() => ({ ok: false as const, data: [] as CanonicalMobileAlert[] })),
      loadWatchlist()
        .then((keys) => migrateLegacyWatchlist(keys))
        .then((data) => ({ ok: true as const, data }))
        .catch(() => ({ ok: false as const, data: [] as WishlistItem[] })),
    ]);

    if (nextAlerts.ok) {
      setAlerts(nextAlerts.data);
      setAlertState('ready');
    } else {
      setAlerts([]);
      setAlertState('error');
    }

    const exactWishlistItems = nextWishlist.data.filter((item) => item.targetType === 'OFFER' || item.targetType === 'PRODUCT');
    if (nextWishlist.ok) {
      setWishlistItems(exactWishlistItems);
      setWishlistState('ready');
    } else {
      setWishlistItems([]);
      setWishlistState('error');
    }

    if (nextAlerts.ok && nextWishlist.ok && userId) {
      const personalAlerts = nextAlerts.data.filter((alert) => (
        exactWishlistItems.some((item) => wishlistItemMatchesLiveOpportunity(item, alert))
      ));
      const unread = await countUnreadCanonicalAlertsByStage(userId, personalAlerts).catch(() => EMPTY_PERSONAL_UNREAD);
      setPersonalUnread(unread);
    } else {
      setPersonalUnread(EMPTY_PERSONAL_UNREAD);
    }
  }, [alertFilterKey, selectedTcgCodes, signedIn, userId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

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

  const wantedLiveCount = useMemo(() => {
    if (liveState !== 'ready' || wishlistState !== 'ready') return 0;
    return wishlistItems.filter((item) => liveOpportunities.some((alert) => wishlistItemMatchesLiveOpportunity(item, alert))).length;
  }, [liveOpportunities, liveState, wishlistItems, wishlistState]);

  const pokemonCenterActive = useMemo(() => {
    if (!observedNow) return false;
    const floor = observedNow - POKEMON_CENTER_ACTIVITY_WINDOW_MS;
    return [...alerts, ...(liveState === 'ready' ? liveOpportunities : [])].some((alert) => (
      isPokemonCenterUk(alert)
      && alert.fateStage !== 'VANISHED'
      && newestActivityAt(alert) >= floor
    ));
  }, [alerts, liveOpportunities, liveState, observedNow]);

  const pcukEvidenceState: LoadState = pokemonCenterActive
    ? 'ready'
    : alertState === 'error' || liveState === 'error'
      ? 'error'
      : alertState === 'ready' && liveState === 'ready'
        ? 'ready'
        : 'idle';

  const signalState = useMemo(() => deriveHomeSignalKind({
    signedIn,
    loading: alertState === 'idle' || liveState === 'loading' || wishlistState === 'idle',
    error: alertState === 'error' || liveState === 'error' || wishlistState === 'error',
    wantedLiveCount,
    pokemonCenterActive,
    unreadEchoes: personalUnread.ECHO,
    unreadWhispers: personalUnread.WHISPER,
    unreadVanished: personalUnread.VANISHED,
  }), [alertState, liveState, personalUnread, pokemonCenterActive, signedIn, wantedLiveCount, wishlistState]);

  useEffect(() => {
    onSignalStateChange?.(signalState);
  }, [onSignalStateChange, signalState]);

  useEffect(() => {
    glow.stopAnimation();
    if (!pokemonCenterActive || reduceMotion) {
      glow.setValue(1);
      return;
    }
    glow.setValue(1);
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.36, duration: 520, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 620, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [glow, pokemonCenterActive, reduceMotion]);

  const pcukTextOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] });
  const pcukStatus = pcukEvidenceState === 'idle'
    ? 'POKÉMON CENTER UK ACTIVITY CHECKING'
    : pcukEvidenceState === 'error'
      ? 'POKÉMON CENTER UK STATUS UNAVAILABLE'
    : pokemonCenterActive
      ? 'POKÉMON CENTER UK ACTIVITY DETECTED'
      : 'NO POKÉMON CENTER UK ACTIVITY DETECTED';
  const wantedLine = liveState === 'loading' || wishlistState === 'idle'
    ? 'Wanted-item availability loading'
    : liveState === 'error' || wishlistState === 'error'
      ? 'Wanted-item availability unavailable'
    : wantedLiveCount === 1
      ? '1 wanted item is in stock'
      : `${wantedLiveCount} wanted items are in stock`;

  if (!signedIn) {
    return (
      <View style={[styles.card, embedded && styles.cardEmbedded]}>
        <Text style={[styles.welcomeKicker, embedded && styles.welcomeKickerEmbedded]}>Welcome to</Text>
        <Text style={[styles.welcomeIdentity, embedded && styles.welcomeIdentityEmbedded]}>FateDrop</Text>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.signInRow}>
          <Text style={styles.mutedLine}>Sign in to see your personal briefing</Text>
          <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, embedded && styles.cardEmbedded, pokemonCenterActive && styles.cardActive]}>
      <View style={styles.greeting}>
        <Text style={[styles.welcomeKicker, embedded && styles.welcomeKickerEmbedded]}>Welcome back,</Text>
        <Text style={[styles.welcomeIdentity, embedded && styles.welcomeIdentityEmbedded]} numberOfLines={1} adjustsFontSizeToFit>
          {fateId || 'FateDrop member'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={wantedLine}
        onPress={() => router.push('/(tabs)/watchlist')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.signalGlyph, styles.stockGlyph]}>
          <Ionicons name="sparkles-outline" size={15} color={FateDropColors.cyan} />
        </View>
        <Text style={styles.stockLine}>
          {liveState !== 'ready' || wishlistState !== 'ready'
            ? wantedLine
            : <><Text style={styles.stockCount}>{wantedLiveCount}</Text> wanted {wantedLiveCount === 1 ? 'item is' : 'items are'} in stock</>}
        </Text>
        <View pointerEvents="none" style={styles.statusRule} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pcukStatus}
        onPress={() => router.push('/pokemon-center-uk')}
        style={({ pressed }) => [styles.pcukRow, pokemonCenterActive && styles.pcukRowActive, pressed && styles.pressed]}
      >
        <View style={[styles.pcukGlyph, pokemonCenterActive && styles.pcukGlyphActive]}>
          <Ionicons name="radio-outline" size={18} color={FateDropColors.cyan} />
        </View>
        <Animated.Text style={[styles.pcukText, pokemonCenterActive && styles.pcukTextActive, pokemonCenterActive && { opacity: pcukTextOpacity }]}>{pcukStatus}</Animated.Text>
        <View pointerEvents="none" style={[styles.statusRule, styles.pcukRule, pokemonCenterActive && styles.pcukRuleActive]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(8,10,17,0.96)',
  },
  cardActive: {
    borderColor: 'rgba(210,182,111,0.34)',
  },
  cardEmbedded: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  greeting: {
    marginBottom: 5,
    maxWidth: '64%',
  },
  welcomeKicker: {
    color: FateDropColors.ivory,
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 25,
  },
  welcomeKickerEmbedded: {
    color: FateDropColors.goldBright,
    fontSize: 18,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 9,
  },
  welcomeIdentity: {
    color: FateDropColors.ivory,
    fontFamily: Fonts.serif,
    fontSize: 29,
    lineHeight: 35,
    marginTop: 1,
  },
  welcomeIdentityEmbedded: {
    color: FateDropColors.goldBright,
    fontSize: 29,
    lineHeight: 33,
    textShadowColor: 'rgba(0,0,0,.96)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  row: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusRule: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(99,225,255,.20)',
  },
  signalGlyph: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stockGlyph: {
    borderColor: `${FateDropColors.cyan}55`,
    backgroundColor: `${FateDropColors.cyan}12`,
  },
  stockLine: {
    flex: 1,
    color: FateDropColors.ivory,
    fontFamily: Fonts?.serif,
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  stockCount: { color: FateDropColors.cyan, fontSize: 17 },
  pcukRow: {
    marginTop: 5,
    minHeight: 32,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  pcukRowActive: {},
  pcukRule: {
    left: 2,
    right: 2,
    backgroundColor: 'rgba(99,225,255,.24)',
  },
  pcukRuleActive: {
    backgroundColor: 'rgba(99,225,255,.56)',
  },
  pcukGlyph: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,225,255,.32)',
    backgroundColor: 'rgba(15,88,120,.16)',
  },
  pcukGlyphActive: {
    borderColor: `${FateDropColors.cyan}66`,
    backgroundColor: `${FateDropColors.cyan}12`,
  },
  pcukText: {
    flex: 1,
    color: 'rgba(99,225,255,.58)',
    fontFamily: Fonts.sans,
    fontWeight: '600',
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.85,
  },
  pcukTextActive: {
    color: FateDropColors.cyan,
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mutedLine: {
    color: FateDropColors.muted,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  pressed: { opacity: 0.72 },
});
