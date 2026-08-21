import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActivityItem,
  FateDropBackground,
  FateDropHeader,
  IconButton,
  SectionHeader,
  StatCard,
} from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { signalPresentation, type MarketEvent } from '@/lib/signal-presentation';

interface CloudRetailerState {
  id: string;
  name: string;
  healthy: boolean;
  productsSeen?: number | null;
  baselineCompleted: boolean;
}

interface SignalStatus {
  success: boolean;
  monitor?: {
    baselineComplete?: boolean;
    productsTracked?: number;
    offersTracked?: number;
    currentlyAvailable?: number;
    retailers?: number;
  };
  state?: { retailers?: CloudRetailerState[] };
}

interface CloudSignal {
  id: string;
  state?: string;
  title?: string;
  reason?: string;
  retailerName?: string;
  detectedAt?: number | string;
}

const ago = (value?: string) => {
  if (!value) return 'Recent';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};

function publicStageForCloudState(state?: string): MarketEvent['fateStage'] {
  const value = String(state || '').toLowerCase();
  if (value === 'whisper') return 'WHISPER';
  if (value === 'echo') return 'ECHO';
  if (value === 'manifested') return 'MANIFESTED';
  if (value === 'vanished') return 'VANISHED';
  return 'NETWORK';
}

function detectedAtIso(value?: number | string) {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

function adaptCloudSignal(signal: CloudSignal): MarketEvent {
  return {
    id: signal.id,
    type: String(signal.state || '').toUpperCase(),
    fateStage: publicStageForCloudState(signal.state),
    title: signal.title,
    message: signal.reason,
    retailer: signal.retailerName,
    detectedAt: detectedAtIso(signal.detectedAt),
    product: { title: signal.title },
  };
}

export default function HomeScreen() {
  const [status, setStatus] = useState<SignalStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<MarketEvent[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${SIGNAL_ENGINE_URL}/api/status`);
        if (!response.ok) throw new Error(`Signal Engine status HTTP ${response.status}`);
        setStatus(await response.json() as SignalStatus);
      } catch (error) {
        console.error('Failed to load FateDrop Cloud status:', error);
        setStatus(null);
      }

      try {
        const signalsResponse = await fetch(`${SIGNAL_ENGINE_URL}/api/signals?limit=5`);
        if (!signalsResponse.ok) {
          setRecentEvents([]);
          return;
        }
        const signalsData = await signalsResponse.json() as { signals?: CloudSignal[] };
        setRecentEvents(Array.isArray(signalsData.signals) ? signalsData.signals.slice(0, 5).map(adaptCloudSignal) : []);
      } catch {
        setRecentEvents([]);
      }
    };
    void load();
  }, []);

  const productsTracked = status?.monitor?.productsTracked ?? 0;
  const retailerCount = status?.monitor?.retailers ?? status?.state?.retailers?.length ?? 0;
  const inStockCount = status?.monitor?.currentlyAvailable ?? 0;
  const retailerStates = status?.state?.retailers ?? [];
  const healthyRetailers = retailerStates.filter((retailer) => retailer.healthy && retailer.baselineCompleted).length;
  const networkMeasured = Boolean(status?.success);
  const networkLive = networkMeasured && healthyRetailers > 0;
  const colors = [FateDropColors.violetLight, FateDropColors.blue, FateDropColors.mint, FateDropColors.cyan];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FateDropBackground />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader
          subtitle="TCG NETWORK INTELLIGENCE"
          rightAction={<IconButton icon="notifications-outline" onPress={() => router.push('/alerts')} />}
        />

        <View style={styles.heroCard}>
          <Image source={require('@/assets/images/fatedropheader.png')} style={styles.promoImage} contentFit="cover" />
          <View style={styles.promoOverlay} />
          <View style={styles.promoCopy}>
            <View style={[styles.livePill, !networkLive && styles.neutralPill]}>
              <View style={[styles.liveDotSmall, !networkLive && styles.neutralDot]} />
              <Text style={[styles.livePillText, !networkLive && styles.neutralText]}>{networkLive ? 'NETWORK ACTIVE' : networkMeasured ? 'NETWORK QUIET' : 'STATUS UNAVAILABLE'}</Text>
            </View>
            <Text style={styles.heroHeadline}>Know what is moving.</Text>
            <Text style={styles.heroSubhead}>Search connected TCG offers, compare the real cost and let FateDrop watch the network with you.</Text>
            <Pressable onPress={() => router.push('/search')} style={({ pressed }) => [styles.stayAheadButton, pressed && styles.pressed]}>
              <Text style={styles.stayAheadText}>SEARCH THE NETWORK</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.monitorCard}>
          <Image source={require('@/assets/images/fatedrop-portal-hero.png')} style={styles.monitorArtwork} contentFit="cover" />
          <View style={styles.monitorShade} />
          <View style={styles.monitorGlow} />
          <View style={styles.monitorTop}>
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, !networkLive && styles.neutralDot]} />
              <Text style={[styles.liveText, !networkLive && styles.neutralText]}>{networkLive ? `${healthyRetailers} MONITOR${healthyRetailers === 1 ? '' : 'S'} HEALTHY` : networkMeasured ? 'NO HEALTHY MONITOR REPORTED' : 'CLOUD STATUS UNAVAILABLE'}</Text>
            </View>
            <Ionicons name="radio-outline" size={22} color={FateDropColors.violetLight} />
          </View>
          <Text style={styles.monitorEyebrow}>NETWORK ACTIVITY</Text>
          <Text style={styles.monitorTitle}>The FateDrop heartbeat.</Text>
          <Text style={styles.monitorDescription}>Measured catalogue and availability state comes from FateDrop Cloud. Early Echo intelligence stays distinct from confirmed Manifested stock.</Text>
          <View style={styles.monitorFooter}>
            <View style={styles.metricWrap}><Text style={styles.monitorMetric}>{networkMeasured ? productsTracked.toLocaleString() : '—'}</Text><Text style={styles.monitorLabel}>Products tracked</Text></View>
            <View style={styles.verticalDivider} />
            <View style={styles.metricWrap}><Text style={styles.monitorMetric}>{networkMeasured ? inStockCount.toLocaleString() : '—'}</Text><Text style={styles.monitorLabel}>Available offers</Text></View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon="storefront-outline" value={networkMeasured ? retailerCount.toString() : '—'} label="Retailers" color={FateDropColors.violetLight} />
          <StatCard icon="cube-outline" value={networkMeasured ? productsTracked.toLocaleString() : '—'} label="Products" color={FateDropColors.blue} />
          <StatCard icon="flash-outline" value={networkMeasured ? inStockCount.toLocaleString() : '—'} label="Available" color={FateDropColors.mint} />
        </View>

        <SectionHeader title="FateDrop companions" action="Signal identities" />
        <View style={styles.companionPanel}>
          <View style={styles.companionIntro}>
            <View style={styles.companionSignalIcon}>
              <Ionicons name="sparkles" size={18} color={FateDropColors.cyan} />
            </View>
            <View style={styles.companionIntroCopy}>
              <Text style={styles.companionEyebrow}>YOUR SIGNAL, GIVEN FORM</Text>
              <Text style={styles.companionIntroText}>Meet the reactive identities that turn Echo, Manifested and major FateDrop moments into character.</Text>
            </View>
          </View>

          <View style={styles.companionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open KAEL companion"
              onPress={() => router.push({ pathname: '/companion', params: { variant: 'male' } })}
              style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}
            >
              <View style={styles.companionCardGlow} />
              <View style={styles.companionAvatar}>
                <Ionicons name="person" size={28} color={FateDropColors.violetLight} />
              </View>
              <Text style={styles.companionCode}>K-01</Text>
              <Text style={styles.companionName}>KAEL</Text>
              <Text style={styles.companionRole}>Signal collector</Text>
              <View style={styles.companionState}>
                <View style={styles.companionStateDot} />
                <Text style={styles.companionStateText}>READY</Text>
              </View>
              <View style={styles.companionOpenRow}>
                <Text style={styles.companionOpenText}>VIEW COMPANION</Text>
                <Ionicons name="arrow-forward" size={13} color={FateDropColors.cyan} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open NYRA companion"
              onPress={() => router.push({ pathname: '/companion', params: { variant: 'female' } })}
              style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}
            >
              <View style={[styles.companionCardGlow, styles.companionCardGlowCyan]} />
              <View style={[styles.companionAvatar, styles.companionAvatarCyan]}>
                <Ionicons name="person" size={28} color={FateDropColors.cyan} />
              </View>
              <Text style={styles.companionCode}>N-02</Text>
              <Text style={styles.companionName}>NYRA</Text>
              <Text style={styles.companionRole}>Signal collector</Text>
              <View style={styles.companionState}>
                <View style={styles.companionStateDot} />
                <Text style={styles.companionStateText}>READY</Text>
              </View>
              <View style={styles.companionOpenRow}>
                <Text style={styles.companionOpenText}>VIEW COMPANION</Text>
                <Ionicons name="arrow-forward" size={13} color={FateDropColors.cyan} />
              </View>
            </Pressable>
          </View>
        </View>

        <SectionHeader title="Network activity" action={recentEvents.length ? 'Observed' : undefined} />
        <View style={styles.activityList}>
          {recentEvents.length ? recentEvents.map((event, index) => {
            const presentation = signalPresentation(event);
            return (
              <ActivityItem
                key={event.id}
                icon={presentation.icon}
                type={presentation.label}
                title={event.product?.title || event.title || 'Catalogue update'}
                detail={event.message || event.type?.replaceAll('_', ' ') || 'Observed network movement'}
                retailer={event.retailer || 'Connected retailer'}
                time={ago(event.detectedAt)}
                tone={presentation.tone}
                unread={index === 0}
              />
            );
          }) : (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyTitle}>No recent activity available</Text>
              <Text style={styles.emptyText}>FateDrop does not substitute sample drops when the activity source has nothing to report.</Text>
            </View>
          )}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Open Fate Encounters" onPress={() => router.push('/encounters')} style={({ pressed }) => [styles.encountersCard, pressed && styles.pressed]}>
          <View style={styles.encountersIcon}><Ionicons name="calendar" size={24} color={FateDropColors.violetLight} /></View>
          <View style={styles.encountersCopy}>
            <Text style={styles.encountersTitle}>Fate Encounters</Text>
            <Text style={styles.encountersSubtitle}>Discover card shows, conventions, tournaments and trade nights.</Text>
            <Text style={styles.encountersLine}>Events stay secondary to the live collector journey.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={FateDropColors.violetLight} />
        </Pressable>

        <SectionHeader title="Connected monitoring" action={networkMeasured ? 'Cloud status' : undefined} />
        <View style={styles.retailerGrid}>
          {retailerStates.length ? retailerStates.map((retailer, index) => (
            <View key={retailer.id} style={styles.retailerCard}>
              <View style={[styles.retailerLogo, { backgroundColor: `${colors[index % colors.length]}20`, borderColor: `${colors[index % colors.length]}55` }]}>
                <Text style={[styles.retailerLogoText, { color: colors[index % colors.length] }]}>{retailer.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={styles.retailerContent}>
                <Text style={styles.retailerName}>{retailer.name}</Text>
                <Text style={styles.retailerProducts}>{retailer.productsSeen == null ? 'Product count not reported' : `${retailer.productsSeen.toLocaleString()} products seen`}</Text>
              </View>
              <View style={[styles.onlineBadge, !retailer.healthy && styles.neutralBadge]}><View style={[styles.onlineDot, !retailer.healthy && styles.neutralDot]} /><Text style={[styles.onlineText, !retailer.healthy && styles.neutralText]}>{retailer.healthy ? 'Healthy' : 'Check'}</Text></View>
            </View>
          )) : (
            <View style={styles.emptyActivity}><Text style={styles.emptyTitle}>Retailer health unavailable</Text><Text style={styles.emptyText}>No static retailer list is presented as live monitoring proof.</Text></View>
          )}
        </View>

        <SectionHeader title="Independent retailers" action="Network growth" />
        <View style={styles.partnerCard}>
          <View style={styles.partnerGlow} />
          <View style={styles.partnerIcon}><Ionicons name="storefront" size={23} color={FateDropColors.cyan} /></View>
          <Text style={styles.partnerEyebrow}>SUPPORT INDEPENDENTS</Text>
          <Text style={styles.partnerTitle}>Make legitimate indie stock easier to discover.</Text>
          <Text style={styles.partnerCopy}>FateDrop is building a discovery layer that sends collectors to the retailer’s own website and checkout while connected catalogue coverage grows.</Text>
          <View style={styles.partnerBenefits}>
            <View style={styles.partnerBenefit}><Ionicons name="search-outline" size={15} color={FateDropColors.violetLight} /><Text style={styles.partnerBenefitText}>Network discovery</Text></View>
            <View style={styles.partnerBenefit}><Ionicons name="pricetag-outline" size={15} color={FateDropColors.mint} /><Text style={styles.partnerBenefitText}>Transparent offers</Text></View>
            <View style={styles.partnerBenefit}><Ionicons name="open-outline" size={15} color={FateDropColors.blue} /><Text style={styles.partnerBenefitText}>Direct retailer traffic</Text></View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/retailer-partners')} style={({ pressed }) => [styles.partnerButton, pressed && styles.pressed]}>
            <Text style={styles.partnerButtonText}>RETAILER NETWORK</Text><Ionicons name="arrow-forward" size={16} color={FateDropColors.text} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FateDropColors.background },
  screen: { flex: 1, backgroundColor: 'transparent', zIndex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 120 },
  heroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, marginBottom: 16, height: 226, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: '#12141C', zIndex: 2 },
  promoImage: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  promoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 6, 12, 0.24)' },
  promoCopy: { position: 'absolute', left: 18, right: 90, bottom: 18, zIndex: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', backgroundColor: `${FateDropColors.mint}14`, borderWidth: 1, borderColor: `${FateDropColors.mint}4D`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  neutralPill: { backgroundColor: 'rgba(255,255,255,.05)', borderColor: FateDropColors.border },
  liveDotSmall: { width: 7, height: 7, borderRadius: 4, backgroundColor: FateDropColors.mint },
  livePillText: { color: FateDropColors.mint, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  neutralDot: { backgroundColor: FateDropColors.muted },
  neutralText: { color: FateDropColors.muted },
  heroHeadline: { color: '#F5F7FA', fontSize: 28, fontWeight: '800', letterSpacing: -0.9, lineHeight: 32, marginBottom: 8 },
  heroSubhead: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  stayAheadButton: { alignSelf: 'flex-start', backgroundColor: 'rgba(168, 85, 247, 0.9)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  stayAheadText: { color: '#F5F7FA', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  monitorCard: { position: 'relative', backgroundColor: 'rgba(14, 16, 27, 0.94)', borderWidth: 1, borderColor: FateDropColors.border, borderRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, overflow: 'hidden', marginBottom: 22, zIndex: 2 },
  monitorArtwork: { ...StyleSheet.absoluteFillObject, left: '42%', opacity: 0.5 },
  monitorShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 10, 19, 0.48)' },
  monitorGlow: { position: 'absolute', right: -20, top: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: `${FateDropColors.violetLight}20` },
  monitorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: FateDropColors.mint },
  liveText: { color: FateDropColors.mint, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  monitorEyebrow: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginBottom: 7 },
  monitorTitle: { color: FateDropColors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.8, marginBottom: 10 },
  monitorDescription: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  monitorFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderTopWidth: 1, borderTopColor: FateDropColors.border, paddingTop: 16 },
  metricWrap: { flex: 1 },
  monitorMetric: { color: FateDropColors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  monitorLabel: { color: FateDropColors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  verticalDivider: { width: 1, height: 42, backgroundColor: FateDropColors.border },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, zIndex: 2 },
  companionPanel: { marginBottom: 22, zIndex: 2 },
  companionIntro: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  companionSignalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}12`, borderWidth: 1, borderColor: `${FateDropColors.cyan}35` },
  companionIntroCopy: { flex: 1 },
  companionEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  companionIntroText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  companionRow: { flexDirection: 'row', gap: 10 },
  companionCard: { flex: 1, minHeight: 184, overflow: 'hidden', borderRadius: 22, padding: 14, backgroundColor: 'rgba(17, 17, 28, 0.96)', borderWidth: 1, borderColor: `${FateDropColors.violetLight}48`, position: 'relative' },
  companionCardGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -38, top: -40, backgroundColor: `${FateDropColors.violetLight}18` },
  companionCardGlowCyan: { backgroundColor: `${FateDropColors.cyan}12` },
  companionAvatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violet}20`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}50`, marginBottom: 12 },
  companionAvatarCyan: { backgroundColor: `${FateDropColors.cyan}12`, borderColor: `${FateDropColors.cyan}40` },
  companionCode: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.4 },
  companionName: { color: FateDropColors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.35, marginTop: 2 },
  companionRole: { color: FateDropColors.secondary, fontSize: 9, marginTop: 2 },
  companionState: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  companionStateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint },
  companionStateText: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  companionOpenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: FateDropColors.border },
  companionOpenText: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  activityList: { marginBottom: 20, zIndex: 2 },
  emptyActivity: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  emptyTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' },
  emptyText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  encountersCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(29, 20, 44, 0.92)', borderWidth: 1, borderColor: `${FateDropColors.violetLight}66`, borderRadius: 22, padding: 18, marginBottom: 22, zIndex: 2, shadowColor: FateDropColors.violet, shadowOpacity: 0.18, shadowRadius: 16 },
  encountersIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}1F` },
  encountersCopy: { flex: 1 },
  encountersTitle: { color: FateDropColors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  encountersSubtitle: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18 },
  encountersLine: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '700', marginTop: 7 },
  retailerGrid: { gap: 10, marginBottom: 12 },
  retailerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18, 19, 26, 0.85)', borderWidth: 1, borderColor: FateDropColors.border, borderRadius: 20, padding: 14 },
  retailerLogo: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1 },
  retailerLogoText: { fontSize: 13, fontWeight: '800' },
  retailerContent: { flex: 1 },
  retailerName: { color: FateDropColors.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  retailerProducts: { color: FateDropColors.muted, fontSize: 10 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: `${FateDropColors.mint}18`, borderWidth: 1, borderColor: `${FateDropColors.mint}52` },
  neutralBadge: { backgroundColor: 'rgba(255,255,255,.04)', borderColor: FateDropColors.border },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: FateDropColors.mint },
  onlineText: { color: FateDropColors.mint, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  partnerCard: { position: 'relative', overflow: 'hidden', backgroundColor: 'rgba(22,17,38,.96)', borderWidth: 1, borderColor: `${FateDropColors.violetLight}55`, borderRadius: 26, padding: 20, marginBottom: 10, shadowColor: FateDropColors.violet, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  partnerGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -70, top: -80, backgroundColor: `${FateDropColors.violetLight}20` },
  partnerIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}12`, borderWidth: 1, borderColor: `${FateDropColors.cyan}38`, marginBottom: 16 },
  partnerEyebrow: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 },
  partnerTitle: { color: FateDropColors.text, fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -0.6, maxWidth: '90%' },
  partnerCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, marginTop: 9 },
  partnerBenefits: { gap: 9, marginVertical: 17 },
  partnerBenefit: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  partnerBenefitText: { color: FateDropColors.text, fontSize: 12, fontWeight: '700' },
  partnerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FateDropColors.violet, borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: FateDropColors.violetLight },
  partnerButtonText: { color: FateDropColors.text, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
});