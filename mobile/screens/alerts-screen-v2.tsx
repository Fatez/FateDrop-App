import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanionStage } from '@/components/companion-stage';
import { DevelopmentAlertTester } from '@/components/development-alert-tester';
import { AbstractHero, FateDropBackground, FateDropHeader, StatusBadge, statusColors } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useCompanion } from '@/contexts/companion-context';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import type { CompanionReaction } from '@/lib/companion-contract';
import {
  registerForStockAlerts,
  unregisterStockAlerts,
  type DevelopmentSignalNotification,
} from '@/lib/notifications';
import {
  companionLineForSignal,
  signalPresentation,
  type MarketEvent,
} from '@/lib/signal-presentation';
import { loadCanonicalAlertInbox } from '@/services/alerts';
import { updateRemoteNotificationPreferences } from '@/services/fatedrop-id';

const money = (pence?: number | null) => pence == null ? 'delivery unknown' : `£${(pence / 100).toFixed(2)} delivered`;
const pounds = (pence?: number | null) => pence == null ? null : `£${(pence / 100).toFixed(2)}`;
const agoEpoch = (epoch: number) => {
  const minutes = Math.max(0, Math.floor((Date.now() - epoch * 1000) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};
const agoDate = (value?: string) => {
  if (!value) return 'Recent';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recent';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};

type VerdictLine = { text: string; color: string } | null;

function signalPriceContext(event: MarketEvent) {
  const itemPrice = event.product?.pricePence;
  const delivered = event.product?.deliveredPricePence;
  const intelligence = event.priceIntelligence;
  const rrp = intelligence?.rrpPence ?? event.product?.rrpPence;
  const rrpDelta = intelligence?.rrpDeltaPercent;

  if (itemPrice == null && delivered == null && rrp == null) return null;

  const parts: string[] = [];
  if (itemPrice != null) parts.push(`${pounds(itemPrice)} item`);
  if (delivered != null && delivered !== itemPrice) parts.push(`${pounds(delivered)} delivered`);

  if (rrp != null && rrp > 0) {
    if (rrpDelta != null) {
      const direction = rrpDelta === 0
        ? 'at RRP'
        : rrpDelta < 0
          ? `${Math.abs(rrpDelta).toFixed(1)}% below RRP`
          : `${rrpDelta.toFixed(1)}% above RRP`;
      parts.push(`RRP ${pounds(rrp)} · ${direction}`);
    } else {
      parts.push(`RRP ${pounds(rrp)}`);
    }
  }

  return parts.join(' · ') || null;
}

function signalVerdict(event: MarketEvent): VerdictLine {
  const intelligence = event.priceIntelligence;
  if (!intelligence?.verdict) return null;

  if (intelligence.verdict === 'BETTER_OFFER_FOUND' && intelligence.lowestKnown?.comparisonPricePence != null) {
    const lowest = pounds(intelligence.lowestKnown.comparisonPricePence);
    const saving = pounds(intelligence.savingsPence);
    const savingPercent = intelligence.savingsPercent == null ? null : `${intelligence.savingsPercent.toFixed(1)}%`;
    const basis = intelligence.comparisonBasis === 'delivered' ? 'delivered' : 'item price';
    const retailer = intelligence.lowestKnown.retailer || 'another retailer';
    const savingCopy = saving ? ` · save ${saving}${savingPercent ? ` (${savingPercent})` : ''}` : '';
    return {
      text: `BETTER OFFER FOUND · ${lowest} at ${retailer}${savingCopy} · ${basis} comparison`,
      color: FateDropColors.amber,
    };
  }

  if (intelligence.verdict === 'LOWEST_KNOWN') {
    const basis = intelligence.comparisonBasis === 'delivered' ? 'delivered price' : 'item price';
    return {
      text: `LOWEST KNOWN · Best comparable ${basis} currently in FateDrop`,
      color: FateDropColors.mint,
    };
  }

  return {
    text: 'NO FAIR COMPARISON · Delivery or comparable pricing is not complete enough yet',
    color: FateDropColors.muted,
  };
}

function developmentAlert(signal: DevelopmentSignalNotification) {
  switch (signal) {
    case 'echo':
      return {
        label: 'Echo',
        color: FateDropColors.violetLight,
        title: 'Development Echo signal',
        detail: 'Early movement detected. This is not confirmed stock.',
        meta: 'FateDrop test network · Just now',
        price: null as string | null,
        verdict: null as VerdictLine,
      };
    case 'manifested':
      return {
        label: 'Manifested',
        color: FateDropColors.mint,
        title: 'Development confirmed-stock signal',
        detail: 'Confirmed. Stock is live.',
        meta: 'FateDrop test retailer · Just now',
        price: '£54.99 item · RRP £49.99 · 10.0% above RRP',
        verdict: { text: 'BETTER OFFER FOUND · £49.99 at FateDrop test retailer · save £5.00 (9.1%) · item price comparison', color: FateDropColors.amber } as VerdictLine,
      };
    case 'vanished':
      return {
        label: 'Vanished',
        color: FateDropColors.coral,
        title: 'Development vanished signal',
        detail: 'Observed availability has disappeared.',
        meta: 'FateDrop test retailer · Just now',
        price: null as string | null,
        verdict: null as VerdictLine,
      };
    case 'fatematch':
      return {
        label: 'FateMatch',
        color: FateDropColors.cyan,
        title: 'Development FateMatch',
        detail: 'Match found. This observed offer satisfies one of your hosted hunts.',
        meta: 'FateDrop test retailer · £49.99 delivered · Just now',
        price: null as string | null,
        verdict: null as VerdictLine,
      };
    case 'major':
      return {
        label: 'Major',
        color: FateDropColors.amber,
        title: 'Development major confirmed signal',
        detail: 'High-priority confirmed signal. Celebrate is reserved for moments like this.',
        meta: 'FateDrop test network · Just now',
        price: null as string | null,
        verdict: null as VerdictLine,
      };
  }
}

export default function AlertsScreenV2() {
  const { snapshot, signedIn, refresh, syncing } = useFateDropId();
  const { selectedCompanion, selectCompanion } = useCompanion();
  const params = useLocalSearchParams<{ alertId?: string | string[] }>();
  const requestedAlertId = Array.isArray(params.alertId) ? params.alertId[0] : params.alertId;
  const [pushWorking, setPushWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signalEvents, setSignalEvents] = useState<MarketEvent[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedFateMatchId, setSelectedFateMatchId] = useState<string | null>(null);
  const [developmentSignal, setDevelopmentSignal] = useState<DevelopmentSignalNotification | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;

    if (signedIn) void refresh();

    const loadSignals = async () => {
      if (!signedIn) {
        setSignalEvents([]);
        setSelectedEventId(null);
        setSignalsLoading(false);
        return;
      }

      setSignalsLoading(true);
      try {
        const data = await loadCanonicalAlertInbox(requestedAlertId);
        if (!active) return;
        const events = data.alerts.slice(0, 30);
        setSignalEvents(events);
        setSelectedEventId((current) => {
          if (requestedAlertId && events.some((event) => event.id === requestedAlertId)) return requestedAlertId;
          if (current && events.some((event) => event.id === current)) return current;
          return events[0]?.id ?? null;
        });
      } catch {
        if (active) setSignalEvents([]);
      } finally {
        if (active) setSignalsLoading(false);
      }
    };

    void loadSignals();
    return () => {
      active = false;
    };
  }, [refresh, requestedAlertId, signedIn]));

  const preferences = snapshot?.notificationPreferences;
  const fateFinds = snapshot?.fateFinds || [];
  const fateMatches = snapshot?.fateMatches || [];
  const selectedEvent = signalEvents.find((event) => event.id === selectedEventId) ?? null;
  const selectedFateMatch = fateMatches.find((match) => match.id === selectedFateMatchId) ?? null;
  const selectedPresentation = selectedEvent ? signalPresentation(selectedEvent) : null;

  const activeReaction: CompanionReaction = developmentSignal ?? (selectedFateMatch ? 'fatematch' : selectedPresentation?.reaction ?? 'idle');
  const companionName = selectedCompanion === 'male' ? 'KAEL' : 'NYRA';
  const companionCode = selectedCompanion === 'male' ? 'K-01' : 'N-02';

  const selectedAlert = useMemo(() => {
    if (developmentSignal) return developmentAlert(developmentSignal);
    if (selectedFateMatch) {
      return {
        label: 'FateMatch',
        color: FateDropColors.cyan,
        title: selectedFateMatch.title,
        detail: 'Match found. This observed offer satisfies one of your hosted hunts.',
        meta: `${selectedFateMatch.retailerName} · ${money(selectedFateMatch.deliveredPricePence)} · ${agoEpoch(selectedFateMatch.matchedAt)}`,
        price: null as string | null,
        verdict: null as VerdictLine,
      };
    }
    if (selectedEvent && selectedPresentation) {
      return {
        label: selectedPresentation.label,
        color: statusColors[selectedPresentation.tone],
        title: selectedEvent.product?.title || selectedEvent.title || 'Network activity',
        detail: companionLineForSignal(selectedPresentation),
        meta: `${selectedEvent.retailer || 'Connected retailer'} · ${agoDate(selectedEvent.detectedAt)}`,
        price: signalPriceContext(selectedEvent),
        verdict: signalVerdict(selectedEvent),
      };
    }
    return null;
  }, [developmentSignal, selectedEvent, selectedFateMatch, selectedPresentation]);

  const toggle = async (key: 'echo' | 'manifested' | 'vanished' | 'priceChange' | 'fateMatch' | 'web' | 'discord') => {
    if (!preferences) return;
    setMessage(null);
    try {
      await updateRemoteNotificationPreferences({ [key]: !preferences[key] });
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Preference could not sync.');
    }
  };

  const togglePush = async () => {
    setPushWorking(true);
    setMessage(null);
    try {
      const result = preferences?.push ? await unregisterStockAlerts() : await registerForStockAlerts();
      setMessage(result.enabled ? 'Push enabled on this device.' : 'Push disabled on this device.');
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Push could not be updated.');
    } finally {
      setPushWorking(false);
    }
  };

  const previewDevelopmentSignal = (signal: DevelopmentSignalNotification) => {
    setSelectedEventId(null);
    setSelectedFateMatchId(null);
    setDevelopmentSignal(signal);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader
          title="Alerts"
          rightAction={<Pressable onPress={() => router.push('/fatefind')} style={styles.headerAction}><Ionicons name="telescope" size={18} color={FateDropColors.violetLight} /></Pressable>}
        />
        <AbstractHero
          eyebrow="Signal inbox"
          title="See the signal. Read the movement."
          subtitle="Your Companion reacts to the alert you are viewing. Echo stays early intelligence; Manifested means confirmed availability."
          icon="notifications"
        />

        <Header eyebrow="YOUR COMPANION" title={`${companionName} · ${companionCode}`} />
        <View style={styles.companionChooser}>
          <Pressable onPress={() => selectCompanion('male')} style={[styles.companionChoice, selectedCompanion === 'male' && styles.companionChoiceActive]}>
            <Text style={[styles.companionChoiceText, selectedCompanion === 'male' && styles.companionChoiceTextActive]}>KAEL</Text>
          </Pressable>
          <Pressable onPress={() => selectCompanion('female')} style={[styles.companionChoice, selectedCompanion === 'female' && styles.companionChoiceActive]}>
            <Text style={[styles.companionChoiceText, selectedCompanion === 'female' && styles.companionChoiceTextActive]}>NYRA</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/companion', params: { variant: selectedCompanion } })} style={styles.companionManage}>
            <Text style={styles.companionManageText}>OPEN COMPANION</Text>
            <Ionicons name="arrow-forward" size={12} color={FateDropColors.cyan} />
          </Pressable>
        </View>

        <CompanionStage variant={selectedCompanion} reaction={activeReaction} />

        <View style={styles.selectedAlertCard}>
          {selectedAlert ? <>
            <View style={styles.selectedAlertTop}>
              <View style={[styles.signalDot, { backgroundColor: selectedAlert.color }]} />
              <Text style={[styles.selectedAlertLabel, { color: selectedAlert.color }]}>{selectedAlert.label.toUpperCase()}</Text>
            </View>
            <Text style={styles.selectedAlertTitle}>{selectedAlert.title}</Text>
            <Text style={styles.selectedAlertDetail}>{selectedAlert.detail}</Text>
            <Text style={styles.selectedAlertMeta}>{selectedAlert.meta}</Text>
            {selectedAlert.price ? <Text style={styles.selectedAlertPrice}>{selectedAlert.price}</Text> : null}
            {selectedAlert.verdict ? <Text style={[styles.selectedAlertVerdict, { color: selectedAlert.verdict.color }]}>{selectedAlert.verdict.text}</Text> : null}
          </> : <>
            <Text style={styles.selectedAlertLabel}>IDLE</Text>
            <Text style={styles.selectedAlertTitle}>No signal selected</Text>
            <Text style={styles.selectedAlertDetail}>Select a recent signal below and {companionName} will react to its FateDrop state.</Text>
          </>}
        </View>

        <DevelopmentAlertTester onPreview={previewDevelopmentSignal} />

        <Header eyebrow="RECENT SIGNALS" title="Network alert feed" />
        <View style={styles.list}>
          {signalsLoading && !signalEvents.length ? <Compact title="Reading the network" text="Loading observed FateDrop activity…" /> : null}
          {!signalsLoading && !signalEvents.length ? <Compact title="No recent signals available" text="FateDrop does not fabricate sample alerts when the activity source has nothing to report." /> : null}
          {signalEvents.map((event) => {
            const presentation = signalPresentation(event);
            const selected = !developmentSignal && !selectedFateMatch && event.id === selectedEventId;
            const verdict = signalVerdict(event);
            const priceContext = signalPriceContext(event);
            return (
              <Pressable
                key={event.id}
                onPress={() => {
                  setDevelopmentSignal(null);
                  setSelectedFateMatchId(null);
                  setSelectedEventId(event.id);
                }}
                style={[styles.signalCard, selected && styles.signalCardSelected]}
              >
                <View style={[styles.signalIcon, { backgroundColor: `${statusColors[presentation.tone]}18` }]}>
                  <Ionicons name={presentation.icon} size={17} color={statusColors[presentation.tone]} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.signalLabel, { color: statusColors[presentation.tone] }]}>{presentation.label.toUpperCase()}</Text>
                  <Text style={styles.cardTitle}>{event.product?.title || event.title || 'Network activity'}</Text>
                  <Text style={styles.cardDetail}>{event.retailer || 'Connected retailer'} · {agoDate(event.detectedAt)}</Text>
                  {priceContext ? <Text style={styles.signalPrice}>{priceContext}</Text> : null}
                  {verdict ? <Text style={[styles.signalVerdict, { color: verdict.color }]}>{verdict.text}</Text> : null}
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'chevron-forward'} size={17} color={selected ? FateDropColors.cyan : FateDropColors.muted} />
              </Pressable>
            );
          })}
        </View>

        {!signedIn ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Connect FateDrop ID</Text>
            <Text style={styles.emptyText}>Sign in to sync hosted hunts, FateMatch history and notification delivery across web and mobile.</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable>
          </View>
        ) : <>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statValue}>{fateFinds.filter((find) => find.enabled !== false).length}</Text><Text style={styles.statLabel}>Hosted FateFinds</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{fateMatches.length}</Text><Text style={styles.statLabel}>FateMatches</Text></View>
          </View>

          <Header eyebrow="ACTIVE HUNTS" title="FateFind" action={() => router.push('/fatefind')} />
          <View style={styles.list}>
            {fateFinds.length ? fateFinds.map((find) => (
              <Pressable key={find.id} onPress={() => router.push('/fatefind')} style={styles.card}>
                <View style={styles.icon}><Ionicons name="cloud-done" size={17} color={FateDropColors.violetLight} /></View>
                <View style={styles.copy}><Text style={styles.cardTitle}>{String(find.query || find.queryText || 'FateFind')}</Text><Text style={styles.cardDetail}>Evaluated by FateDrop Cloud while your app is closed.</Text></View>
                <StatusBadge label={find.enabled === false ? 'Paused' : 'Watching'} color={find.enabled === false ? FateDropColors.muted : FateDropColors.mint} />
              </Pressable>
            )) : <Compact title="No hosted hunts yet" text="Create a FateFind and let the network watch it for you." />}
          </View>

          <Header eyebrow="PERSONAL HISTORY" title="FateMatch results" />
          <View style={styles.list}>
            {fateMatches.length ? fateMatches.slice(0, 50).map((match) => {
              const selected = !developmentSignal && match.id === selectedFateMatchId;
              return (
                <Pressable
                  key={match.id}
                  onPress={() => {
                    setDevelopmentSignal(null);
                    setSelectedEventId(null);
                    setSelectedFateMatchId(match.id);
                  }}
                  style={[styles.match, selected && styles.matchSelected]}
                >
                  <View style={styles.matchIcon}><Ionicons name="checkmark" size={16} color={FateDropColors.mint} /></View>
                  <View style={styles.copy}>
                    <Text style={styles.matchLabel}>FATEMATCH</Text>
                    <Text style={styles.cardTitle}>{match.title}</Text>
                    <Text style={styles.cardDetail}>{match.retailerName} · {money(match.deliveredPricePence)} · {agoEpoch(match.matchedAt)}</Text>
                  </View>
                  <Ionicons name={selected ? 'radio-button-on' : 'chevron-forward'} size={17} color={selected ? FateDropColors.cyan : FateDropColors.muted} />
                </Pressable>
              );
            }) : <Compact title="No FateMatches yet" text="A result appears here when an observed offer satisfies one of your hosted FateFinds." />}
          </View>

          <Header eyebrow="DELIVERY" title="Notification channels" />
          <View style={styles.preference}>
            <View style={styles.copy}><Text style={styles.cardTitle}>Push on this device</Text><Text style={styles.cardDetail}>Requires explicit device permission and a signed-in FateDrop ID.</Text></View>
            <Pressable disabled={pushWorking} onPress={() => void togglePush()}><StatusBadge label={preferences?.push ? 'On' : 'Off'} color={preferences?.push ? FateDropColors.mint : FateDropColors.muted} /></Pressable>
          </View>
          <View style={styles.prefs}>
            {(['fateMatch', 'priceChange', 'echo', 'manifested', 'vanished', 'web', 'discord'] as const).map((key) => (
              <Pressable key={key} onPress={() => void toggle(key)} style={styles.pref}>
                <Text style={styles.prefName}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</Text>
                <Text style={preferences?.[key] ? styles.on : styles.off}>{preferences?.[key] ? 'ON' : 'OFF'}</Text>
              </Pressable>
            ))}
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.sync}>{syncing ? 'Syncing with FateDrop ID…' : `Last sync ${snapshot ? agoEpoch(snapshot.syncedAt) : 'unavailable'}`}</Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: () => void }) {
  return <View style={styles.section}><View><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action ? <Pressable onPress={action}><Text style={styles.link}>Manage</Text></Pressable> : null}</View>;
}

function Compact({ title, text }: { title: string; text: string }) {
  return <View style={styles.compact}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  headerAction: { padding: 9, borderRadius: 12, backgroundColor: FateDropColors.glass },
  companionChooser: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  companionChoice: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  companionChoiceActive: { borderColor: FateDropColors.violetLight, backgroundColor: `${FateDropColors.violet}22` },
  companionChoiceText: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  companionChoiceTextActive: { color: FateDropColors.violetLight },
  companionManage: { marginLeft: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 9 },
  companionManageText: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  selectedAlertCard: { marginTop: 10, marginBottom: 18, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  selectedAlertTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  signalDot: { width: 7, height: 7, borderRadius: 4 },
  selectedAlertLabel: { color: FateDropColors.violetLight, fontSize: 8, fontWeight: '900', letterSpacing: 1.25 },
  selectedAlertTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' },
  selectedAlertDetail: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 5 },
  selectedAlertMeta: { color: FateDropColors.muted, fontSize: 9, marginTop: 8 },
  selectedAlertPrice: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '800', marginTop: 5 },
  selectedAlertVerdict: { fontSize: 9, fontWeight: '900', lineHeight: 14, marginTop: 6 },
  signalCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  signalCardSelected: { borderColor: `${FateDropColors.cyan}70`, backgroundColor: `${FateDropColors.cyan}08` },
  signalIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  signalLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  signalPrice: { color: FateDropColors.cyan, fontSize: 8, marginTop: 4 },
  signalVerdict: { fontSize: 8, fontWeight: '900', lineHeight: 12, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 18 },
  stat: { flex: 1, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  statValue: { color: FateDropColors.text, fontWeight: '900', fontSize: 22 },
  statLabel: { color: FateDropColors.muted, fontSize: 9, marginTop: 4 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, marginBottom: 9 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: FateDropColors.text, fontWeight: '900', fontSize: 19, marginTop: 3 },
  link: { color: FateDropColors.violetLight, fontSize: 11, fontWeight: '900' },
  list: { gap: 9, marginBottom: 17 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}14` },
  copy: { flex: 1 },
  cardTitle: { color: FateDropColors.text, fontWeight: '900', fontSize: 12 },
  cardDetail: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.mint}35`, backgroundColor: FateDropColors.glass },
  matchSelected: { borderColor: `${FateDropColors.cyan}70`, backgroundColor: `${FateDropColors.cyan}08` },
  matchIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.mint}16` },
  matchLabel: { color: FateDropColors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginBottom: 3 },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginBottom: 9 },
  prefs: { gap: 7 },
  pref: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 13, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  prefName: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '800' },
  on: { color: FateDropColors.mint, fontWeight: '900', fontSize: 9 },
  off: { color: FateDropColors.muted, fontWeight: '900', fontSize: 9 },
  empty: { padding: 22, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginTop: 8 },
  compact: { padding: 17, alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  emptyTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900' },
  emptyText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  primary: { marginTop: 12, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontWeight: '900' },
  message: { color: FateDropColors.cyan, fontSize: 10, marginTop: 12 },
  sync: { color: FateDropColors.muted, fontSize: 8, textAlign: 'center', marginTop: 16 },
});