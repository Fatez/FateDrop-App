import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

type RetailerHealth = { id: string; name: string; healthy: boolean; baselineCompleted?: boolean; productsSeen?: number | null };
type StatusResponse = {
  success?: boolean;
  updatedAt?: string;
  monitor?: { productsTracked?: number; currentlyAvailable?: number; retailers?: number };
  state?: { retailers?: RetailerHealth[] };
};

const metric = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('en-GB');

export default function DashboardScreenV1() {
  const { snapshot, signedIn, refresh, syncing } = useFateDropId();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [network] = await Promise.all([
        fetch(\`${SIGNAL_ENGINE_URL}/api/status\`).then(async (response) => {
          if (!response.ok) throw new Error(\`Status HTTP ${response.status}\`);
          return await response.json() as StatusResponse;
        }),
        signedIn ? refresh().catch(() => null) : Promise.resolve(null),
      ]);
      setStatus(network);
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : 'Dashboard status is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [refresh, signedIn]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const retailers = status?.state?.retailers ?? [];
  const healthy = retailers.filter((retailer) => retailer.healthy && retailer.baselineCompleted !== false).length;
  const attention = Math.max(0, retailers.length - healthy);
  const activeHunts = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const matches = snapshot?.fateMatches?.length ?? 0;
  const healthPercent = retailers.length ? Math.round((healthy / retailers.length) * 100) : null;

  const channelSummary = useMemo(() => {
    if (!snapshot?.notificationPreferences) return 'Sign in to load delivery preferences';
    const channels = [
      snapshot.notificationPreferences.push ? 'App push' : null,
      snapshot.notificationPreferences.discord ? 'Discord' : null,
      snapshot.notificationPreferences.web ? 'Web' : null,
    ].filter(Boolean);
    return channels.length ? channels.join(' · ') : 'No delivery channels enabled';
  }, [snapshot?.notificationPreferences]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading || syncing} onRefresh={() => void load()} tintColor={FateDropColors.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={FateDropColors.ivory} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <FateDropHeader title="App Dashboard" subtitle="LIVE HEALTH & OPTIMISATION VISIBILITY" />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CURRENT TRUTH</Text>
          <Text style={styles.heroTitle}>See what FateDrop is actually doing.</Text>
          <Text style={styles.heroCopy}>This dashboard uses live monitor state and your synced account data. It is visibility for optimisation and QA — not a second intelligence engine.</Text>
          <View style={styles.healthLine}>
            <View style={[styles.healthDot, { backgroundColor: status?.success ? FateDropColors.success : FateDropColors.warning }]} />
            <Text style={[styles.healthText, { color: status?.success ? FateDropColors.success : FateDropColors.warning }]}>
              {status?.success ? 'NETWORK STATUS RECEIVED' : 'NETWORK STATUS UNAVAILABLE'}
            </Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <MetricCard label="PRODUCTS TRACKED" value={metric(status?.monitor?.productsTracked)} />
          <MetricCard label="AVAILABLE NOW" value={metric(status?.monitor?.currentlyAvailable)} />
          <MetricCard label="HEALTHY MONITORS" value={status?.success ? String(healthy) : '—'} />
          <MetricCard label="NETWORK HEALTH" value={healthPercent == null ? '—' : \`${healthPercent}%\`} tone={healthPercent != null && healthPercent < 100 ? FateDropColors.warning : undefined} />
        </View>

        <Section title="Optimisation visibility" eyebrow="SYSTEM">
          <DashboardRow icon="pulse-outline" title="Retailer monitors" detail={status?.success ? \`${healthy} healthy · ${attention} need attention\` : 'Live status unavailable'} onPress={() => router.push('/network')} />
          <DashboardRow icon="radio-outline" title="FateMatch hunts" detail={signedIn ? \`${activeHunts} active · ${matches} synced match result${matches === 1 ? '' : 's'}\` : 'Sign in to inspect personal monitoring'} onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { view: 'matches' } })} />
          <DashboardRow icon="notifications-outline" title="Delivery channels" detail={channelSummary} onPress={() => router.push('/notification-preferences')} />
          <DashboardRow icon="sync-outline" title="Account sync" detail={snapshot ? \`Last synced ${new Date(snapshot.syncedAt * 1000).toLocaleString('en-GB')}\` : 'No account snapshot loaded'} onPress={() => router.push('/account')} />
        </Section>

        <Section title="Current architecture" eyebrow="GUARDRAILS">
          <View style={styles.guardrail}>
            <Ionicons name="cloud-outline" size={20} color={FateDropColors.goldBright} />
            <View style={styles.flex}>
              <Text style={styles.guardrailTitle}>Cloud owns intelligence</Text>
              <Text style={styles.guardrailCopy}>Ranking, RRP/reference evidence, FateMatch qualification and signal lifecycle remain canonical services. The app presents and interacts with that truth.</Text>
            </View>
          </View>
          <View style={styles.guardrail}>
            <Ionicons name="phone-portrait-outline" size={20} color={FateDropColors.goldBright} />
            <View style={styles.flex}>
              <Text style={styles.guardrailTitle}>Mobile owns interaction</Text>
              <Text style={styles.guardrailCopy}>This screen can expose health and QA state, but it should not create competing local monitoring or pricing logic.</Text>
            </View>
          </View>
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionPanel}>{children}</View>
    </View>
  );
}

function DashboardRow({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color={FateDropColors.goldBright} /></View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 100 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  backText: { color: FateDropColors.ivory, fontWeight: '800' },
  hero: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 10 },
  eyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 27, lineHeight: 30, fontWeight: '700', marginTop: 5 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  healthLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  healthDot: { width: 7, height: 7, borderRadius: 4 },
  healthText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48.5%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  metricValue: { color: FateDropColors.ivory, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 4 },
  section: { marginTop: 22 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: FateDropTypography.sectionTitle, fontWeight: '700', marginTop: 3, marginBottom: 9 },
  sectionPanel: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderBottomWidth: 1, borderBottomColor: FateDropColors.borderSoft },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: \`${FateDropColors.gold}0D\`, borderWidth: 1, borderColor: \`${FateDropColors.gold}2E\` },
  rowTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' },
  rowDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  guardrail: { flexDirection: 'row', gap: 11, padding: 14, borderBottomWidth: 1, borderBottomColor: FateDropColors.borderSoft },
  guardrailTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' },
  guardrailCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  error: { color: FateDropColors.error, fontSize: 12, lineHeight: 17, marginTop: 14 },
  flex: { flex: 1 },
  pressed: { opacity: 0.76 },
});
