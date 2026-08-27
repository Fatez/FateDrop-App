import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import { expectedStockForShop, type RadarShop } from '@/services/local-radar-intelligence';

const SEEN_PREFIX = 'fatedrop:local-intel-seen:v1:';

type ExpectedProjection = NonNullable<NonNullable<RadarShop['localAvailability']>['expected']> & {
  intelId?: string | null;
};

type Notice = {
  id: string;
  shop: RadarShop;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function localIntelId(shop: RadarShop) {
  const expected = shop.localAvailability?.expected as ExpectedProjection | null | undefined;
  if (!expected) return null;
  if (clean(expected.intelId)) return clean(expected.intelId);

  // Backward-compatible deterministic key while older Cloud instances age out.
  // Deliberately excludes branch identity so one retailer-wide intelligence item
  // is acknowledged once rather than once for every participating store.
  const parts = [
    clean(expected.productIdentityId) || clean(expected.title),
    clean(expected.expectedFrom),
    clean(expected.expectedTo),
    clean(expected.expectedLabel),
    clean(expected.sourceUrl) || clean(expected.sourceLabel),
  ];
  if (!parts.some(Boolean)) return null;
  return `legacy:${encodeURIComponent(parts.join('|'))}`;
}

function storageKey(id: string) {
  return `${SEEN_PREFIX}${id}`;
}

export function LocalIntelNotice({ shops, onOpen }: { shops: RadarShop[]; onOpen: (shop: RadarShop) => void }) {
  const candidates = useMemo(() => {
    const seenIds = new Set<string>();
    return shops.flatMap((shop) => {
      const id = localIntelId(shop);
      if (!id || !shop.localAvailability?.expected || seenIds.has(id)) return [];
      seenIds.add(id);
      return [{ id, shop }];
    });
  }, [shops]);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!candidates.length) {
        if (!cancelled) setNotice(null);
        return;
      }
      const stored = await AsyncStorage.multiGet(candidates.map((candidate) => storageKey(candidate.id))).catch(() => [] as [string, string | null][]);
      const acknowledged = new Set(stored.filter(([, value]) => value === '1').map(([key]) => key));
      const next = candidates.find((candidate) => !acknowledged.has(storageKey(candidate.id))) || null;
      if (!cancelled) setNotice(next);
    })();
    return () => { cancelled = true; };
  }, [candidates]);

  if (!notice) return null;
  const expected = expectedStockForShop(notice.shop);
  if (!expected) return null;

  const acknowledge = async () => {
    await AsyncStorage.setItem(storageKey(notice.id), '1').catch(() => undefined);
    setNotice(null);
  };

  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name="radio-outline" size={20} color={FateDropColors.cyan}/></View>
    <View style={styles.copy}>
      <Text style={styles.eyebrow}>LOCAL RADAR UPDATE</Text>
      <Text style={styles.title}>Expected stock nearby</Text>
      <Text style={styles.detail}>{expected.title} · {notice.shop.name}</Text>
      {expected.label ? <Text style={styles.date}>{expected.label}</Text> : null}
      <Text style={styles.advisory}>Expected stock is advisory and may change. Check with the retailer before travelling.</Text>
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
  card: { flexDirection: 'row', gap: 11, padding: 14, marginTop: 12, borderRadius: 17, backgroundColor: `${FateDropColors.cyan}10`, borderWidth: 1, borderColor: `${FateDropColors.cyan}35` },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}14` },
  copy: { flex: 1 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  detail: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  date: { color: FateDropColors.cyan, fontSize: 10, fontWeight: '900', marginTop: 4 },
  advisory: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 7, marginTop: 10 },
  dismiss: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: FateDropColors.cardElevated },
  dismissText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900' },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: FateDropColors.violet },
  openText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' },
});
