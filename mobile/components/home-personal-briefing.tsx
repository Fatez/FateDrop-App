import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { loadWatchlist } from '@/lib/watchlist';
import {
  fetchCanonicalAlerts,
  fetchCanonicalLiveOpportunities,
  type CanonicalMobileAlert,
} from '@/services/canonical-alerts';
import { migrateLegacyWatchlist } from '@/services/wishlist';
import type { WishlistItem } from '@/types/domain';

const HOME_VISIT_PREFIX = 'fatedrop:home:last-visit:v1';
const POKEMON_CENTER_UK_ID = 'pokemon-center-uk';
const POKEMON_CENTER_ACTIVITY_WINDOW_MS = 30 * 60 * 1000;

type LoadState = 'idle' | 'ready' | 'error';

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

function parseStoredVisit(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function wishlistItemMatchesLiveOpportunity(item: WishlistItem, alert: CanonicalMobileAlert) {
  if (item.targetType === 'OFFER') return Boolean(alert.offerId && item.targetId === alert.offerId);
  if (item.targetType === 'PRODUCT') return Boolean(alert.productId && item.targetId === alert.productId);
  return false;
}

export function HomePersonalBriefing() {
  const { signedIn, snapshot } = useFateDropId();
  const fateId = snapshot?.user?.fateId || null;
  const userId = snapshot?.user?.id || null;
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [liveOpportunities, setLiveOpportunities] = useState<CanonicalMobileAlert[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [visitFloorMs, setVisitFloorMs] = useState<number | null>(null);
  const [alertState, setAlertState] = useState<LoadState>('idle');
  const [liveState, setLiveState] = useState<LoadState>('idle');
  const [wishlistState, setWishlistState] = useState<LoadState>('idle');
  const glow = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!signedIn || !userId) {
      setAlerts([]);
      setLiveOpportunities([]);
      setWishlistItems([]);
      setVisitFloorMs(null);
      setAlertState('idle');
      setLiveState('idle');
      setWishlistState('idle');
      return;
    }

    const visitStartedAt = Date.now();
    const visitKey = `${HOME_VISIT_PREFIX}:${encodeURIComponent(userId)}`;
    const previousVisit = parseStoredVisit(await AsyncStorage.getItem(visitKey).catch(() => null));
    setVisitFloorMs(previousVisit);

    const [nextAlerts, nextLive, nextWishlist] = await Promise.all([
      fetchCanonicalAlerts(50).then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: [] as CanonicalMobileAlert[] })),
      fetchCanonicalLiveOpportunities(50).then((data) => ({ ok: true as const, data })).catch(() => ({ ok: false as const, data: [] as CanonicalMobileAlert[] })),
      loadWatchlist()
        .then((keys) => migrateLegacyWatchlist(keys))
        .then((data) => ({ ok: true as const, data }))
        .catch(() => ({ ok: false as const, data: [] as WishlistItem[] })),
    ]);

    if (nextAlerts.ok) {
      setAlerts(nextAlerts.data);
      setAlertState('ready');
      await AsyncStorage.setItem(visitKey, String(visitStartedAt)).catch(() => undefined);
    } else {
      setAlerts([]);
      setAlertState('error');
    }

    if (nextLive.ok) {
      setLiveOpportunities(nextLive.data);
      setLiveState('ready');
    } else {
      setLiveOpportunities([]);
      setLiveState('error');
    }

    if (nextWishlist.ok) {
      setWishlistItems(nextWishlist.data.filter((item) => item.targetType === 'OFFER' || item.targetType === 'PRODUCT'));
      setWishlistState('ready');
    } else {
      setWishlistItems([]);
      setWishlistState('error');
    }
  }, [signedIn, userId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const echoesSinceLastVisit = useMemo(() => {
    if (!visitFloorMs || alertState !== 'ready') return 0;
    return alerts.filter((alert) => {
      if (alert.fateStage !== 'ECHO') return false;
      const detected = Date.parse(alert.detectedAt);
      return Number.isFinite(detected) && detected > visitFloorMs;
    }).length;
  }, [alertState, alerts, visitFloorMs]);

  const wantedLiveCount = useMemo(() => {
    if (liveState !== 'ready' || wishlistState !== 'ready') return 0;
    return wishlistItems.filter((item) => liveOpportunities.some((alert) => wishlistItemMatchesLiveOpportunity(item, alert))).length;
  }, [liveOpportunities, liveState, wishlistItems, wishlistState]);

  const pokemonCenterActive = useMemo(() => {
    if (alertState !== 'ready') return false;
    const floor = Date.now() - POKEMON_CENTER_ACTIVITY_WINDOW_MS;
    return alerts.some((alert) => (
      isPokemonCenterUk(alert)
      && alert.fateStage !== 'VANISHED'
      && newestActivityAt(alert) >= floor
    ));
  }, [alertState, alerts]);

  useEffect(() => {
    if (!pokemonCenterActive) {
      glow.stopAnimation();
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, pokemonCenterActive]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.58] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.05] });
  const pcukStatus = alertState === 'error'
    ? 'POKÉMON CENTER UK STATUS UNAVAILABLE'
    : pokemonCenterActive
      ? 'POKÉMON CENTER UK ACTIVITY DETECTED'
      : 'NO POKÉMON CENTER UK ACTIVITY DETECTED';
  const wantedLine = liveState === 'error' || wishlistState === 'error'
    ? 'Wanted-item availability unavailable'
    : wantedLiveCount === 1
      ? '1 wanted item is in stock'
      : `${wantedLiveCount} wanted items are in stock`;

  if (!signedIn) {
    return (
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome to FateDrop</Text>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.signInRow}>
          <Text style={styles.mutedLine}>Sign in to see your personal briefing</Text>
          <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, pokemonCenterActive && styles.cardActive]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        <Animated.View style={[styles.shard, styles.shardOne, pokemonCenterActive && { opacity: glowOpacity }]} />
        <Animated.View style={[styles.shard, styles.shardTwo, pokemonCenterActive && { opacity: glowOpacity }]} />
        <Animated.View style={[styles.shard, styles.shardThree, pokemonCenterActive && { opacity: glowOpacity }]} />
      </View>

      <Text style={styles.welcome}>Welcome back, {fateId || 'FateDrop member'}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${echoesSinceLastVisit} Echoes since your last visit`}
        onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: 'ECHO' } })}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={styles.echoLine}>
          {alertState === 'error'
            ? 'Echo activity unavailable'
            : `${echoesSinceLastVisit} ${echoesSinceLastVisit === 1 ? 'Echo' : 'Echoes'} since your last visit`}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={FateDropColors.echo} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={wantedLine}
        onPress={() => router.push('/(tabs)/watchlist')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={styles.stockLine}>{wantedLine}</Text>
        <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pcukStatus}
        onPress={() => router.push('/pokemon-center-uk')}
        style={({ pressed }) => [styles.pcukRow, pokemonCenterActive && styles.pcukRowActive, pressed && styles.pressed]}
      >
        <View style={[styles.statusDot, pokemonCenterActive && styles.statusDotActive]} />
        <Text style={[styles.pcukText, pokemonCenterActive && styles.pcukTextActive]}>{pcukStatus}</Text>
        <Ionicons name="chevron-forward" size={17} color={pokemonCenterActive ? FateDropColors.goldBright : FateDropColors.muted} />
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
  glow: {
    position: 'absolute',
    width: 230,
    height: 230,
    right: -68,
    bottom: -122,
    borderRadius: 115,
    backgroundColor: FateDropColors.goldBright,
  },
  shard: {
    position: 'absolute',
    width: 17,
    height: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(210,182,111,0.5)',
    backgroundColor: 'rgba(210,182,111,0.08)',
    transform: [{ rotate: '38deg' }],
    opacity: 0.12,
  },
  shardOne: { right: 24, top: 18 },
  shardTwo: { right: 64, top: 50, width: 10, height: 27, transform: [{ rotate: '62deg' }] },
  shardThree: { right: 35, bottom: 24, width: 12, height: 31, transform: [{ rotate: '18deg' }] },
  welcome: {
    color: FateDropColors.ivory,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: -0.3,
    marginBottom: 13,
    paddingRight: 72,
  },
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  echoLine: {
    flex: 1,
    color: FateDropColors.echo,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    fontSize: 14,
  },
  stockLine: {
    flex: 1,
    color: FateDropColors.ivory,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  pcukRow: {
    marginTop: 10,
    minHeight: 45,
    paddingHorizontal: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  pcukRowActive: {
    borderColor: 'rgba(210,182,111,0.36)',
    backgroundColor: 'rgba(210,182,111,0.08)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: FateDropColors.muted,
  },
  statusDotActive: {
    backgroundColor: FateDropColors.goldBright,
  },
  pcukText: {
    flex: 1,
    color: FateDropColors.muted,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.55,
  },
  pcukTextActive: {
    color: FateDropColors.goldBright,
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
