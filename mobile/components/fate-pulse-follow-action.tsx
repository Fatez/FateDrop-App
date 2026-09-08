import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { appSavedNotice } from '@/services/app-saved-items';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  addFatePulseCardFollow,
  loadFatePulseFollows,
  removeFatePulseCardFollow,
} from '@/services/fate-pulse-follows';

type Props = {
  cardIdentityId: string;
  printingId?: string;
  setId?: string;
  tcgCode?: string | null;
  name?: string;
  setName?: string;
  collectorNumber?: string;
};

export function FatePulseFollowAction({
  cardIdentityId,
  printingId = '',
  setId = '',
  tcgCode = null,
  name = 'Exact card',
  setName = 'Verified set',
  collectorNumber = '',
}: Props) {
  const { snapshot } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const [tracked, setTracked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncNotice, setSyncNotice] = useState('');

  useEffect(() => {
    let active = true;
    void loadFatePulseFollows(identity).then((follows) => {
      if (active) { setTracked(follows.cards.some((item) => item.cardIdentityId === cardIdentityId)); setSyncNotice(appSavedNotice(identity,'insights')); }
    }).catch(() => { if (active) setError('Saved follow could not be loaded.'); });
    return () => { active = false; };
  }, [cardIdentityId, identity]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (tracked) {
        await removeFatePulseCardFollow(identity, cardIdentityId);
        setTracked(false);
      } else {
        await addFatePulseCardFollow(identity, {
          cardIdentityId,
          printingId,
          setId,
          tcgCode,
          name: name || 'Exact card',
          setName: setName || 'Verified set',
          collectorNumber,
          addedAt: Date.now(),
        });
        setTracked(true);
      }
      setSyncNotice(appSavedNotice(identity,'insights'));
    } catch {
      setError('Your follow change was not confirmed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {syncNotice ? <Text style={{color:FateDropColors.secondary,fontSize:12,lineHeight:18}}>{syncNotice}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{color:FateDropColors.coral,fontSize:12,lineHeight:18}}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tracked ? 'Remove this exact card from My Insights' : 'Add this exact card to My Insights'}
        disabled={busy}
        onPress={() => void toggle()}
        style={({ pressed }) => [styles.primary, tracked && styles.primaryTracked, pressed && styles.pressed]}
      >
        <View style={styles.iconWrap}>
          {busy
            ? <ActivityIndicator size="small" color={tracked ? FateDropColors.goldBright : FateDropColors.background} />
            : <Ionicons name={tracked ? 'star' : 'star-outline'} size={19} color={tracked ? FateDropColors.goldBright : FateDropColors.background} />}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, tracked && styles.eyebrowTracked]}>FATEINSIGHT WATCHLIST</Text>
          <Text style={[styles.title, tracked && styles.titleTracked]}>{tracked ? 'Tracking in My Insights' : 'Add to My Insights'}</Text>
          <Text style={[styles.detail, tracked && styles.detailTracked]}>{tracked ? 'This exact card is on your market watchlist.' : 'Follow this exact card’s price and movement.'}</Text>
        </View>
        <Ionicons name={tracked ? 'checkmark-circle' : 'add-circle'} size={20} color={tracked ? FateDropColors.goldBright : FateDropColors.background} />
      </Pressable>

      {tracked ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open My Insights" onPress={() => router.push('/fate-pulse/my-pulse')} style={({ pressed }) => [styles.openAction, pressed && styles.pressed]}>
          <Ionicons name="pulse-outline" size={15} color={FateDropColors.goldBright} />
          <Text style={styles.openText}>VIEW MY INSIGHTS</Text>
          <Ionicons name="arrow-forward" size={14} color={FateDropColors.goldBright} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7, marginTop: 12 },
  primary: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(226,197,141,.76)',
    backgroundColor: FateDropColors.goldBright,
  },
  primaryTracked: {
    borderColor: 'rgba(226,197,141,.52)',
    backgroundColor: 'rgba(8,15,28,.94)',
  },
  iconWrap: { width: 31, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: 'rgba(3,8,16,.62)', fontSize: 6.5, fontWeight: '900', letterSpacing: .85 },
  eyebrowTracked: { color: FateDropColors.goldBright },
  title: { color: FateDropColors.background, fontFamily: Fonts.serif, fontSize: 16, marginTop: 2 },
  titleTracked: { color: FateDropColors.ivory },
  detail: { color: 'rgba(3,8,16,.68)', fontSize: 7.5, lineHeight: 11, marginTop: 3 },
  detailTracked: { color: FateDropColors.secondary },
  openAction: {
    minHeight: 35,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,197,141,.42)',
    backgroundColor: 'rgba(5,11,22,.78)',
  },
  openText: { color: FateDropColors.goldBright, fontSize: 6.8, fontWeight: '900', letterSpacing: .7 },
  pressed: { opacity: .76, transform: [{ scale: .99 }] },
});
