import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchCanonicalAlerts, type CanonicalMobileAlert } from '@/services/canonical-alerts';
import { openExternalRetailerLink } from '@/services/outbound-links';

const POKEMON_CENTER_UK_ID = 'pokemon-center-uk';

function normalize(value: string | null | undefined) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isPokemonCenterUk(alert: CanonicalMobileAlert) {
  return alert.retailerId === POKEMON_CENTER_UK_ID || normalize(alert.retailer) === 'pokemon center uk';
}

function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed));
}

function stockLabel(value: string | null | undefined) {
  const key = String(value || '').toLowerCase();
  if (key === 'in_stock') return 'In stock';
  if (key === 'low_stock') return 'Low stock';
  if (key === 'preorder') return 'Pre-order';
  if (key === 'coming_soon') return 'Coming soon';
  if (key === 'out_of_stock') return 'Out of stock';
  return key ? key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) : null;
}

function stageColor(stage: CanonicalMobileAlert['fateStage']) {
  if (stage === 'WHISPER') return FateDropColors.whisper;
  if (stage === 'ECHO') return FateDropColors.echo;
  if (stage === 'MANIFESTED') return FateDropColors.manifested;
  return FateDropColors.vanished;
}

export default function PokemonCenterUkScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCanonicalAlerts(50);
      setAlerts(next.filter(isPokemonCenterUk));
    } catch (cause) {
      setAlerts([]);
      setError(cause instanceof Error ? cause.message : 'Pokémon Center UK intelligence is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const upcoming = useMemo(() => alerts.filter((alert) => Boolean(
    alert.operatorIntelligence?.expectedLabel
    || alert.operatorIntelligence?.expectedFrom
    || alert.operatorIntelligence?.expectedTo
    || ['preorder', 'coming_soon'].includes(String(alert.product?.stockStatus || '').toLowerCase()),
  )), [alerts]);

  const activity = useMemo(() => [...alerts].sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt)), [alerts]);

  return (
    <View style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>RETAILER INTELLIGENCE</Text>
            <Text style={styles.title}>Pokémon Center UK</Text>
          </View>
        </View>

        <View style={styles.introCard}>
          <Ionicons name="radio-outline" size={22} color={FateDropColors.goldBright} />
          <View style={styles.flex}>
            <Text style={styles.introTitle}>Activity, pre-orders and release evidence</Text>
            <Text style={styles.introCopy}>Only canonical FateDrop evidence is shown here. If a date or availability window has not been verified, it stays unknown.</Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionEyebrow}>UPCOMING / PRE-ORDER</Text>
          <Text style={styles.sectionCount}>{upcoming.length}</Text>
        </View>
        {upcoming.length ? upcoming.map((alert) => <PcukAlertCard key={`upcoming-${alert.id}`} alert={alert} />) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{loading ? 'Checking canonical evidence…' : 'No verified upcoming window to show'}</Text>
            <Text style={styles.emptyCopy}>That does not mean nothing is planned — only that FateDrop does not currently have a verified pre-order/release window in this App contract.</Text>
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionEyebrow}>LATEST ACTIVITY</Text>
          <Text style={styles.sectionCount}>{activity.length}</Text>
        </View>
        {error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Status unavailable</Text>
            <Text style={styles.emptyCopy}>{error}</Text>
          </View>
        ) : activity.length ? activity.map((alert) => <PcukAlertCard key={`activity-${alert.id}`} alert={alert} />) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{loading ? 'Checking Pokémon Center UK…' : 'No canonical activity detected'}</Text>
            <Text style={styles.emptyCopy}>FateDrop will not manufacture activity from stale or unverified evidence.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PcukAlertCard({ alert }: { alert: CanonicalMobileAlert }) {
  const expectedLabel = alert.operatorIntelligence?.expectedLabel || null;
  const expectedFrom = dateLabel(alert.operatorIntelligence?.expectedFrom);
  const expectedTo = dateLabel(alert.operatorIntelligence?.expectedTo);
  const stock = stockLabel(alert.product?.stockStatus);
  const detected = dateLabel(alert.detectedAt);
  const expectedWindow = expectedFrom && expectedTo
    ? `${expectedFrom} → ${expectedTo}`
    : expectedFrom || expectedTo;
  const color = stageColor(alert.fateStage);

  const openProduct = useCallback(() => {
    if (!alert.productUrl) return;
    void openExternalRetailerLink({
      destinationUrl: alert.productUrl,
      retailerId: alert.retailerId || POKEMON_CENTER_UK_ID,
      offerId: alert.offerId || undefined,
      placement: 'pokemon-center-uk-intelligence',
    });
  }, [alert.offerId, alert.productUrl, alert.retailerId]);

  return (
    <Pressable disabled={!alert.productUrl} onPress={openProduct} style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}>
      <View style={styles.alertTop}>
        <View style={[styles.stagePill, { borderColor: color }]}><Text style={[styles.stageText, { color }]}>{alert.fateStage}</Text></View>
        {stock ? <Text style={styles.stock}>{stock}</Text> : null}
      </View>
      <Text style={styles.alertTitle}>{alert.product?.title || alert.title}</Text>
      {expectedLabel ? <Text style={styles.expectedLabel}>{expectedLabel}</Text> : null}
      {expectedWindow ? <Text style={styles.expectedWindow}>{expectedWindow}</Text> : null}
      <View style={styles.alertFoot}>
        <Text style={styles.detected}>{detected ? `Detected ${detected}` : 'Detection time unavailable'}</Text>
        {alert.productUrl ? <Ionicons name="open-outline" size={15} color={FateDropColors.goldBright} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#05070B' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  eyebrow: { color: FateDropColors.goldBright, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 10, letterSpacing: 1.1 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 28, letterSpacing: -0.7, marginTop: 3 },
  introCard: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(210,182,111,0.2)', backgroundColor: 'rgba(210,182,111,0.055)', marginBottom: 24 },
  introTitle: { color: FateDropColors.ivory, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 15 },
  introCopy: { color: FateDropColors.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 5 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.muted, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 10, letterSpacing: 1 },
  sectionCount: { color: FateDropColors.muted, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 11 },
  emptyCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.025)', marginBottom: 18 },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 14 },
  emptyCopy: { color: FateDropColors.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 5 },
  alertCard: { padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.075)', backgroundColor: 'rgba(10,12,20,0.92)', marginBottom: 10 },
  alertTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stagePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  stageText: { fontFamily: Fonts.sans, fontWeight: '700', fontSize: 9, letterSpacing: 0.7 },
  stock: { color: FateDropColors.muted, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 10 },
  alertTitle: { color: FateDropColors.ivory, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 15, lineHeight: 20, marginTop: 10 },
  expectedLabel: { color: FateDropColors.goldBright, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 12, marginTop: 8 },
  expectedWindow: { color: FateDropColors.ivory, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
  alertFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 11 },
  detected: { flex: 1, color: FateDropColors.muted, fontFamily: Fonts.sans, fontSize: 10 },
  pressed: { opacity: 0.72 },
});
