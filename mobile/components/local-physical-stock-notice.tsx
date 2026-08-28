import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import type { RadarShop } from '@/services/local-radar-intelligence';

const SEEN_PREFIX = 'fatedrop:local-physical-alert-seen:v1:';

type ConfirmedProjection = NonNullable<NonNullable<RadarShop['localAvailability']>['confirmed']> & {
  alertId?: string | null;
};

type Notice = {
  id: string;
  shop: RadarShop;
  confirmed: ConfirmedProjection;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function confirmedProjection(shop: RadarShop): ConfirmedProjection | null {
  const confirmed = shop.localAvailability?.confirmed as ConfirmedProjection | null | undefined;
  if (!confirmed || shop.localAvailability?.status !== 'confirmed') return null;
  return confirmed;
}

function storageKey(id: string) {
  return `${SEEN_PREFIX}${id}`;
}

function observedLabel(value: string | null | undefined) {
  if (!value) return 'Confirmed recently';
  const observedAt = new Date(value).getTime();
  if (!Number.isFinite(observedAt)) return 'Confirmed recently';
  const minutes = Math.max(0, Math.floor((Date.now() - observedAt) / 60_000));
  if (minutes < 1) return 'Confirmed just now';
  if (minutes < 60) return `Confirmed ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `Confirmed ${hours} hr${hours === 1 ? '' : 's'} ago`;
}

export function LocalPhysicalStockNotice({ shops, onOpen }: { shops: RadarShop[]; onOpen: (shop: RadarShop) => void }) {
  const candidates = useMemo(() => shops.flatMap((shop) => {
    const confirmed = confirmedProjection(shop);
    const id = clean(confirmed?.alertId);
    return confirmed && id ? [{ id, shop, confirmed }] : [];
  }), [shops]);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!candidates.length) {
        if (!cancelled) setNotice(null);
        return;
      }
      const stored = await AsyncStorage.multiGet(candidates.map((candidate) => storageKey(candidate.id))).catch(() => [] as [string, string | null][]);
      const seen = new Set(stored.filter(([, value]) => value === '1').map(([key]) => key));
      const next = candidates.find((candidate) => !seen.has(storageKey(candidate.id))) || null;
      if (!cancelled) setNotice(next);
    })();
    return () => { cancelled = true; };
  }, [candidates]);

  if (!notice) return null;

  const acknowledge = async () => {
    await AsyncStorage.setItem(storageKey(notice.id), '1').catch(() => undefined);
    setNotice(null);
  };

  return <View testID="local-physical-stock-notice" style={styles.card}>
    <View style={styles.icon}><Ionicons name="storefront" size={20} color={FateDropColors.mint}/></View>
    <View style={styles.copy}>
      <Text style={styles.eyebrow}>LOCAL RADAR ALERT</Text>
      <Text style={styles.title}>Physical stock confirmed nearby</Text>
      <Text style={styles.detail}>{notice.confirmed.title || 'Pokémon stock'} · {notice.shop.name}</Text>
      <Text style={styles.confirmed}>{observedLabel(notice.confirmed.observedAt)}</Text>
      <Text style={styles.advisory}>Exact-branch physical availability was verified by FateDrop. Stock can still move quickly.</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => void acknowledge()} style={styles.dismiss}><Text style={styles.dismissText}>Got it</Text></Pressable>
        <Pressable onPress={() => void (async () => { await acknowledge(); onOpen(notice.shop); })()} style={styles.open}>
          <Text style={styles.openText}>View store</Text><Ionicons name="chevron-forward" size={14} color={FateDropColors.text}/>
        </Pressable>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 11, padding: 14, marginTop: 12, borderRadius: 17, backgroundColor: `${FateDropColors.mint}10`, borderWidth: 1, borderColor: `${FateDropColors.mint}38` },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.mint}14` },
  copy: { flex: 1 },
  eyebrow: { color: FateDropColors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  detail: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  confirmed: { color: FateDropColors.mint, fontSize: 10, fontWeight: '900', marginTop: 4 },
  advisory: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 7, marginTop: 10 },
  dismiss: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: FateDropColors.cardElevated },
  dismissText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900' },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: FateDropColors.violet },
  openText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' },
});
