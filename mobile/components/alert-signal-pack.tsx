import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import type { CanonicalOfferLink, CanonicalSignalThreadEntry, MarketEvent } from '@/lib/signal-presentation';
import { openTrackedRetailerLink } from '@/services/outbound-links';

const pounds = (pence?: number | null) => pence == null ? null : `£${(pence / 100).toFixed(2)}`;

function stageColor(stage?: string) {
  if (stage === 'MANIFESTED') return FateDropColors.mint;
  if (stage === 'VANISHED') return FateDropColors.coral;
  if (stage === 'ECHO') return FateDropColors.violetLight;
  return FateDropColors.cyan;
}

function stageLabel(entry: CanonicalSignalThreadEntry) {
  if (entry.fateStage === 'ECHO') return 'Echo';
  if (entry.fateStage === 'MANIFESTED') return 'Manifested';
  if (entry.fateStage === 'VANISHED') return 'Vanished';
  return 'Network';
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recent';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(date);
}

function offerPrice(link: CanonicalOfferLink) {
  if (link.deliveredPricePence != null) return `${pounds(link.deliveredPricePence)} delivered`;
  if (link.itemPricePence != null) return `${pounds(link.itemPricePence)} item · delivery unknown`;
  return 'Price unavailable';
}

export function AlertSignalPack({ event }: { event: MarketEvent }) {
  const pack = event.preparedLinks;
  const thread = event.signalThread ?? [];
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!pack) return null;

  const openOffer = async (link: CanonicalOfferLink, placement: string) => {
    setActionMessage(null);
    try {
      await openTrackedRetailerLink({
        destinationUrl: link.url,
        retailerId: link.retailerId,
        offerId: link.offerId,
        placement,
      });
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'This retailer link could not be opened.');
    }
  };

  const distinctLowest = pack.lowestKnown && pack.lowestKnown.offerId !== pack.primary.offerId ? pack.lowestKnown : null;
  const distinctOfficial = pack.officialReference && pack.officialReference.url !== pack.primary.url ? pack.officialReference : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SIGNAL PACK</Text>
          <Text style={styles.title}>Prepared intelligence & links</Text>
        </View>
        <View style={styles.readyBadge}><Text style={styles.readyText}>READY</Text></View>
      </View>

      <Text style={styles.explainer}>
        {event.fateStage === 'ECHO'
          ? 'Early intelligence only. FateDrop has prepared the product and comparison routes while it watches for confirmation.'
          : event.fateStage === 'VANISHED'
            ? 'This observed availability has gone. Prepared alternatives remain available below when the network still sees them live.'
            : 'Confirmed availability. Open the retailer, compare True Price, or inspect another live offer.'}
      </Text>

      <View style={styles.primaryActions}>
        <Pressable onPress={() => void openOffer(pack.primary, 'alert-signal-primary')} style={[styles.action, styles.primaryAction]}>
          <Ionicons name={pack.primary.intent === 'buy' ? 'bag-handle' : 'search'} size={14} color={FateDropColors.text} />
          <Text style={styles.primaryActionText}>{pack.primary.label}</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/true-price', params: { query: pack.compareQuery } })} style={styles.action}>
          <Ionicons name="pricetags" size={14} color={FateDropColors.cyan} />
          <Text style={styles.actionText}>COMPARE TRUE PRICE</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/fatefind', params: { query: pack.fateFindQuery } })} style={styles.action}>
          <Ionicons name="telescope" size={14} color={FateDropColors.violetLight} />
          <Text style={styles.actionText}>CREATE FATEFIND</Text>
        </Pressable>
      </View>

      {distinctLowest ? (
        <Pressable onPress={() => void openOffer(distinctLowest, 'alert-signal-lowest')} style={styles.bestOffer}>
          <View style={styles.bestIcon}><Ionicons name="trending-down" size={15} color={FateDropColors.mint} /></View>
          <View style={styles.copy}>
            <Text style={styles.bestLabel}>LOWEST KNOWN LINK READY</Text>
            <Text style={styles.offerTitle}>{distinctLowest.retailer}</Text>
            <Text style={styles.offerMeta}>{offerPrice(distinctLowest)}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={FateDropColors.mint} />
        </Pressable>
      ) : null}

      {distinctOfficial ? (
        <Pressable onPress={() => void openOffer(distinctOfficial, 'alert-signal-official-reference')} style={styles.reference}>
          <Ionicons name="shield-checkmark" size={15} color={FateDropColors.cyan} />
          <View style={styles.copy}>
            <Text style={styles.referenceLabel}>OFFICIAL / RRP REFERENCE</Text>
            <Text style={styles.offerTitle}>{distinctOfficial.retailer}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={FateDropColors.cyan} />
        </Pressable>
      ) : null}

      {thread.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SIGNAL TRAIL</Text>
          <View style={styles.timeline}>
            {thread.map((entry) => {
              const current = entry.id === event.id;
              const color = stageColor(entry.fateStage);
              return (
                <View key={entry.id} style={[styles.timelineRow, current && styles.timelineCurrent]}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: color }]} />
                    <View style={styles.timelineLine} />
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.timelineTop}>
                      <Text style={[styles.timelineStage, { color }]}>{stageLabel(entry).toUpperCase()}</Text>
                      <Text style={styles.timelineTime}>{timeLabel(entry.occurredAt)}</Text>
                    </View>
                    <Text style={styles.timelineReason}>{entry.reason || 'Network state changed.'}</Text>
                    <Text style={styles.timelineMeta}>{entry.retailer}{entry.pricePence == null ? '' : ` · ${pounds(entry.pricePence)}`}{current ? ' · CURRENT ALERT' : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {pack.alternatives.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{event.fateStage === 'VANISHED' ? 'STILL LIVE ELSEWHERE' : 'OTHER LIVE OFFERS'}</Text>
          <View style={styles.alternatives}>
            {pack.alternatives.slice(0, 6).map((alternative) => (
              <Pressable key={alternative.offerId} onPress={() => void openOffer(alternative, 'alert-signal-alternative')} style={styles.alternative}>
                <View style={styles.copy}>
                  <Text style={styles.offerTitle}>{alternative.retailer}</Text>
                  <Text style={styles.offerMeta}>{offerPrice(alternative)} · {alternative.stockStatus || 'observed'}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={FateDropColors.violetLight} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {actionMessage ? <Text style={styles.error}>{actionMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 10, paddingTop: 13, borderTopWidth: 1, borderTopColor: FateDropColors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: FateDropColors.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  readyBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: `${FateDropColors.mint}16`, borderWidth: 1, borderColor: `${FateDropColors.mint}35` },
  readyText: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  explainer: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14 },
  primaryActions: { gap: 7 },
  action: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryAction: { borderColor: `${FateDropColors.violetLight}45`, backgroundColor: `${FateDropColors.violet}16` },
  primaryActionText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  actionText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.45 },
  bestOffer: { padding: 12, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.mint}35`, backgroundColor: `${FateDropColors.mint}08`, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bestIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.mint}12` },
  bestLabel: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  reference: { padding: 12, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.cyan}28`, backgroundColor: `${FateDropColors.cyan}06`, flexDirection: 'row', alignItems: 'center', gap: 10 },
  referenceLabel: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  section: { gap: 7, marginTop: 3 },
  sectionLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  timeline: { gap: 3 },
  timelineRow: { flexDirection: 'row', gap: 9, paddingVertical: 7, paddingHorizontal: 7, borderRadius: 11 },
  timelineCurrent: { backgroundColor: `${FateDropColors.cyan}07` },
  timelineRail: { width: 10, alignItems: 'center' },
  timelineDot: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
  timelineLine: { flex: 1, width: 1, minHeight: 20, marginTop: 3, backgroundColor: FateDropColors.border },
  timelineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timelineStage: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  timelineTime: { color: FateDropColors.muted, fontSize: 7 },
  timelineReason: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 13, marginTop: 2 },
  timelineMeta: { color: FateDropColors.muted, fontSize: 7, marginTop: 3 },
  alternatives: { gap: 6 },
  alternative: { minHeight: 44, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, flexDirection: 'row', alignItems: 'center', gap: 9 },
  copy: { flex: 1 },
  offerTitle: { color: FateDropColors.text, fontSize: 10, fontWeight: '900' },
  offerMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 },
  error: { color: FateDropColors.coral, fontSize: 8, lineHeight: 12 },
});
