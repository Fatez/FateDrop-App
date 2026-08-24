import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts, type CanonicalAlertStage, type CanonicalMobileAlert } from '@/services/canonical-alerts';

type Filter = 'ALL' | CanonicalAlertStage;

const stageMeta: Record<CanonicalAlertStage, { color: string; companion: string; image: number; label: string }> = {
  WHISPER: { color: FateDropColors.cyan, companion: 'Oru', image: require('../assets/images/alert-oru.webp'), label: 'Whisper' },
  ECHO: { color: FateDropColors.violetLight, companion: 'Fenn', image: require('../assets/images/alert-fenn.webp'), label: 'Echo' },
  MANIFESTED: { color: FateDropColors.mint, companion: 'Koru', image: require('../assets/images/alert-koru.webp'), label: 'Manifested' },
  VANISHED: { color: FateDropColors.coral, companion: 'Nyxen', image: require('../assets/images/alert-nyxen.webp'), label: 'Vanished' },
};

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

function observedDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.floor(seconds);
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const secondsRemainder = whole % 60;
  if (minutes < 60) return secondsRemainder ? `${minutes}m ${secondsRemainder}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  if (hours < 24) return minuteRemainder ? `${hours}h ${minuteRemainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const hourRemainder = hours % 24;
  return hourRemainder ? `${days}d ${hourRemainder}h` : `${days}d`;
}

function categoryLabel(alert: CanonicalMobileAlert) {
  const category = alert.productIntelligence?.category;
  if (category === 'SEALED_TCG') return 'SEALED TCG';
  if (category === 'SINGLE_CARD') return 'SINGLE / PROMO';
  if (category === 'ACCESSORY') return 'ACCESSORY';
  if (category === 'MERCHANDISE') return 'MERCH';
  return 'UNKNOWN';
}

function priceLine(alert: CanonicalMobileAlert) {
  const item = pounds(alert.product.pricePence);
  const delivered = pounds(alert.product.deliveredPricePence);
  const rrp = pounds(alert.priceIntelligence.rrpPence ?? alert.product.rrpPence);
  const delta = alert.priceIntelligence.rrpDeltaPercent;
  const parts: string[] = [];
  if (item) parts.push(item);
  if (delivered && delivered !== item) parts.push(`${delivered} delivered`);
  if (rrp) parts.push(delta == null ? `RRP ${rrp}` : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs RRP ${rrp}`);
  return parts.join(' · ');
}

function deliveryLabel(alert: CanonicalMobileAlert) {
  const delivery = alert.delivery?.discord;
  if (!delivery) return { label: 'Alert recorded', color: FateDropColors.secondary };
  if (delivery.status === 'sent') return { label: 'Discord sent', color: FateDropColors.mint };
  return { label: 'Discord issue', color: FateDropColors.amber };
}

function AlertCard({ alert }: { alert: CanonicalMobileAlert }) {
  const meta = stageMeta[alert.fateStage];
  const delivery = deliveryLabel(alert);
  const price = priceLine(alert);
  const open = () => {
    if (alert.productUrl) void Linking.openURL(alert.productUrl);
  };

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}>
      <View style={styles.alertTop}>
        <View style={[styles.stageIcon, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}45` }]}>
          <Image source={meta.image} style={styles.stageImage} resizeMode="cover" />
        </View>
        <View style={styles.alertTopCopy}>
          <View style={styles.alertMetaRow}>
            <Text style={[styles.stageLabel, { color: meta.color }]}>{meta.companion.toUpperCase()} · {meta.label.toUpperCase()}</Text>
            <Text style={styles.time}>{ago(alert.detectedAt)}</Text>
          </View>
          <Text style={styles.alertTitle} numberOfLines={2}>{alert.product.title || alert.title}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.retailer}>{alert.retailer}</Text>
        <Text style={styles.category}>{categoryLabel(alert)}</Text>
      </View>
      {price ? <Text style={styles.price}>{price}</Text> : null}
      {alert.fateStage === 'VANISHED' && observedDuration(alert.observedDurationSeconds) ? <Text style={styles.observed}>OBSERVED LIVE · {observedDuration(alert.observedDurationSeconds)}</Text> : null}
      <Text style={styles.reason} numberOfLines={2}>{alert.message}</Text>

      <View style={styles.alertFooter}>
        <View style={styles.deliveryPill}>
          <View style={[styles.deliveryDot, { backgroundColor: delivery.color }]} />
          <Text style={[styles.deliveryText, { color: delivery.color }]}>{delivery.label}</Text>
        </View>
        <View style={styles.openAction}>
          <Text style={styles.openText}>{alert.fateStage === 'MANIFESTED' ? 'VIEW PRODUCT' : 'INSPECT'}</Text>
          <Ionicons name="arrow-forward" size={14} color={FateDropColors.text} />
        </View>
      </View>
    </Pressable>
  );
}

export default function AlertsScreenV3() {
  const { signedIn } = useFateDropId();
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setAlerts([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAlerts(await fetchCanonicalAlerts(50));
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

  const filtered = useMemo(() => filter === 'ALL' ? alerts : alerts.filter((alert) => alert.fateStage === filter), [alerts, filter]);
  const sent = alerts.filter((alert) => alert.delivery?.discord?.status === 'sent').length;
  const issues = alerts.filter((alert) => alert.delivery?.discord && alert.delivery.discord.status !== 'sent').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.violetLight} />}
        showsVerticalScrollIndicator={false}
      >
        <FateDropHeader
          title="Alerts"
          subtitle="CANONICAL SIGNAL INBOX"
          rightAction={<Pressable onPress={() => router.push('/notification-preferences')} style={styles.headerButton}><Ionicons name="options-outline" size={18} color={FateDropColors.text} /></Pressable>}
        />

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>ONE ALERT · EVERY SURFACE</Text>
          <Text style={styles.heroTitle}>The signal that reached Discord lives here too.</Text>
          <Text style={styles.heroCopy}>This inbox uses the same persisted alert IDs as FateDrop delivery telemetry. Background detections and policy-suppressed noise are kept separate.</Text>
          <View style={styles.heroStats}>
            <View><Text style={styles.heroStatValue}>{signedIn ? alerts.length : '—'}</Text><Text style={styles.heroStatLabel}>RECENT ALERTS</Text></View>
            <View><Text style={styles.heroStatValue}>{signedIn ? sent : '—'}</Text><Text style={styles.heroStatLabel}>DISCORD SENT</Text></View>
            <View><Text style={[styles.heroStatValue, issues > 0 && styles.issueValue]}>{signedIn ? issues : '—'}</Text><Text style={styles.heroStatLabel}>DELIVERY ISSUES</Text></View>
          </View>
        </View>

        {!signedIn ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={24} color={FateDropColors.violetLight} />
            <Text style={styles.emptyTitle}>Sign in to your FateDrop ID</Text>
            <Text style={styles.emptyCopy}>Your canonical alert history follows your FateDrop account across the app, Web and delivery surfaces.</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>SIGN IN</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.filterRow}>
              {(['ALL', 'WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'] as Filter[]).map((value) => {
                const active = filter === value;
                const color = value === 'ALL' ? FateDropColors.violetLight : stageMeta[value].color;
                return <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, active && { borderColor: `${color}80`, backgroundColor: `${color}12` }]}><Text style={[styles.filterText, active && { color }]}>{value}</Text></Pressable>;
              })}
            </View>

            <View style={styles.sectionHead}>
              <View><Text style={styles.sectionEyebrow}>LIVE HISTORY</Text><Text style={styles.sectionTitle}>{filter === 'ALL' ? 'Recent alerts' : `${stageMeta[filter].label} alerts`}</Text></View>
              <Pressable onPress={() => router.push('/fatefind')}><Text style={styles.sectionAction}>FateFind →</Text></Pressable>
            </View>

            {error ? <View style={styles.errorCard}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><View style={styles.flex}><Text style={styles.errorTitle}>Canonical inbox unavailable</Text><Text style={styles.errorCopy}>{error}</Text></View></View> : null}

            <View style={styles.alertList}>
              {filtered.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
              {!loading && !error && !filtered.length ? <View style={styles.emptyState}><Ionicons name="radio-outline" size={24} color={FateDropColors.secondary} /><Text style={styles.emptyTitle}>No matching alerts</Text><Text style={styles.emptyCopy}>FateDrop will leave this empty rather than filling the inbox with demo or raw background detections.</Text></View> : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  headerButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(17,19,29,.8)' },
  hero: { position: 'relative', overflow: 'hidden', padding: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(168,85,247,.24)', backgroundColor: 'rgba(9,10,17,.94)', marginBottom: 18 },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -90, top: -110, backgroundColor: 'rgba(124,58,237,.16)' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: FateDropColors.text, fontSize: 28, lineHeight: 31, letterSpacing: -0.8, fontWeight: '900', maxWidth: 330, marginTop: 9 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 10, maxWidth: 350 },
  heroStats: { flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderTopColor: FateDropColors.border, paddingTop: 14 },
  heroStatValue: { color: FateDropColors.text, fontWeight: '900', fontSize: 20 },
  issueValue: { color: FateDropColors.amber },
  heroStatLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  filter: { borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(17,19,29,.66)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  filterText: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: FateDropColors.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.4, marginTop: 3 },
  sectionAction: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '900' },
  alertList: { gap: 10 },
  alertCard: { padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' },
  alertTop: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  stageIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stageImage: { width: '100%', height: '100%' },
  alertTopCopy: { flex: 1 },
  alertMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stageLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  time: { color: FateDropColors.muted, fontSize: 8 },
  alertTitle: { color: FateDropColors.text, fontSize: 14, lineHeight: 18, fontWeight: '900', marginTop: 3 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 11 },
  retailer: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '800', flex: 1 },
  category: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  price: { color: FateDropColors.text, fontSize: 11, fontWeight: '800', marginTop: 3 },
  observed: { color: FateDropColors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 0.65, marginTop: 6 },
  reason: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 7 },
  alertFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: FateDropColors.border, marginTop: 13, paddingTop: 11 },
  deliveryPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryDot: { width: 6, height: 6, borderRadius: 3 },
  deliveryText: { fontSize: 8, fontWeight: '900' },
  openAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  openText: { color: FateDropColors.text, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  emptyState: { alignItems: 'center', padding: 28, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.82)' },
  emptyTitle: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 10 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  primaryButton: { marginTop: 16, backgroundColor: FateDropColors.violet, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  primaryButtonText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, marginBottom: 10, borderRadius: 15, borderWidth: 1, borderColor: `${FateDropColors.amber}50`, backgroundColor: `${FateDropColors.amber}0C` },
  errorTitle: { color: FateDropColors.amber, fontSize: 10, fontWeight: '900' },
  errorCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  flex: { flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
