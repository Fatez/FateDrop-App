import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  addFatePulseCardFollow,
  loadFatePulseFollows,
  removeFatePulseCardFollow,
} from '@/services/fate-pulse-follows';

type Props = {
  cardIdentityId: string;
  printingId?: string;
  tcgCode?: string | null;
  name?: string;
  setName?: string;
  collectorNumber?: string;
};

export function FatePulseFollowAction({
  cardIdentityId,
  printingId = '',
  tcgCode = null,
  name = 'Exact card',
  setName = 'Verified set',
  collectorNumber = '',
}: Props) {
  const { snapshot } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [tracked, setTracked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadFatePulseFollows(identity).then((follows) => {
      if (active) setTracked(follows.cards.some((item) => item.cardIdentityId === cardIdentityId));
    });
    return () => { active = false; };
  }, [cardIdentityId, identity]);

  const label = useMemo(() => tracked ? 'TRACKING IN MY PULSE' : 'ADD TO MY PULSE', [tracked]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (tracked) {
        await removeFatePulseCardFollow(identity, cardIdentityId);
        setTracked(false);
      } else {
        await addFatePulseCardFollow(identity, {
          cardIdentityId,
          printingId,
          tcgCode,
          name: name || 'Exact card',
          setName: setName || 'Verified set',
          collectorNumber,
          addedAt: Date.now(),
        });
        setTracked(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.dock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tracked ? 'Remove card from My Pulse' : 'Add card to My Pulse'}
        disabled={busy}
        onPress={() => void toggle()}
        style={({ pressed }) => [styles.primary, tracked && styles.primaryTracked, pressed && styles.pressed]}
      >
        {busy
          ? <ActivityIndicator size="small" color={FateDropColors.background} />
          : <Ionicons name={tracked ? 'star' : 'star-outline'} size={17} color={FateDropColors.background} />}
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>FATEPULSE WATCHLIST</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      </Pressable>
      {tracked ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open My Pulse" onPress={() => router.push('/fate-pulse/my-pulse')} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Ionicons name="pulse-outline" size={17} color={FateDropColors.goldBright} />
          <Text style={styles.secondaryText}>VIEW</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: .45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  primary: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: FateDropColors.goldBright,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
  },
  primaryTracked: { backgroundColor: FateDropColors.manifested },
  copy: { flex: 1 },
  eyebrow: { color: 'rgba(3,8,16,.68)', fontSize: 6.5, fontWeight: '900', letterSpacing: .85 },
  label: { color: FateDropColors.background, fontFamily: Fonts.serif, fontSize: 14.5, marginTop: 2 },
  secondary: {
    width: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,197,141,.48)',
    backgroundColor: 'rgba(4,9,20,.97)',
  },
  secondaryText: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .75 },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },
});
