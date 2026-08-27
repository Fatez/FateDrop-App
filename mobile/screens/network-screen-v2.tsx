import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';

type RetailerMonitoring = {
  configured?: boolean;
  healthy?: boolean;
  stale?: boolean;
  baselineCompleted?: boolean;
  productsSeen?: number | null;
};

type RetailerDirectoryEntry = {
  id: string;
  name: string;
  monitoring?: RetailerMonitoring | null;
};

type RetailerDirectoryResponse = {
  success?: boolean;
  retailers?: RetailerDirectoryEntry[];
};

type RetailerHealth = {
  id: string;
  name: string;
  healthy: boolean;
  stale: boolean;
  baselineCompleted: boolean;
  productsSeen: number | null;
};

function healthLabel(retailer: RetailerHealth) {
  if (retailer.stale) return { label: 'STALE', color: FateDropColors.warning };
  if (!retailer.baselineCompleted) return { label: 'BASELINE PENDING', color: FateDropColors.warning };
  if (retailer.healthy) return { label: 'LIVE & HEALTHY', color: FateDropColors.success };
  return { label: 'NEEDS ATTENTION', color: FateDropColors.error };
}

function publicRetailerHealth(entry: RetailerDirectoryEntry): RetailerHealth {
  const monitoring = entry.monitoring ?? null;
  return {
    id: String(entry.id),
    name: String(entry.name),
    healthy: monitoring?.healthy === true && monitoring?.stale !== true && monitoring?.baselineCompleted === true,
    stale: monitoring?.stale === true,
    baselineCompleted: monitoring?.baselineCompleted === true,
    productsSeen: typeof monitoring?.productsSeen === 'number' && Number.isFinite(monitoring.productsSeen) ? monitoring.productsSeen : null,
  };
}

export default function NetworkScreenV2() {
  const [retailerRows, setRetailerRows] = useState<RetailerHealth[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SIGNAL_ENGINE_URL}/api/retailers`);
      if (!response.ok) throw new Error(`Retailer coverage HTTP ${response.status}`);
      const payload = await response.json() as RetailerDirectoryResponse;
      if (payload.success !== true || !Array.isArray(payload.retailers)) {
        throw new Error('Unsupported retailer coverage response.');
      }
      setRetailerRows(payload.retailers
        .filter((entry) => Boolean(entry?.id && entry?.name))
        .map(publicRetailerHealth));
      setLoaded(true);
    } catch (cause) {
      setRetailerRows([]);
      setLoaded(false);
      setError(cause instanceof Error ? cause.message : 'Network coverage is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const retailers = useMemo(() => {
    return [...retailerRows].sort((a, b) => {
      const score = (item: RetailerHealth) => item.healthy ? 0 : !item.baselineCompleted ? 1 : item.stale ? 2 : 3;
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });
  }, [retailerRows]);

  const healthy = retailers.filter((retailer) => retailer.healthy).length;
  const baselined = retailers.filter((retailer) => retailer.baselineCompleted).length;
  const attention = retailers.length - healthy;
  const networkHealthy = loaded && retailers.length > 0 && attention === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <FateDropHeader title="Live Network" subtitle="RETAILER COVERAGE & MONITOR HEALTH" />

        <View style={styles.hero}>
          <View style={styles.heroOrnament} />
          <Text style={styles.eyebrow}>FATEDROP LIVE NETWORK</Text>
          <Text style={styles.title}>{networkHealthy ? 'The network is listening.' : loaded ? 'Network coverage needs attention.' : 'Network coverage is unavailable.'}</Text>
          <Text style={styles.copy}>Public monitor coverage only. FateDrop does not present stale, blocked or unfinished sources as healthy coverage, and monitor health is never treated as proof of stock.</Text>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: networkHealthy ? FateDropColors.success : FateDropColors.warning }]} />
            <Text style={[styles.statusText, { color: networkHealthy ? FateDropColors.success : FateDropColors.warning }]}>
              {networkHealthy ? `${healthy} MONITORS LIVE & HEALTHY` : loaded ? 'PARTIAL / DEGRADED COVERAGE' : 'STATUS UNAVAILABLE'}
            </Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric label="MONITORS" value={loaded ? String(retailers.length) : '—'} />
          <Metric label="HEALTHY" value={loaded ? String(healthy) : '—'} />
          <Metric label="BASELINED" value={loaded ? String(baselined) : '—'} />
          <Metric label="ATTENTION" value={loaded ? String(attention) : '—'} tone={attention > 0 ? FateDropColors.warning : undefined} />
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>RETAILER MONITORS</Text>
            <Text style={styles.sectionTitle}>Live source health</Text>
          </View>
          <Pressable onPress={() => router.push('/indies')}><Text style={styles.link}>STORES →</Text></Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={20} color={FateDropColors.warning} />
            <View style={styles.flex}>
              <Text style={styles.errorTitle}>Could not read live monitor coverage</Text>
              <Text style={styles.errorCopy}>{error}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.list}>
          {retailers.map((retailer) => {
            const state = healthLabel(retailer);
            return (
              <View key={retailer.id} style={styles.row}>
                <View style={[styles.icon, { borderColor: `${state.color}55` }]}>
                  <Ionicons name="storefront-outline" size={18} color={state.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.retailerName}>{retailer.name}</Text>
                  <Text style={styles.retailerDetail}>
                    {retailer.productsSeen == null ? 'Observation count unavailable' : `${retailer.productsSeen.toLocaleString('en-GB')} products observed`}
                  </Text>
                </View>
                <View style={styles.health}>
                  <View style={[styles.healthDot, { backgroundColor: state.color }]} />
                  <Text style={[styles.healthText, { color: state.color }]}>{state.label}</Text>
                </View>
              </View>
            );
          })}
          {!loading && !error && !retailers.length ? (
            <View style={styles.empty}>
              <Ionicons name="pulse-outline" size={22} color={FateDropColors.secondary} />
              <Text style={styles.emptyTitle}>No monitor coverage rows returned</Text>
              <Text style={styles.emptyCopy}>The app will leave this empty rather than invent healthy coverage.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={20} color={FateDropColors.gold} />
          <View style={styles.flex}>
            <Text style={styles.noteTitle}>Collector-first evidence</Text>
            <Text style={styles.noteCopy}>Healthy means FateDrop's public retailer contract reports a fresh, baselined monitor. It is not a stock claim and it does not expose private operational diagnostics.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  heroOrnament: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -65, top: -90, borderWidth: 1, borderColor: `${FateDropColors.gold}28` },
  eyebrow: { color: FateDropColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 28, lineHeight: 32, fontWeight: '700', marginTop: 7, maxWidth: 330 },
  copy: { color: FateDropColors.secondary, fontSize: 14, lineHeight: 20, marginTop: 9 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  metric: { width: '48.5%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  metricValue: { color: FateDropColors.ivory, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: FateDropColors.muted, fontSize: 11, fontWeight: '900', letterSpacing: .8, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: FateDropTypography.sectionTitle, fontWeight: '700', marginTop: 3 },
  link: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900' },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, backgroundColor: FateDropColors.card },
  flex: { flex: 1 },
  retailerName: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  retailerDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  health: { maxWidth: 112, alignItems: 'flex-end' },
  healthDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  healthText: { fontSize: 10, lineHeight: 13, textAlign: 'right', fontWeight: '900' },
  errorCard: { flexDirection: 'row', gap: 10, padding: 14, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.warning}55`, backgroundColor: `${FateDropColors.warning}0E` },
  errorTitle: { color: FateDropColors.warning, fontSize: 14, fontWeight: '900' },
  errorCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  empty: { alignItems: 'center', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  emptyTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 8 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  note: { flexDirection: 'row', gap: 11, marginTop: 16, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  noteTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' },
  noteCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
