import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { API_BASE_URL, SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors, FateDropLifecycleColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

type RetailerHealth = { id: string; name: string; healthy: boolean; baselineCompleted?: boolean; productsSeen?: number | null };
type StatusResponse = {
  success?: boolean;
  monitor?: { productsTracked?: number; currentlyAvailable?: number; retailers?: number };
  state?: { retailers?: RetailerHealth[] };
};
type HomeEvent = { id: string; name: string; startDateTime?: string; venueName?: string; townCity?: string; postcode?: string };

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
  const { signedIn, snapshot } = useFateDropId();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, alertResult, eventResult] = await Promise.allSettled([
        fetch(`${SIGNAL_ENGINE_URL}/api/status`).then(async (response) => {
          if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
          return await response.json() as StatusResponse;
        }),
        signedIn ? fetchCanonicalAlerts(100) : Promise.resolve([]),
        fetch(`${API_BASE_URL}/api/calendar-events`).then(async (response) => {
          if (!response.ok) throw new Error(`Events HTTP ${response.status}`);
          const data = await response.json() as { events?: HomeEvent[] };
          return data.events ?? [];
        }),
      ]);
      setStatus(statusResult.status === 'fulfilled' ? statusResult.value : null);
      setAlerts(alertResult.status === 'fulfilled' ? alertResult.value : []);
      setEvents(eventResult.status === 'fulfilled' ? eventResult.value : []);
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
  const activeFateMatches = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const healthPercent = retailers.length ? Math.round((healthy / retailers.length) * 100) : null;
  const upcomingEvents = events
    .filter((event) => !event.startDateTime || Date.parse(event.startDateTime) >= Date.now())
    .sort((a, b) => (Date.parse(a.startDateTime || '') || Infinity) - (Date.parse(b.startDateTime || '') || Infinity));
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
        <View style={styles.brandHeader}>
          <View>
            <Text style={styles.brandWordmark}>FATEDROP</Text>
            <Text style={styles.brandTagline}>COLLECTOR FIRST</Text>
          </View>
          <Pressable onPress={() => router.push('/alerts')} style={styles.headerAlert}>
            <Ionicons name="notifications-outline" size={18} color={FateDropColors.ivory} />
            {alerts.length ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{Math.min(alerts.length, 9)}</Text></View> : null}
          </Pressable>
        </View>

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
            <Text style={styles.heroTitle}>Welcome back{snapshot?.user.displayName ? `, ${snapshot.user.displayName}` : ', Seeker'}.</Text>
            <Text style={styles.heroCopy}>Koru is listening. FateDrop keeps the live evidence, value context and your personal hunts together.</Text>
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
          <OverviewMetric label="ECHO" value={signedIn ? counts.ECHO : null} color={FateDropColors.echo} />
          <OverviewMetric label="MANIFESTED" value={signedIn ? counts.MANIFESTED : null} color={FateDropColors.manifested} />
          <OverviewMetric label="FATEMATCH" value={signedIn ? activeFateMatches : null} color={FateDropColors.goldBright} />
          <OverviewMetric label="NETWORK" value={healthPercent} suffix={healthPercent == null ? '' : '%'} color={networkActive ? FateDropColors.success : FateDropColors.warning} />
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
            icon="telescope-outline"
            title="FATEFIND"
            detail="Compare live value"
            color={FateDropColors.goldBright}
            onPress={() => router.push('/fatefind')}
          />
          <QuickCard
            icon="radio-outline"
            title="FATEMATCH"
            detail="Watch until it fits"
            color={FateDropColors.gold}
            onPress={() => router.push('/fate-match')}
          />
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>DISCOVER NEARBY</Text>
            <Text style={styles.sectionTitle}>Local Radar & encounters</Text>
          </View>
        </View>

        <View style={styles.discoveryGrid}>
          <Pressable onPress={() => router.push('/local-radar')} style={({ pressed }) => [styles.discoveryCard, pressed && styles.pressed]}>
            <View style={styles.discoveryIcon}><Ionicons name="navigate-outline" size={22} color={FateDropColors.goldBright} /></View>
            <Text style={styles.discoveryTitle}>Local Radar</Text>
            <Text style={styles.discoveryCopy}>Nearby trusted shops, events and collector activity using the existing privacy-first location flow.</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/encounters')} style={({ pressed }) => [styles.discoveryCard, pressed && styles.pressed]}>
            <View style={styles.discoveryIcon}><Ionicons name="calendar-outline" size={22} color={FateDropColors.goldBright} /></View>
            <Text style={styles.discoveryTitle}>Fate Encounters</Text>
            <Text style={styles.discoveryCopy}>{upcomingEvents.length ? `${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? '' : 's'} in the current feed.` : 'Browse the current events feed.'}</Text>
          </Pressable>
        </View>

        {upcomingEvents[0] ? (
          <Pressable onPress={() => router.push({ pathname: '/encounters/detail', params: { id: upcomingEvents[0].id } })} style={({ pressed }) => [styles.eventPreview, pressed && styles.pressed]}>
            <View style={styles.eventIcon}><Ionicons name="sparkles-outline" size={20} color={FateDropColors.goldBright} /></View>
            <View style={styles.flex}>
              <Text style={styles.eventEyebrow}>NEXT COMMUNITY SIGNAL</Text>
              <Text style={styles.eventTitle}>{upcomingEvents[0].name}</Text>
              <Text style={styles.eventMeta}>{upcomingEvents[0].startDateTime ? new Date(upcomingEvents[0].startDateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Date TBC'} · {upcomingEvents[0].venueName || upcomingEvents[0].townCity || upcomingEvents[0].postcode || 'Venue TBC'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={FateDropColors.gold} />
          </Pressable>
        ) : null}

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

function OverviewMetric({ label, value, suffix = '', color }: { label: string; value: number | null; suffix?: string; color: string }) {
  return (
    <View style={styles.signalMetric}>
      <View style={[styles.signalGlyph, { borderColor: `${color}55` }]}><View style={[styles.signalDot, { backgroundColor: color }]} /></View>
      <Text style={styles.signalValue}>{value == null ? '—' : `${value}${suffix}`}</Text>
      <Text style={[styles.signalLabel, { color }]}>{label}</Text>
    </View>
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
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  brandWordmark: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 27, fontWeight: '700', letterSpacing: 1.4 },
  brandTagline: { color: FateDropColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.1, marginTop: 1 },
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
  discoveryGrid: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  discoveryCard: { flex: 1, minHeight: 150, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  discoveryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}38`, backgroundColor: `${FateDropColors.gold}0D`, marginBottom: 10 },
  discoveryTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 16, fontWeight: '700' },
  discoveryCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  eventPreview: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 24 },
  eventIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0D`, borderWidth: 1, borderColor: `${FateDropColors.gold}30` },
  eventEyebrow: { color: FateDropColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  eventTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 2 },
  eventMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
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
