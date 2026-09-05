import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchFateCollectorCollection, type FateCollectorItem } from '@/services/fate-collector';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function collectorSort(left: FateCollectorItem, right: FateCollectorItem) {
  const a = left.card;
  const b = right.card;
  return String(a?.setName || '').localeCompare(String(b?.setName || ''))
    || String(a?.collectorNumber || '').localeCompare(String(b?.collectorNumber || ''), undefined, { numeric: true })
    || String(a?.name || left.fateCardId).localeCompare(String(b?.name || right.fateCardId));
}

export default function FateCollectionBrowserScreen() {
  const params = useLocalSearchParams<{ setId?: string | string[]; setName?: string | string[] }>();
  const requestedSetId = first(params.setId)?.trim() || null;
  const requestedSetName = first(params.setName)?.trim() || null;
  const [items, setItems] = useState<FateCollectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snapshot = await fetchFateCollectorCollection();
      setItems(snapshot.items.slice().sort(collectorSort));
    } catch {
      setError('Your collection could not be loaded safely right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const visibleItems = useMemo(() => requestedSetId
    ? items.filter((item) => item.card?.setId === requestedSetId)
    : items, [items, requestedSetId]);

  const setCount = useMemo(() => new Set(items.map((item) => item.card?.setId).filter(Boolean)).size, [items]);
  const copyCount = useMemo(() => visibleItems.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0), [visibleItems]);
  const title = requestedSetName || (requestedSetId ? 'Set collection' : 'Your collection');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <Image source={require('../assets/images/fate-market-orbital-theme.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top center" cachePolicy="disk" />
        <View style={styles.veil} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.echo} />}
      >
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={18} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{requestedSetId ? 'SET BINDER' : 'FATE COLLECTOR'}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.copy}>{requestedSetId ? 'Every exact card you own in this set.' : 'Every exact card currently attached to your FateDrop ID.'}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric label="OWNED LINES" value={String(visibleItems.length)} />
          <Metric label="COPIES" value={String(copyCount)} />
          {!requestedSetId ? <Metric label="SETS" value={String(setCount)} /> : null}
        </View>

        {loading && !items.length ? <View style={styles.state}><ActivityIndicator color={FateDropColors.echo} /><Text style={styles.stateText}>Reading your collection…</Text></View> : null}
        {error ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={18} color={FateDropColors.vanished} /><Text style={styles.stateText}>{error}</Text></View> : null}
        {!loading && !error && !visibleItems.length ? <View style={styles.state}><Ionicons name="albums-outline" size={18} color={FateDropColors.muted} /><Text style={styles.stateText}>No owned cards are recorded here yet.</Text></View> : null}

        <View style={styles.grid}>
          {visibleItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open FatePrice for ${item.card?.name || 'owned card'}`}
              onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: item.card?.name || undefined, collectorNumber: item.card?.collectorNumber || undefined, setId: item.card?.setId || undefined, setName: item.card?.setName || undefined, tcg: item.card?.tcgCode || undefined } })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}><Ionicons name="layers-outline" size={16} color={FateDropColors.echo} /></View>
                <Text style={styles.quantity}>×{item.quantity}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{item.card?.name || 'Verified card'}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{item.card?.setName || 'Verified set'}</Text>
              <Text style={styles.cardMeta}>#{item.card?.collectorNumber || '—'} · {item.card?.variantCode || 'standard'}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.condition}>{item.copyState === 'graded' ? 'GRADED' : (item.conditionCode || 'RAW').toUpperCase()}</Text>
                <Ionicons name="chevron-forward" size={13} color={FateDropColors.muted} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={15} color={FateDropColors.goldBright} />
          <Text style={styles.noteText}>Collection rows use the same verified exact-card identity layer as FatePrice. Card artwork is not shown until a licensed/approved image source is attached to the canonical catalogue.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,18,.58)' },
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  headerCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 28, lineHeight: 33, marginTop: 4 },
  copy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 18 },
  metric: { flex: 1, minHeight: 64, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,9,20,.62)' },
  metricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20 },
  metricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .8, marginTop: 4 },
  state: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateText: { color: FateDropColors.secondary, fontSize: 10, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  card: { width: '48.4%', minHeight: 170, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, borderRadius: 18, backgroundColor: 'rgba(5,9,20,.72)' },
  pressed: { opacity: .72 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}66`, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.echo}10` },
  quantity: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15, lineHeight: 18, marginTop: 14 },
  cardMeta: { color: FateDropColors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
  cardFooter: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  condition: { color: FateDropColors.echo, fontSize: 7, fontWeight: '900', letterSpacing: .55 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 24, paddingTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: FateDropColors.borderSoft },
  noteText: { flex: 1, color: FateDropColors.muted, fontSize: 8, lineHeight: 12 },
});
