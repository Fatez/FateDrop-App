import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { fetchFatePulse, type FatePulseSnapshot } from '@/services/fate-market';

type MarketTile = {
  key: 'pulse' | 'price' | 'collection';
  title: string;
  eyebrow: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  route: '/fate-pulse' | '/fate-price' | '/collection';
};

const MARKET_TILES: MarketTile[] = [
  {
    key: 'pulse',
    title: 'FatePulse',
    eyebrow: 'MARKET TRENDS',
    detail: "What's moving now",
    icon: 'pulse-outline',
    accent: FateDropColors.manifested,
    route: '/fate-pulse',
  },
  {
    key: 'price',
    title: 'FatePrice',
    eyebrow: 'EXACT CARD VALUE',
    detail: 'Search & value',
    icon: 'pricetag-outline',
    accent: '#8FB7FF',
    route: '/fate-price',
  },
  {
    key: 'collection',
    title: 'Fate Collections',
    eyebrow: 'YOUR COLLECTION',
    detail: 'Own, complete, grow',
    icon: 'albums-outline',
    accent: FateDropColors.goldBright,
    route: '/collection',
  },
];

function movement(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function conditionLabel(value: string | undefined) {
  if (value === 'broadly_rising') return 'BULLISH';
  if (value === 'broadly_falling') return 'COOLING';
  if (value === 'mixed') return 'MIXED';
  if (value === 'unchanged') return 'STABLE';
  return 'BUILDING';
}

export default function FateMarketHubScreen() {
  const [pulse, setPulse] = useState<FatePulseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setPulse(await fetchFatePulse(undefined, { force }));
      setError('');
    } catch {
      setError('Verified market evidence is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const period = pulse?.pulse?.direction?.periods.d30;
  const heat = pulse?.intelligence.marketHeat;
  const volatility = pulse?.intelligence.volatility;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FateDropBackground />
        <Image
          source={require('../assets/images/fate-market-orbital-theme.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top center"
          cachePolicy="disk"
          enforceEarlyResizing
        />
        <View style={styles.veil} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(true)} tintColor={FateDropColors.goldBright} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>FATE MARKET</Text>
            <Text style={styles.title}>Read the market.{`\n`}Know your position.</Text>
            <Text style={styles.subtitle}>Market direction, exact value and your collection — evidence-bound and connected.</Text>
          </View>
          <View style={styles.heroArt}>
            <View style={styles.heroOrbit} />
            <Image source={require('../assets/images/home-orbital-crystal.png')} style={styles.heroCrystal} contentFit="contain" cachePolicy="memory-disk" />
          </View>
        </View>

        <View style={styles.tileRow}>
          {MARKET_TILES.map((tile) => (
            <Pressable
              key={tile.key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tile.title}`}
              onPress={() => router.push(tile.route)}
              style={({ pressed }) => [styles.tile, { borderColor: `${tile.accent}72` }, tile.key === 'pulse' && styles.tileFeatured, pressed && styles.pressed]}
            >
              <View style={[styles.tileIcon, { borderColor: `${tile.accent}72`, backgroundColor: `${tile.accent}12` }]}>
                <Ionicons name={tile.icon} size={25} color={tile.accent} />
              </View>
              <Text style={[styles.tileTitle, { color: tile.accent }]}>{tile.title}</Text>
              <Text style={styles.tileEyebrow}>{tile.eyebrow}</Text>
              <Text style={styles.tileDetail}>{tile.detail}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>MARKET SNAPSHOT</Text>
          {loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}
        </View>

        <View style={styles.snapshotGrid}>
          <SnapshotCard
            label="TRACKED MARKET DIRECTION"
            value={movement(period?.headlinePercent)}
            detail="30D median qualifying set return"
            accent={period?.headlinePercent != null && period.headlinePercent < 0 ? FateDropColors.vanished : FateDropColors.manifested}
            icon="trending-up-outline"
          />
          <SnapshotCard
            label="VOLATILITY"
            value={volatility == null ? 'NOT SCORED' : volatility.toFixed(0)}
            detail={volatility == null ? 'Cloud score not published yet' : 'Cloud-owned score'}
            accent={FateDropColors.goldBright}
            icon="speedometer-outline"
          />
          <SnapshotCard
            label="MARKET HEAT"
            value={heat == null ? 'NOT SCORED' : heat.toFixed(0)}
            detail={heat == null ? 'Cloud score not published yet' : 'Cloud-owned score'}
            accent={FateDropColors.manifested}
            icon="flame-outline"
          />
          <SnapshotCard
            label="MARKET TREND"
            value={conditionLabel(period?.condition)}
            detail={period ? `${period.coverage.qualifyingSets}/${period.coverage.trackedSets} tracked sets qualify` : 'Coverage is building'}
            accent={FateDropColors.manifested}
            icon="analytics-outline"
          />
        </View>

        <View style={styles.moversBlock}>
          <View style={styles.moversHeader}>
            <View>
              <Text style={styles.sectionLabel}>TOP MOVERS · 30D</Text>
              <Text style={styles.moversTitle}>Sets moving now</Text>
            </View>
            <Pressable onPress={() => router.push('/fate-pulse')} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
              <Text style={styles.linkText}>Open Pulse</Text>
              <Ionicons name="arrow-forward" size={14} color={FateDropColors.manifested} />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {(period?.setRisers ?? []).slice(0, 3).map((set, index) => (
            <View key={set.key} style={styles.moverRow}>
              <View style={styles.rankCircle}><Text style={styles.rankText}>{index + 1}</Text></View>
              <View style={styles.moverCopy}>
                <Text numberOfLines={1} style={styles.moverName}>{set.setName || set.setCode || 'Tracked set'}</Text>
                <Text style={styles.moverMeta}>{set.tcgCode?.toUpperCase() || 'TCG'} · verified basket</Text>
              </View>
              <Text style={styles.riserText}>{movement(set.movementPercent)}</Text>
            </View>
          ))}
          {!error && !loading && (period?.setRisers?.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>No qualifying set risers are available for this window yet.</Text>
          ) : null}
        </View>

        <View style={styles.truthBar}>
          <Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>No invented movement. Missing Heat, Volatility, index or watch data stays visibly unscored until Cloud publishes evidence.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SnapshotCard({ label, value, detail, accent, icon }: { label: string; value: string; detail: string; accent: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.snapshotCard}>
      <View style={styles.snapshotTop}>
        <Text style={styles.snapshotLabel}>{label}</Text>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.snapshotValue, { color: accent }]}>{value}</Text>
      <Text style={styles.snapshotDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,16,.64)' },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 122, gap: 14 },
  hero: { minHeight: 154, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(129,94,255,.36)', overflow: 'hidden', backgroundColor: 'rgba(7,13,25,.72)', padding: 17, flexDirection: 'row' },
  heroCopy: { flex: 1, paddingRight: 8, zIndex: 2 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: FateDropColors.text, fontSize: 28, lineHeight: 30, fontWeight: '900', marginTop: 7 },
  subtitle: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 8, maxWidth: 250 },
  heroArt: { width: 120, alignItems: 'center', justifyContent: 'center' },
  heroOrbit: { position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: 'rgba(132,86,255,.55)', shadowColor: FateDropColors.manifested, shadowOpacity: .22, shadowRadius: 16 },
  heroCrystal: { width: 98, height: 98 },
  tileRow: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minHeight: 126, borderRadius: 16, borderWidth: 1, padding: 10, backgroundColor: 'rgba(6,12,23,.88)', alignItems: 'center' },
  tileFeatured: { backgroundColor: 'rgba(35,20,80,.56)' },
  tileIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  tileTitle: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  tileEyebrow: { color: FateDropColors.text, fontSize: 7.5, fontWeight: '900', letterSpacing: .5, textAlign: 'center', marginTop: 4 },
  tileDetail: { color: FateDropColors.muted, fontSize: 8.5, textAlign: 'center', marginTop: 2 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionLabel: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.35 },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  snapshotCard: { width: '48.8%', minHeight: 104, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(8,15,26,.86)', padding: 11 },
  snapshotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  snapshotLabel: { flex: 1, color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: .55 },
  snapshotValue: { fontSize: 21, fontWeight: '900', marginTop: 8 },
  snapshotDetail: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 12, marginTop: 4 },
  moversBlock: { borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(7,14,24,.88)', padding: 12 },
  moversHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  moversTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingLeft: 10 },
  linkText: { color: FateDropColors.manifested, fontSize: 9, fontWeight: '900' },
  moverRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: FateDropColors.borderSoft, gap: 9 },
  rankCircle: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(130,86,255,.14)', borderWidth: 1, borderColor: 'rgba(130,86,255,.34)' },
  rankText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' },
  moverCopy: { flex: 1 },
  moverName: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' },
  moverMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 },
  riserText: { color: FateDropColors.manifested, fontSize: 12, fontWeight: '900' },
  emptyText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 15, paddingVertical: 12 },
  errorText: { color: FateDropColors.vanished, fontSize: 10, lineHeight: 15, paddingVertical: 8 },
  truthBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(228,188,93,.26)', backgroundColor: 'rgba(32,24,10,.26)', padding: 11 },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  pressed: { opacity: .76, transform: [{ scale: .98 }] },
});
