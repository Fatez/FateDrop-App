import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropColors } from '@/constants/theme';
import { openTrackedRetailerLink } from '@/services/outbound-links';

export type LocalRadarOperatorNoticeData = {
  localIntelId: string;
  stage: 'WHISPER' | 'ECHO' | '';
  presentationType: 'big_fate_signal' | '';
  physicalEvidenceState: 'expected' | 'reported' | 'verified' | 'expired' | '';
  availabilityScope: string;
  availabilityVerified: boolean;
  retailerId: string;
  retailerName: string;
  retailerUrl: string;
  ctaLabel: string;
  productTitle: string;
  expectedFrom: string;
  expectedTo: string;
  expectedLabel: string;
  branchCount: number;
  evidenceObservedAt: string;
  intelligenceSurfaceId: string;
  radiusTargeted: boolean;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function dateLabel(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function expectedCopy(notice: LocalRadarOperatorNoticeData) {
  if (clean(notice.expectedLabel)) return clean(notice.expectedLabel);
  const from = dateLabel(notice.expectedFrom);
  const to = dateLabel(notice.expectedTo);
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || 'Expected window supplied by FateDrop';
}

function evidenceStateCopy(state: LocalRadarOperatorNoticeData['physicalEvidenceState']) {
  if (state === 'verified') return 'IN-STORE CONFIRMED';
  if (state === 'reported') return 'REPORTED';
  if (state === 'expired') return 'NO LONGER CONFIRMED';
  return 'EXPECTED';
}

function observedCopy(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Evidence time unavailable';
  return `Evidence observed ${date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

export function LocalRadarOperatorNotice({
  notice,
  collapsed,
  onCollapse,
  onExpand,
  onDismiss,
}: {
  notice: LocalRadarOperatorNoticeData;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [linkError, setLinkError] = useState('');
  const branches = Number.isFinite(notice.branchCount) && notice.branchCount > 0 ? Math.trunc(notice.branchCount) : 0;
  const retailer = clean(notice.retailerName) || 'participating retailer';
  const product = clean(notice.productTitle) || 'Pokémon stock';
  const when = expectedCopy(notice);
  const state = evidenceStateCopy(notice.physicalEvidenceState);
  const bigFateSignal = notice.presentationType === 'big_fate_signal';
  const branchScope = notice.radiusTargeted
    ? branches ? `${branches} ${branches === 1 ? 'branch' : 'branches'} inside your selected radius` : 'a branch inside your selected radius'
    : branches ? `${branches} ${retailer} ${branches === 1 ? 'branch' : 'branches'} nationally` : retailer;
  const branchCopy = notice.physicalEvidenceState === 'verified'
    ? `Fresh exact-branch evidence confirms physical availability at ${branchScope}.`
    : notice.physicalEvidenceState === 'reported'
      ? `Credible branch-specific movement has been reported for ${branchScope}.`
      : notice.physicalEvidenceState === 'expired'
        ? `Earlier physical evidence for ${branchScope} is no longer confirmed.`
        : `Official allocation names ${branchScope}.`;
  const evidenceCaveat = notice.physicalEvidenceState === 'verified'
    ? 'Check before travelling because exact-store stock can still change.'
    : notice.physicalEvidenceState === 'reported'
      ? 'Reported movement is a useful lead, not live stock proof. Check before travelling.'
      : notice.physicalEvidenceState === 'expired'
        ? 'Expiry removes Echo authority and never creates an ordinary Vanished alert.'
        : 'Official allocation is preparation evidence, not live shelf stock. Check Local Radar and the retailer before travelling.';

  const openRetailer = async () => {
    if (!notice.retailerUrl) return;
    setLinkError('');
    try {
      await openTrackedRetailerLink({
        destinationUrl: notice.retailerUrl,
        retailerId: notice.retailerId || 'unknown-retailer',
        placement: 'big_fate_signal',
      });
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : 'The official retailer page could not be opened.');
    }
  };

  if (collapsed) {
    return <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 60 }]}>
      <Pressable onPress={onExpand} style={styles.compact} accessibilityRole="button" accessibilityLabel="Expand incoming Local Radar stock update">
        <View style={styles.compactIcon}><Ionicons name="radio" size={14} color={FateDropColors.cyan} /></View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.compactTitle}>{bigFateSignal ? 'Big Fate Signal' : 'Incoming stock'} · {product}</Text>
          <Text numberOfLines={1} style={styles.compactMeta}>ECHO · {state} · {when}</Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={FateDropColors.goldBright} />
      </Pressable>
    </View>;
  }

  return <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 60 }]}>
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.icon}><Ionicons name="radio-outline" size={20} color={FateDropColors.cyan} /></View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{bigFateSignal ? 'BIG FATE SIGNAL · ECHO' : 'LOCAL RADAR · ECHO'}</Text>
          <Text style={styles.title}>{product}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss incoming stock update">
          <Ionicons name="close" size={18} color={FateDropColors.muted} />
        </Pressable>
      </View>

      <View style={styles.statePill}><Text style={styles.stateText}>{state}</Text></View>
      <Text style={styles.message}>{branchCopy}</Text>
      <View style={styles.dateRow}><Ionicons name="calendar-outline" size={14} color={FateDropColors.cyan} /><Text style={styles.date}>{when}</Text></View>
      <Text style={styles.evidence}>{observedCopy(notice.evidenceObservedAt)}</Text>
      <Text style={styles.explain}>{evidenceCaveat}</Text>

      {notice.retailerUrl ? <Pressable onPress={() => void openRetailer()} style={styles.retailerButton} accessibilityRole="link" accessibilityLabel="Open the supporting retailer page">
        <Text style={styles.retailerButtonText}>{clean(notice.ctaLabel) || `CHECK ${retailer.toUpperCase()}`}</Text>
        <Ionicons name="open-outline" size={15} color={FateDropColors.background} />
      </Pressable> : null}
      {linkError ? <Text style={styles.linkError}>{linkError}</Text> : null}

      <Pressable onPress={onCollapse} style={styles.primary} accessibilityRole="button" accessibilityLabel="Minimise stock update and show Local Radar map">
        <Text style={styles.primaryText}>SHOW LOCAL RADAR</Text>
        <Ionicons name="chevron-up" size={15} color={FateDropColors.text} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 20 },
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.cyan}55`, backgroundColor: 'rgba(7,12,20,.97)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}14` },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  message: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 10 },
  statePill: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: `${FateDropColors.echo}18`, borderWidth: 1, borderColor: `${FateDropColors.echo}48` },
  stateText: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  date: { color: FateDropColors.cyan, fontSize: 10, fontWeight: '900' },
  explain: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 8 },
  evidence: { color: FateDropColors.secondary, fontSize: 8, marginTop: 7 },
  retailerButton: { marginTop: 12, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: FateDropColors.echo },
  retailerButtonText: { color: FateDropColors.background, fontSize: 9, fontWeight: '900', letterSpacing: .5 },
  linkError: { color: FateDropColors.coral, fontSize: 8, lineHeight: 12, marginTop: 6 },
  primary: { marginTop: 12, minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900', letterSpacing: .5 },
  compact: { minHeight: 54, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.cyan}45`, backgroundColor: 'rgba(7,12,20,.96)', flexDirection: 'row', alignItems: 'center', gap: 9 },
  compactIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}12` },
  compactTitle: { color: FateDropColors.text, fontSize: 10, fontWeight: '900' },
  compactMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 },
});
