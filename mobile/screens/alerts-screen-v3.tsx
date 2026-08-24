import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

const stages: CanonicalAlertStage[] = ['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'];

const stageMeta: Record<CanonicalAlertStage, {
  color: string;
  companion: string;
  label: string;
  hero: number;
  thumbnail: number;
  headline: string;
  copy: string;
}> = {
  WHISPER: {
    color: FateDropColors.whisper,
    companion: 'Oru',
    label: 'Whisper',
    hero: require('../assets/images/alert-oru-hero.jpg'),
    thumbnail: require('../assets/images/alert-oru.webp'),
    headline: 'Something is stirring.',
    copy: 'Early product or catalogue movement worth watching. Whisper is evidence of change, not confirmed live stock.',
  },
  ECHO: {
    color: FateDropColors.echo,
    companion: 'Fenn',
    label: 'Echo',
    hero: require('../assets/images/alert-fenn-hero.jpg'),
    thumbnail: require('../assets/images/alert-fenn.webp'),
    headline: 'Readiness detected.',
    copy: 'Queue, traffic, security or access conditions changed. Get ready, but do not treat Echo as a stock guarantee.',
  },
  MANIFESTED: {
    color: FateDropColors.manifested,
    companion: 'Koru',
    label: 'Manifested',
    hero: require('../assets/images/alert-koru-hero.jpg'),
    thumbnail: require('../assets/images/alert-koru.webp'),
    headline: 'Verified stock is live.',
    copy: 'Manifested is confirmed purchasable availability from observed evidence. This is the moment to inspect the product.',
  },
  VANISHED: {
    color: FateDropColors.vanished,
    companion: 'Nyxen',
    label: 'Vanished',
    hero: require('../assets/images/alert-nyxen-hero.jpg'),
    thumbnail: require('../assets/images/alert-nyxen.webp'),
    headline: 'The signal has gone quiet.',
    copy: 'Previously verified availability is no longer observed. FateDrop keeps the history so the disappearance is explainable.',
  },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pounds(pence: number | null | undefined) {
  return pence == null ? null : `£${(pence / 100).toFixed(2)}`;
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

function percentText(delta: number | null | undefined) {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (Math.abs(delta) < 0.05) return 'AT RRP';
  return delta < 0 ? `${Math.abs(delta).toFixed(1)}% BELOW RRP` : `${delta.toFixed(1)}% ABOVE RRP`;
}

function deliveryLabel(alert: CanonicalMobileAlert) {
  const delivery = alert.delivery?.discord;
  if (!delivery) return { label: 'Alert recorded', color: FateDropColors.secondary };
  if (delivery.status === 'sent') return { label: 'Delivered', color: FateDropColors.success };
  if (delivery.status === 'skipped') return { label: 'Delivery skipped', color: FateDropColors.warning };
  return { label: 'Delivery issue', color: FateDropColors.error };
}

export default function AlertsScreenV3() {
  const params = useLocalSearchParams<{ stage?: string | string[] }>();
  const { signedIn } = useFateDropId();
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [stage, setStage] = useState<CanonicalAlertStage>('ECHO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const incoming = first(params.stage)?.toUpperCase();
    if (incoming && stages.includes(incoming as CanonicalAlertStage)) setStage(incoming as CanonicalAlertStage);
  }, [params.stage]);

  const load = useCallback(async () => {
    if (!signedIn) {
      setAlerts([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAlerts(await fetchCanonicalAlerts(100));
    } catch (cause) {
      setAlerts([]);
      setError(cause instanceof Error ? cause.message : 'Alert inbox is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const meta = stageMeta[stage];
  const filtered = useMemo(() => alerts.filter((alert) => alert.fateStage === stage), [alerts, stage]);
  const counts = useMemo(() => Object.fromEntries(stages.map((value) => [value, alerts.filter((alert) => alert.fateStage === value).length])) as Record<CanonicalAlertStage, number>, [alerts]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <FateDropHeader
          title="Alerts"
          subtitle="COMPANION SIGNAL INBOX"
          rightAction={<Pressable onPress={() => router.push('/notification-preferences')} style={styles.headerButton}><Ionicons name="options-outline" size={18} color={FateDropColors.ivory} /></Pressable>}
        />

        <View style={styles.tabs}>
          {stages.map((value) => {
            const item = stageMeta[value];
            const active = value === stage;
            return (
              <Pressable key={value} onPress={() => setStage(value)} style={[styles.tab, active && { borderColor: `${item.color}88`, backgroundColor: `${item.color}10` }]}>
                <Text style={[styles.tabLabel, active && { color: item.color }]}>{item.label.toUpperCase()}</Text>
                <Text style={[styles.tabCount, active && { color: FateDropColors.ivory }]}>{signedIn ? counts[value] : '—'}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.hero, { borderColor: `${meta.color}66` }]}>
          <Image source={meta.hero} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" transition={160} />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.companionPill}>
              <Image source={meta.thumbnail} style={styles.companionThumb} contentFit="cover" />
              <View>
                <Text style={[styles.companionStage, { color: meta.color }]}>{meta.companion.toUpperCase()} · {meta.label.toUpperCase()}</Text>
                <Text style={styles.companionRole}>Your {meta.label.toLowerCase()} companion</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{meta.headline}</Text>
            <Text style={styles.heroCopy}>{meta.copy}</Text>
          </View>
        </View>

        {!signedIn ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={24} color={FateDropColors.gold} />
            <Text style={styles.emptyTitle}>Sign in to your FateDrop ID</Text>
            <Text style={styles.emptyCopy}>Your canonical alert history follows your account across the app and connected delivery surfaces.</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>SIGN IN</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: meta.color }]}>{meta.companion.toUpperCase()} IS WATCHING</Text>
                <Text style={styles.sectionTitle}>{meta.label} alerts</Text>
              </View>
              <Pressable onPress={() => router.push('/fatefind')}><Text style={styles.sectionAction}>FATEFIND →</Text></Pressable>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="warning-outline" size={18} color={FateDropColors.warning} />
                <View style={styles.flex}><Text style={styles.errorTitle}>Canonical inbox unavailable</Text><Text style={styles.errorCopy}>{error}</Text></View>
              </View>
            ) : null}

            <View style={styles.alertList}>
              {filtered.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
              {!loading && !error && !filtered.length ? (
                <View style={styles.emptyState}>
                  <Image source={meta.thumbnail} style={styles.emptyCompanion} contentFit="cover" />
                  <Text style={styles.emptyTitle}>No {meta.label.toLowerCase()} alerts right now</Text>
                  <Text style={styles.emptyCopy}>Good. FateDrop leaves the feed quiet rather than padding it with demo data or raw background noise.</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertCard({ alert }: { alert: CanonicalMobileAlert }) {
  const meta = stageMeta[alert.fateStage];
  const itemPrice = pounds(alert.product.pricePence);
  const rrp = pounds(alert.priceIntelligence.rrpPence ?? alert.product.rrpPence);
  const truePrice = pounds(alert.product.deliveredPricePence);
  const delta = percentText(alert.priceIntelligence.rrpDeltaPercent);
  const delivery = deliveryLabel(alert);
  const buyNow = alert.fateStage === 'MANIFESTED' && Boolean(alert.productUrl);

  const open = () => {
    if (alert.productUrl) void Linking.openURL(alert.productUrl);
  };

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.alertCard, { borderColor: `${meta.color}38` }, pressed && styles.pressed]}>
      <View style={styles.alertTop}>
        {alert.product.imageUrl ? (
          <Image source={{ uri: alert.product.imageUrl }} style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={[styles.productFallback, { borderColor: `${meta.color}44` }]}><Ionicons name="cube-outline" size={24} color={meta.color} /></View>
        )}

        <View style={styles.alertTopCopy}>
          <View style={styles.alertMetaRow}>
            <Text style={[styles.stageLabel, { color: meta.color }]}>{meta.companion.toUpperCase()} · {meta.label.toUpperCase()}</Text>
            <Text style={styles.time}>{ago(alert.detectedAt)}</Text>
          </View>
          <Text style={styles.alertTitle} numberOfLines={2}>{alert.product.title || alert.title}</Text>
          <Text style={styles.retailer}>{alert.retailer}</Text>
        </View>
      </View>

      <View style={styles.priceGrid}>
        <PriceMetric label="ITEM PRICE" value={itemPrice ?? 'Unknown'} />
        <PriceMetric label="RRP / REFERENCE" value={rrp ?? 'Unavailable'} />
        <PriceMetric label="TRUE PRICE" value={truePrice ?? 'Delivery unknown'} />
      </View>

      {delta ? <View style={[styles.deltaBadge, { borderColor: `${meta.color}55`, backgroundColor: `${meta.color}0E` }]}><Text style={[styles.deltaText, { color: meta.color }]}>{delta}</Text></View> : <Text style={styles.noDelta}>No verified RRP/reference percentage available.</Text>}

      <Text style={styles.reason}>{alert.message}</Text>

      <View style={styles.alertFooter}>
        <View style={styles.deliveryPill}><View style={[styles.deliveryDot, { backgroundColor: delivery.color }]} /><Text style={[styles.deliveryText, { color: delivery.color }]}>{delivery.label}</Text></View>
        <View style={[styles.openAction, buyNow && styles.buyAction]}>
          <Text style={styles.openText}>{buyNow ? 'BUY NOW' : 'INSPECT'}</Text>
          <Ionicons name={buyNow ? 'bag-handle-outline' : 'arrow-forward'} size={14} color={FateDropColors.ivory} />
        </View>
      </View>
    </Pressable>
  );
}

function PriceMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.priceMetric}><Text style={styles.priceLabel}>{label}</Text><Text style={styles.priceValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  headerButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tab: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  tabLabel: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .4 },
  tabCount: { color: FateDropColors.secondary, fontSize: 13, fontWeight: '900', marginTop: 2 },
  hero: { height: 265, borderRadius: 24, overflow: 'hidden', borderWidth: 1, backgroundColor: FateDropColors.card, marginBottom: 20 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,10,.45)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  companionPill: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingRight: 11, paddingLeft: 5, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}44`, backgroundColor: 'rgba(8,14,20,.72)' },
  companionThumb: { width: 34, height: 34, borderRadius: 17 },
  companionStage: { fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  companionRole: { color: FateDropColors.secondary, fontSize: 11, marginTop: 1 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 27, lineHeight: 30, fontWeight: '700', marginTop: 10 },
  heroCopy: { color: FateDropColors.ivory, fontSize: 13, lineHeight: 18, marginTop: 5, maxWidth: 335 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  sectionEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: FateDropTypography.sectionTitle, fontWeight: '700', marginTop: 3 },
  sectionAction: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900' },
  alertList: { gap: 10 },
  alertCard: { padding: 14, borderRadius: 18, borderWidth: 1, backgroundColor: FateDropColors.surface },
  alertTop: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  productImage: { width: 68, height: 68, borderRadius: 12, backgroundColor: FateDropColors.card },
  productFallback: { width: 68, height: 68, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: FateDropColors.card },
  alertTopCopy: { flex: 1 },
  alertMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stageLabel: { fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  time: { color: FateDropColors.muted, fontSize: 11 },
  alertTitle: { color: FateDropColors.ivory, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 4 },
  retailer: { color: FateDropColors.secondary, fontSize: 12, fontWeight: '800', marginTop: 5 },
  priceGrid: { flexDirection: 'row', gap: 7, marginTop: 13 },
  priceMetric: { flex: 1, minHeight: 58, padding: 9, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  priceLabel: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .45 },
  priceValue: { color: FateDropColors.ivory, fontSize: 12, lineHeight: 15, fontWeight: '900', marginTop: 4 },
  deltaBadge: { alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  deltaText: { fontSize: 10, fontWeight: '900', letterSpacing: .5 },
  noDelta: { color: FateDropColors.muted, fontSize: 11, marginTop: 8 },
  reason: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, marginTop: 9 },
  alertFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: FateDropColors.borderSoft, marginTop: 12, paddingTop: 11 },
  deliveryPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryDot: { width: 6, height: 6, borderRadius: 3 },
  deliveryText: { fontSize: 10, fontWeight: '900' },
  openAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: FateDropColors.border },
  buyAction: { backgroundColor: `${FateDropColors.manifested}12`, borderColor: `${FateDropColors.manifested}55` },
  openText: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900', letterSpacing: .6 },
  emptyState: { alignItems: 'center', padding: 26, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  emptyCompanion: { width: 62, height: 62, borderRadius: 18 },
  emptyTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900', marginTop: 10 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 310 },
  primaryButton: { marginTop: 15, borderWidth: 1, borderColor: FateDropColors.gold, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: `${FateDropColors.gold}16` },
  primaryButtonText: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, marginBottom: 10, borderRadius: 15, borderWidth: 1, borderColor: `${FateDropColors.warning}50`, backgroundColor: `${FateDropColors.warning}0C` },
  errorTitle: { color: FateDropColors.warning, fontSize: 13, fontWeight: '900' },
  errorCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  flex: { flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
