import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

type RetailerHealth = { id: string; name: string; healthy: boolean; baselineCompleted?: boolean; productsSeen?: number | null };
type StatusResponse = {
  success?: boolean;
  monitor?: { productsTracked?: number; currentlyAvailable?: number; retailers?: number };
  state?: { retailers?: RetailerHealth[] };
};

const stageColor: Record<CanonicalAlertStage, string> = {
  WHISPER: FateDropColors.cyan,
  ECHO: FateDropColors.violetLight,
  MANIFESTED: FateDropColors.mint,
  VANISHED: FateDropColors.coral,
};

function metric(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('en-GB');
}

function ago(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recent';
  const mins = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function QuickAction({ icon, label, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons name={icon} size={19} color={FateDropColors.violetLight} /></View><View style={styles.actionCopy}><Text style={styles.actionLabel}>{label}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} /></Pressable>;
}

function AlertPreview({ alert }: { alert: CanonicalMobileAlert }) {
  const color = stageColor[alert.fateStage];
  return <Pressable onPress={() => router.push('/alerts')} style={({ pressed }) => [styles.preview, pressed && styles.pressed]}><View style={[styles.previewBar, { backgroundColor: color }]} /><View style={styles.previewCopy}><View style={styles.previewMeta}><Text style={[styles.previewStage, { color }]}>{alert.fateStage}</Text><Text style={styles.previewTime}>{ago(alert.detectedAt)}</Text></View><Text style={styles.previewTitle} numberOfLines={1}>{alert.product.title || alert.title}</Text><Text style={styles.previewRetailer} numberOfLines={1}>{alert.retailer}</Text></View><Ionicons name="arrow-forward" size={15} color={FateDropColors.secondary} /></Pressable>;
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
        signedIn ? fetchCanonicalAlerts(4) : Promise.resolve([]),
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

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.violetLight} />}>
    <FateDropHeader subtitle="TCG SIGNAL INTELLIGENCE" rightAction={<Pressable onPress={() => router.push('/alerts')} style={styles.headerAlert}><Ionicons name="notifications-outline" size={18} color={FateDropColors.text} />{alerts.length ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{Math.min(alerts.length, 9)}</Text></View> : null}</Pressable>} />

    <View style={styles.hero}>
      <Image source={require('@/assets/images/fatedropheader.png')} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={styles.heroShade} />
      <View style={styles.heroContent}>
        <View style={styles.networkPill}><View style={[styles.networkDot, !networkActive && styles.networkDotQuiet]} /><Text style={[styles.networkText, !networkActive && styles.networkTextQuiet]}>{networkActive ? `${healthy} MONITORS HEALTHY` : networkMeasured ? 'NETWORK QUIET / DEGRADED' : 'STATUS UNAVAILABLE'}</Text></View>
        <Text style={styles.heroTitle}>See the move before the crowd does.</Text>
        <Text style={styles.heroCopy}>Live retailer evidence, RRP-aware pricing and one alert history across FateDrop.</Text>
        <Pressable onPress={() => router.push('/search')} style={styles.heroButton}><Text style={styles.heroButtonText}>SEARCH THE NETWORK</Text><Ionicons name="arrow-forward" size={15} color={FateDropColors.text} /></Pressable>
      </View>
    </View>

    <View style={styles.metricRow}>
      <View style={styles.metricCard}><Text style={styles.metricValue}>{metric(status?.monitor?.productsTracked)}</Text><Text style={styles.metricLabel}>PRODUCTS</Text></View>
      <View style={styles.metricCard}><Text style={styles.metricValue}>{metric(status?.monitor?.currentlyAvailable)}</Text><Text style={styles.metricLabel}>AVAILABLE</Text></View>
      <View style={styles.metricCard}><Text style={styles.metricValue}>{networkMeasured ? healthy : '—'}</Text><Text style={styles.metricLabel}>HEALTHY</Text></View>
    </View>

    <View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>YOUR ALERT NETWORK</Text><Text style={styles.sectionTitle}>Latest alerts</Text></View><Pressable onPress={() => router.push('/alerts')}><Text style={styles.sectionAction}>VIEW ALL →</Text></Pressable></View>
    <View style={styles.previewList}>
      {signedIn && alerts.length ? alerts.map((alert) => <AlertPreview key={alert.id} alert={alert} />) : <View style={styles.emptyPreview}><Ionicons name={signedIn ? 'radio-outline' : 'person-circle-outline'} size={21} color={FateDropColors.secondary} /><View style={styles.actionCopy}><Text style={styles.emptyTitle}>{signedIn ? 'No recent canonical alerts' : 'Sign in for synced alert history'}</Text><Text style={styles.emptyCopy}>{signedIn ? 'The network can be active without creating an alert. FateDrop keeps those concepts separate.' : 'Your app, dashboard and Discord alert history follows your FateDrop ID.'}</Text></View></View>}
    </View>

    <View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>CORE TOOLS</Text><Text style={styles.sectionTitle}>Collector command centre</Text></View></View>
    <View style={styles.actions}>
      <QuickAction icon="search-outline" label="Search" detail="Find products across connected retailers." onPress={() => router.push('/search')} />
      <QuickAction icon="swap-horizontal-outline" label="True Price" detail="Compare item price, RRP and known delivery." onPress={() => router.push('/true-price')} />
      <QuickAction icon="telescope-outline" label="FateFind" detail="Save a product hunt and let FateDrop watch it." onPress={() => router.push('/fatefind')} />
      <QuickAction icon="storefront-outline" label="Independents" detail="Discover connected independent TCG retailers." onPress={() => router.push('/indies')} />
    </View>

    <View style={styles.networkCard}>
      <View style={styles.networkCardHead}><View><Text style={styles.sectionEyebrow}>NETWORK HEALTH</Text><Text style={styles.networkCardTitle}>{networkActive ? 'Evidence is flowing.' : 'Some sources need attention.'}</Text></View><Ionicons name="pulse-outline" size={22} color={networkActive ? FateDropColors.mint : FateDropColors.amber} /></View>
      <Text style={styles.networkCardCopy}>FateDrop only labels a monitor healthy when the live service reports it that way. Blocked or stale retailers are not presented as working coverage.</Text>
      <Pressable onPress={() => router.push('/more')} style={styles.networkLink}><Text style={styles.networkLinkText}>OPEN NETWORK TOOLS</Text><Ionicons name="arrow-forward" size={14} color={FateDropColors.cyan} /></Pressable>
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, scroll: { flex: 1, backgroundColor: 'transparent' }, content: { paddingHorizontal: 18, paddingBottom: 120 },
  headerAlert: { width: 39, height: 39, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, alignItems: 'center', justifyContent: 'center' }, headerBadge: { position: 'absolute', right: -3, top: -3, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: FateDropColors.coral, alignItems: 'center', justifyContent: 'center' }, headerBadgeText: { color: '#fff', fontSize: 7, fontWeight: '900' },
  hero: { height: 290, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,85,247,.22)', backgroundColor: FateDropColors.card, marginBottom: 12 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,5,10,.48)' }, heroContent: { flex: 1, justifyContent: 'flex-end', padding: 21, maxWidth: 360 }, networkPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.mint}45`, backgroundColor: `${FateDropColors.mint}10`, marginBottom: 10 }, networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint }, networkDotQuiet: { backgroundColor: FateDropColors.amber }, networkText: { color: FateDropColors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, networkTextQuiet: { color: FateDropColors.amber }, heroTitle: { color: FateDropColors.text, fontSize: 31, lineHeight: 33, fontWeight: '900', letterSpacing: -1 }, heroCopy: { color: '#D1D5DF', fontSize: 11, lineHeight: 17, fontWeight: '600', marginTop: 9, maxWidth: 315 }, heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(124,58,237,.88)' }, heroButtonText: { color: FateDropColors.text, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 24 }, metricCard: { flex: 1, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.88)' }, metricValue: { color: FateDropColors.text, fontSize: 19, fontWeight: '900' }, metricLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 9 }, sectionEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, sectionTitle: { color: FateDropColors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.4, marginTop: 3 }, sectionAction: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900' },
  previewList: { gap: 8, marginBottom: 25 }, preview: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden', minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' }, previewBar: { width: 3, alignSelf: 'stretch' }, previewCopy: { flex: 1, padding: 12 }, previewMeta: { flexDirection: 'row', justifyContent: 'space-between' }, previewStage: { fontSize: 7, fontWeight: '900', letterSpacing: 1 }, previewTime: { color: FateDropColors.muted, fontSize: 7 }, previewTitle: { color: FateDropColors.text, fontSize: 11, fontWeight: '900', marginTop: 3 }, previewRetailer: { color: FateDropColors.secondary, fontSize: 8, marginTop: 3 }, emptyPreview: { flexDirection: 'row', gap: 11, alignItems: 'center', padding: 16, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.82)' }, emptyTitle: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  actions: { gap: 8, marginBottom: 24 }, action: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' }, actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}12` }, actionCopy: { flex: 1 }, actionLabel: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' }, actionDetail: { color: FateDropColors.secondary, fontSize: 9, marginTop: 3 },
  networkCard: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(9,10,17,.92)' }, networkCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, networkCardTitle: { color: FateDropColors.text, fontSize: 18, fontWeight: '900', marginTop: 4 }, networkCardCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 9 }, networkLink: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', marginTop: 14 }, networkLinkText: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
