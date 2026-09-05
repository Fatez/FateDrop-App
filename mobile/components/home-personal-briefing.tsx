import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  onPokemonCenterStatusChange,
  onSignalStateChange,
}: {
  embedded?: boolean;
  liveOpportunities: CanonicalMobileAlert[];
  liveState: 'loading' | 'ready' | 'error';
  onPokemonCenterStatusChange?: (status: { active: boolean; label: string }) => void;
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

  const pcukStatus = pcukEvidenceState === 'idle'
    ? 'POKÉMON CENTER UK ACTIVITY CHECKING'
    : pcukEvidenceState === 'error'
      ? 'POKÉMON CENTER UK STATUS UNAVAILABLE'
    : pokemonCenterActive
      ? 'POKÉMON CENTER UK ACTIVITY DETECTED'
      : 'NO POKÉMON CENTER UK ACTIVITY DETECTED';

  useEffect(() => {
    onPokemonCenterStatusChange?.({ active: pokemonCenterActive, label: pcukStatus });
  }, [onPokemonCenterStatusChange, pcukStatus, pokemonCenterActive]);

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
    <View style={[styles.card, embedded && styles.cardEmbedded]}>
      <View style={styles.greeting}>
        <Text style={[styles.welcomeKicker, embedded && styles.welcomeKickerEmbedded]}>Welcome back,</Text>
        <Text style={[styles.welcomeIdentity, embedded && styles.welcomeIdentityEmbedded]} numberOfLines={1} adjustsFontSizeToFit>
          {fateId || 'FateDrop member'}
        </Text>
      </View>
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
});
