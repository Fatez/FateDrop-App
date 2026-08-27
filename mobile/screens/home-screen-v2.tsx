import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { FATEDROP_WORDMARK_URI } from '@/constants/brand-wordmark-data';
import { FateDropColors, FateDropLifecycleColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

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
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alertResult, eventResult] = await Promise.allSettled([
        signedIn ? fetchCanonicalAlerts(100) : Promise.resolve([]),
        fetch(`${API_BASE_URL}/api/calendar-events`).then(async (response) => {
          if (!response.ok) throw new Error(`Events HTTP ${response.status}`);
          const data = await response.json() as { events?: HomeEvent[] };
          return data.events ?? [];
        }),
      ]);
      setAlerts(alertResult.status === 'fulfilled' ? alertResult.value : []);
      setEvents(eventResult.status === 'fulfilled' ? eventResult.value : []);
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const activeFateMatches = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const upcomingEvents = events
    .filter((event) => !event.startDateTime || Date.parse(event.startDateTime) >= Date.now())
    .sort((a, b) => (Date.parse(a.startDateTime || '') || Infinity) - (Date.parse(b.startDateTime || '') || Infinity));
  const identityName = snapshot?.user.displayName?.trim() || snapshot?.user.handle?.trim() || 'Seeker';
  const greeting = `Welcome, ${identityName}.`;
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
          <Image
            source={{ uri: FATEDROP_WORDMARK_URI }}
            style={styles.brandWordmarkImage}
            contentFit="contain"
            contentPosition="left center"
          />
          <Pressable onPress={() => router.push('/alerts')} style={styles.headerAlert}>
            <Ionicons name="notifications-outline" size={18} color={FateDropColors.ivory} />
            {alerts.length ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{Math.min(alerts.length, 9)}</Text></View> : null}
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Image
            source={require('../assets/images/home-koru-hero.webp')}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            contentPosition="center"
            transition={180}
          />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>{signedIn ? 'YOUR FATEDROP' : 'THE SIGNAL IS ALWAYS MOVING'}</Text>
            <Text style={styles.heroTitle}>{greeting}</Text>
            <Text style={styles.heroCopy}>Koru is listening. Find live value, follow your hunts and stay close to the signal.</Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>SIGNAL OVERVIEW</Text>
            <Text style={styles.sectionTitle}>Your recent signals</Text>
          </View>
          <Pressable onPress={() => router.push('/alerts')}><Text style={styles.sectionAction}>VIEW ALL →</Text></Pressable>
        </View>

        <View style={styles.signalGrid}>
          <OverviewMetric label="ECHO" value={signedIn ? counts.ECHO : null} color={FateDropColors.echo} />
          <OverviewMetric label="MANIFESTED" value={signedIn ? counts.MANIFESTED : null} color={FateDropColors.manifested} />
          <OverviewMetric label="FATEMATCH" value={signedIn ? activeFateMatches : null} color={FateDropColors.goldBright} />
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
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 82, paddingTop: 8, paddingBottom: 8, zIndex: 4 },
  brandWordmarkImage: { width: 216, height: 72 },
  headerAlert: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(12,16,24,.72)', alignItems: 'center', justifyContent: 'center' },
  headerBadge: { position: 'absolute', right: -3, top: -3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: FateDropColors.vanished, alignItems: 'center', justifyContent: 'center' },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  hero: { height: 500, marginHorizontal: -18, marginBottom: 22, overflow: 'hidden', position: 'relative' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,6,13,.08)' },
  heroContent: { position: 'absolute', left: 24, right: 138, bottom: 28, zIndex: 3 },
  heroEyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6, textShadowColor: 'rgba(0,0,0,.85)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 30, lineHeight: 34, fontWeight: '700', textShadowColor: 'rgba(0,0,0,.9)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } },
  heroCopy: { color: FateDropColors.ivory, fontSize: 13, lineHeight: 18, marginTop: 7, maxWidth: 245, textShadowColor: 'rgba(0,0,0,.9)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
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
  flex: { flex: 1 },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },
});