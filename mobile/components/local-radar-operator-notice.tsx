import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';

export type LocalRadarOperatorNoticeData = {
  localIntelId: string;
  stage: 'WHISPER' | 'ECHO' | '';
  retailerName: string;
  productTitle: string;
  expectedFrom: string;
  expectedTo: string;
  expectedLabel: string;
  branchCount: number;
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
  const branches = Number.isFinite(notice.branchCount) && notice.branchCount > 0 ? Math.trunc(notice.branchCount) : 0;
  const retailer = clean(notice.retailerName) || 'participating retailer';
  const product = clean(notice.productTitle) || 'Pokémon stock';
  const when = expectedCopy(notice);

  if (collapsed) {
    return <Pressable onPress={onExpand} style={styles.compact} accessibilityRole="button" accessibilityLabel="Expand incoming Local Radar stock update">
      <View style={styles.compactIcon}><Ionicons name="radio" size={14} color={FateDropColors.cyan} /></View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.compactTitle}>Incoming stock · {product}</Text>
        <Text numberOfLines={1} style={styles.compactMeta}>{branches ? `${branches} ${retailer} ${branches === 1 ? 'store' : 'stores'}` : retailer} · {when}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={FateDropColors.goldBright} />
    </Pressable>;
  }

  return <View style={styles.card}>
    <View style={styles.topRow}>
      <View style={styles.icon}><Ionicons name="radio-outline" size={20} color={FateDropColors.cyan} /></View>
      <View style={styles.flex}>
        <Text style={styles.eyebrow}>LOCAL RADAR · INCOMING STOCK</Text>
        <Text style={styles.title}>{product}</Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss incoming stock update">
        <Ionicons name="close" size={18} color={FateDropColors.muted} />
      </Pressable>
    </View>

    <Text style={styles.message}>{branches ? `Expected at ${branches} ${retailer} ${branches === 1 ? 'store' : 'stores'}.` : `Expected at ${retailer} stores.`}</Text>
    <View style={styles.dateRow}><Ionicons name="calendar-outline" size={14} color={FateDropColors.cyan} /><Text style={styles.date}>{when}</Text></View>
    <Text style={styles.explain}>Check Local Radar to see if a participating store is near you. Expected stock is advisory and may change before arrival.</Text>

    <Pressable onPress={onCollapse} style={styles.primary} accessibilityRole="button" accessibilityLabel="Minimise stock update and show Local Radar map">
      <Text style={styles.primaryText}>MINIMISE · SHOW MAP</Text>
      <Ionicons name="chevron-up" size={15} color={FateDropColors.text} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.cyan}55`, backgroundColor: 'rgba(7,12,20,.97)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}14` },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  message: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  date: { color: FateDropColors.cyan, fontSize: 10, fontWeight: '900' },
  explain: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 8 },
  primary: { marginTop: 12, minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900', letterSpacing: .5 },
  compact: { minHeight: 54, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.cyan}45`, backgroundColor: 'rgba(7,12,20,.96)', flexDirection: 'row', alignItems: 'center', gap: 9 },
  compactIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}12` },
  compactTitle: { color: FateDropColors.text, fontSize: 10, fontWeight: '900' },
  compactMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 2 },
});
