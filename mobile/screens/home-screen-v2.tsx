import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors, FateDropLifecycleColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

type RetailerHealth = { id: string; name: string; healthy: boolean; baselineCompleted?: boolean; productsSeen?: number | null };
type StatusResponse = {
  success?: boolean;
  monitor?: { productsTracked?: number; currentlyAvailable?: number; retailers?: number };
  state?: { retailers?: RetailerHealth[] };
};

const stageLabels: Record<CanonicalAlertStage, string> = {
  WHISPER: 'Whisper',
  ECHO: 'Echo',
  MANIFESTED: 'Manifested',
  VANISHED: 'Vanished',
};

function ago(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recent';
  const mins = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function HomeScreenV2() {
  const { signedIn } = useFateDropId();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, alertResult] = await Promise.allSettled([
        fetch(`${SIGNAL_ENGINE_URL}/api/status`).then(async (response) => {
          if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
          return await response.json() as StatusResponse;
        }),
        signedIn ? fetchCanonicalAlerts(100) : Promise.resolve([]),
      ]);
      setStatus(statusResult.status === 'fulfilled' ? statusResult.value : null);
      setAlerts(alertResult.status === 'fulfilled' ? alertResult.value : []);
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const retailers = status?.state?.retailers ?? [];
  const healthy = retailers.filter((retailer) => retailer.healthy && retailer.baselineCompleted !== false).length;
  const networkMeasured = Boolean(status?.success);
  const networkActive = networkMeasured && healthy > 0;
  const counts = useMemo(() => ({
    WHISPER: alerts.filter((alert) => alert.fateStage === 'WHISPER').length,
    ECHO: alerts.filter((alert) => alert.fateStage === 'ECHO').length,
    MANIFESTED: alerts.filter((alert) => alert.fateStage === 'MANIFESTED').length,
    VANISHED: alerts.filter((alert) => alert.fateStage === 'VANISHED').length,
  }), [alerts]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.gold} />}
      >
        <FateDropHeader
          subtitle="COLLECTOR FIRST"
          rightAction={
            <Pressable onPress={() => router.push('/alerts')} style={styles.headerAlert}>
              <Ionicons name="notifications-outline" size={18} color={FateDropColors.ivory} />
              {alerts.length ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{Math.min(alerts.length, 9)}</Text></View> : null}
            </Pressable>
          }
        />

        <View style={styles.hero}>
          <Image source={require('../assets/images/alert-koru-hero.jpg')} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.networkPill}>
              <View style={[styles.networkDot, !networkActive && styles.networkDotQuiet]} />
              <Text style={[styles.networkText, !networkActive && styles.networkTextQuiet]}>
                {networkActive ? `${healthy} MONITORS HEALTHY` : networkMeasured ? 'NETWORK QUIET / DEGRADED' : 'STATUS UNAVAILABLE'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>Welcome back, Seeker.</Text>
            <Text style={styles.heroCopy}>The signal is always moving. FateDrop keeps the evidence, price context and alerts in one place.</Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>SIGNAL OVERVIEW</Text>
            <Text style={styles.sectionTitle}>Your recent network</Text>
          </View>
          <Pressable onPress={() => router.push('/alerts')}><Text style={styles.sectionAction}>VIEW ALL →</Text></Pressable>
        </View>

        <View style={styles.signalGrid}>
          {(Object.keys(stageLabels) as CanonicalAlertStage[]).map((stage) => (
            <SignalMetric key={stage} stage={stage} count={signedIn ? counts[stage] : null} />
          ))}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>QUICK ACCESS</Text>
            <Text style={styles.sectionTitle}>Collector tools</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickCard
            icon="flash-outline"
            title="ECHO"
            detail="Readiness signals"
            color={FateDropColors.echo}
            onPress={() => router.push({ pathname: '/alerts', params: { stage: 'ECHO' } })}
          />
          <QuickCard
            icon="sparkles-outline"
            title="MANIFESTED"
            detail="Confirmed live drops"
            color={FateDropColors.manifested}
            onPress={() => router.push({ pathname: '/alerts', params: { stage: 'MANIFESTED' } })}
          />
          <QuickCard
            icon="pricetag-outline"
            title="TRUE PRICE"
            detail="Pay the truth"
            color={FateDropColors.gold}
            onPress={() => router.push('/true-price')}
          />
          <QuickCard
            icon="telescope-outline"
            title="FATEFIND"
            detail="Find best value"
            color={FateDropColors.goldBright}
            onPress={() => router.push('/fatefind')}
          />
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>LATEST ACTIVITY</Text>
            <Text style={styles.sectionTitle}>Signals worth seeing</Text>
          </View>
        </View>

        <View style={styles.previewList}>
          {signedIn && alerts.length ? alerts.slice(0, 4).map((alert) => <AlertPreview key={alert.id} alert={alert} />) : (
            <View style={styles.emptyPreview}>
              <Ionicons name={signedIn ? 'radio-outline' : 'person-circle-outline'} size={22} color={FateDropColors.gold} />
              <View style={styles.flex}>
                <Text style={styles.emptyTitle}>{signedIn ? 'No recent canonical alerts' : 'Sign in for your alert history'}</Text>
                <Text style={styles.emptyCopy}>{signedIn ? 'FateDrop keeps the feed quiet when nothing has met alert policy.' : 'Your canonical alert history follows your FateDrop ID.'}</Text>
              </View>
            </View>
          )}
        </View>

        <Pressable onPress={() => router.push('/network')} style={({ pressed }) => [styles.networkCard, pressed && styles.pressed]}>
          <View style={styles.networkCardIcon}><Ionicons name="pulse-outline" size={21} color={networkActive ? FateDropColors.success : FateDropColors.warning} /></View>
          <View style={styles.flex}>
            <Text style={styles.networkCardEyebrow}>NETWORK HEALTH</Text>
            <Text style={styles.networkCardTitle}>{networkActive ? 'Evidence is flowing.' : 'Inspect source health.'}</Text>
            <Text style={styles.networkCardCopy}>See which retailer monitors are live, healthy, pending or degraded.</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={FateDropColors.gold} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SignalMetric({ stage, count }: { stage: CanonicalAlertStage; count: number | null }) {
  const color = FateDropLifecycleColors[stage];
  return (
    <Pressable onPress={() => router.push({ pathname: '/alerts', params: { stage } })} style={({ pressed }) => [styles.signalMetric, pressed && styles.pressed]}>
      <View style={[styles.signalGlyph, { borderColor: `${color}55` }]}><View style={[styles.signalDot, { backgroundColor: color }]} /></View>
      <Text style={styles.signalValue}>{count == null ? '—' : count}</Text>
      <Text style={[styles.signalLabel, { color }]}>{stageLabels[stage].toUpperCase()}</Text>
    </Pressable>
  );
}

function QuickCard({ icon, title, detail, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, { borderColor: `${color}48` }, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, { borderColor: `${color}55`, backgroundColor: `${color}10` }]}><Ionicons name={icon} size={24} color={color} /></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickDetail}>{detail}</Text>
    </Pressable>
  );
}

function AlertPreview({ alert }: { alert: CanonicalMobileAlert }) {
  const color = FateDropLifecycleColors[alert.fateStage];
  return (
    <Pressable onPress={() => router.push({ pathname: '/alerts', params: { stage: alert.fateStage } })} style={({ pressed }) => [styles.preview, pressed && styles.pressed]}>
      {alert.product.imageUrl ? <Image source={{ uri: alert.product.imageUrl }} style={styles.previewImage} contentFit="cover" /> : <View style={styles.previewImageFallback}><Ionicons name="cube-outline" size={19} color={FateDropColors.secondary} /></View>}
      <View style={styles.flex}>
        <View style={styles.previewMeta}><Text style={[styles.previewStage, { color }]}>{stageLabels[alert.fateStage].toUpperCase()}</Text><Text style={styles.previewTime}>{ago(alert.detectedAt)}</Text></View>
        <Text style={styles.previewTitle} numberOfLines={1}>{alert.product.title || alert.title}</Text>
        <Text style={styles.previewRetailer} numberOfLines={1}>{alert.retailer}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  headerAlert: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, alignItems: 'center', justifyContent: 'center' },
  headerBadge: { position: 'absolute', right: -3, top: -3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: FateDropColors.vanished, alignItems: 'center', justifyContent: 'center' },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  hero: { height: 300, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: FateDropColors.card, marginBottom: 22 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,8,12,.43)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 20, maxWidth: 360 },
  networkPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.success}55`, backgroundColor: 'rgba(8,14,20,.68)', marginBottom: 10 },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: FateDropColors.success },
  networkDotQuiet: { backgroundColor: FateDropColors.warning },
  networkText: { color: FateDropColors.success, fontSize: 11, fontWeight: '900', letterSpacing: .7 },
  networkTextQuiet: { color: FateDropColors.warning },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 31, lineHeight: 34, fontWeight: '700' },
  heroCopy: { color: FateDropColors.ivory, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 330 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: FateDropTypography.sectionTitle, fontWeight: '700', marginTop: 3 },
  sectionAction: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900' },
  signalGrid: { flexDirection: 'row', gap: 7, marginBottom: 24 },
  signalMetric: { flex: 1, minHeight: 91, paddingVertical: 11, paddingHorizontal: 7, alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  signalGlyph: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  signalDot: { width: 7, height: 7, borderRadius: 4 },
  signalValue: { color: FateDropColors.ivory, fontSize: 21, fontWeight: '900' },
  signalLabel: { fontSize: 9, fontWeight: '900', letterSpacing: .5, marginTop: 2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 24 },
  quickCard: { width: '48.5%', minHeight: 142, alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 18, borderWidth: 1, backgroundColor: FateDropColors.surface },
  quickIcon: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  quickDetail: { color: FateDropColors.secondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
  previewList: { gap: 8, marginBottom: 18 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 76, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  previewImage: { width: 52, height: 52, borderRadius: 11, backgroundColor: FateDropColors.card },
  previewImageFallback: { width: 52, height: 52, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.card },
  previewMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  previewStage: { fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  previewTime: { color: FateDropColors.muted, fontSize: 11 },
  previewTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 3 },
  previewRetailer: { color: FateDropColors.secondary, fontSize: 12, marginTop: 3 },
  emptyPreview: { flexDirection: 'row', gap: 11, alignItems: 'center', padding: 16, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  emptyTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  networkCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  networkCardIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.card },
  networkCardEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: .9 },
  networkCardTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900', marginTop: 2 },
  networkCardCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  flex: { flex: 1 },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },
});
