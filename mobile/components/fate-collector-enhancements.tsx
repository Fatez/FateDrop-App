import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import {
  confirmCollectrCsv,
  FateCollectorApiError,
  fetchFateCollectorDashboard,
  previewCollectrCsv,
  type CollectrPreview,
  type FateCollectorPersonalMover,
  type FateCollectorsDashboardSnapshot,
} from '@/services/fate-collector';
import type { FateCollectorsSnapshot } from '@/services/fate-market';

type PersonalPeriod = 'd7' | 'd30';
type CollectorDataOverride = {
  source: FateCollectorsSnapshot;
  data: FateCollectorsDashboardSnapshot;
};

function movementText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function money(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode || 'EUR', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode || 'EUR'}`;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof FateCollectorApiError && error.status === 404 && error.code === 'NOT_FOUND') {
    return 'Preview is ready, but confirmed Collectr writes are not enabled on this Cloud deployment yet.';
  }
  return error instanceof Error ? error.message : 'FateCollector could not complete that action.';
}

export function FateCollectorEnhancements({ data, signedIn }: { data: FateCollectorsSnapshot | null; signedIn: boolean }) {
  const [localOverride, setLocalOverride] = useState<CollectorDataOverride | null>(null);
  const [period, setPeriod] = useState<PersonalPeriod>('d30');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CollectrPreview | null>(null);
  const [working, setWorking] = useState<'pick' | 'preview' | 'confirm' | ''>('');
  const [message, setMessage] = useState('');

  const localData = localOverride?.source === data
    ? localOverride.data
    : (data as FateCollectorsDashboardSnapshot | null);
  const pulse = localData?.personalPulse?.periods[period];
  const binders = useMemo(() => (localData?.summary.sets || [])
    .filter((set) => set.ownedCount == null || set.ownedCount > 0)
    .sort((left, right) => Number(right.completionPercent || 0) - Number(left.completionPercent || 0)), [localData?.summary.sets]);

  const pickCollectrCsv = async () => {
    setWorking('pick');
    setMessage('');
    setPreview(null);
    try {
      const picked = await File.pickFileAsync({
        multipleFiles: false,
        mimeTypes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
      });
      if (picked.canceled) return;
      const file = picked.result;
      if (file.size > 2_000_000) {
        setMessage('That CSV is larger than FateDrop’s 2 MB safe import limit.');
        return;
      }
      const text = await file.text();
      setCsvText(text);
      setFileName(file.name || 'Collectr export.csv');
      setWorking('preview');
      const next = await previewCollectrCsv(text);
      setPreview(next);
      setMessage('Preview complete. Only exact reconciled rows can be written; held rows stay out of your collection.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setWorking('');
    }
  };

  const confirmImport = async () => {
    if (!preview || !csvText) return;
    setWorking('confirm');
    setMessage('');
    try {
      const result = await confirmCollectrCsv(csvText, preview.confirmationToken || preview.preview.confirmationToken || '');
      const refreshed = await fetchFateCollectorDashboard({ force: true });
      if (data) setLocalOverride({ source: data, data: refreshed });
      setPreview(null);
      setCsvText('');
      setFileName('');
      setMessage(result.duplicate
        ? 'This exact Collectr export was already applied. Nothing was duplicated.'
        : `Import complete · ${result.summary.created} added · ${result.summary.updated} updated · ${result.summary.held} held for review.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setWorking('');
    }
  };

  if (!signedIn) return null;

  return <>
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>YOUR COLLECTION PULSE</Text>
          <Text style={styles.title}>Your biggest risers and fallers</Text>
          <Text style={styles.copy}>This is personal to cards you own. It never changes FatePulse’s full-market rankings.</Text>
        </View>
        <View style={styles.periodRail}>
          <PeriodButton label="7D" selected={period === 'd7'} onPress={() => setPeriod('d7')} />
          <PeriodButton label="30D" selected={period === 'd30'} onPress={() => setPeriod('d30')} />
        </View>
      </View>
      <View style={styles.moverColumns}>
        <PersonalMoverColumn accent={FateDropColors.manifested} label="YOUR BIGGEST RISERS" items={pulse?.risers || []} />
        <PersonalMoverColumn accent={FateDropColors.vanished} label="YOUR BIGGEST FALLERS" items={pulse?.decliners || []} />
      </View>
      {!pulse || pulse.status === 'building' ? <View style={styles.buildingLine}><Ionicons name="time-outline" size={14} color={FateDropColors.muted} /><Text style={styles.buildingText}>Personal movement appears only when an owned exact identity has trustworthy FatePrice history. Missing history is not treated as 0%.</Text></View> : null}
    </View>

    <View style={styles.section}>
      <Text style={styles.eyebrow}>SET BINDERS</Text>
      <Text style={styles.title}>Your collection, organised by set</Text>
      <Text style={styles.copy}>Manual adds and reconciled imports feed the same owner-scoped collection. Completion collapses to checklist printings; exact variants still keep their own identity.</Text>
      {binders.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.binderRail}>
        {binders.map((binder) => <Pressable key={binder.setId} accessibilityRole="button" accessibilityLabel={`Open ${binder.setName || 'set'} in FatePrice`} onPress={() => router.push({ pathname: '/fate-price', params: { setId: binder.setId, setName: binder.setName || undefined, tcg: binder.tcgCode || undefined } })} style={({ pressed }) => [styles.binderCard, pressed && styles.pressed]}>
          <View style={styles.binderTop}><Ionicons name="albums-outline" size={18} color={FateDropColors.echo} /><Text style={styles.binderPercent}>{binder.completionPercent == null ? '—' : `${binder.completionPercent}%`}</Text></View>
          <Text style={styles.binderName} numberOfLines={2}>{binder.setName || 'Verified set'}</Text>
          <Text style={styles.binderMeta}>{binder.ownedCount == null ? 'Checklist building' : `${binder.ownedCount}/${binder.totalCount ?? '—'} cards`}</Text>
          <View style={styles.binderTrack}><View style={[styles.binderFill, { width: `${Math.max(0, Math.min(100, binder.completionPercent || 0))}%` }]} /></View>
        </Pressable>)}
      </ScrollView> : <View style={styles.emptyBinder}><Ionicons name="albums-outline" size={18} color={FateDropColors.muted} /><Text style={styles.emptyBinderText}>Add an exact card from FatePrice or import your Collectr CSV to begin building set binders.</Text></View>}
    </View>

    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.flex}><Text style={styles.eyebrow}>IMPORT YOUR COLLECTION</Text><Text style={styles.title}>Bring in a Collectr export</Text></View>
        {working ? <ActivityIndicator size="small" color={FateDropColors.echo} /> : null}
      </View>
      <Text style={styles.copy}>You choose a CSV exported from your own Collectr account. FateDrop maps it to our canonical identities; Collectr prices, artwork and account data are not imported.</Text>
      <Pressable accessibilityRole="button" disabled={Boolean(working)} onPress={() => void pickCollectrCsv()} style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}>
        <Ionicons name="document-attach-outline" size={17} color={FateDropColors.echo} />
        <View style={styles.flex}><Text style={styles.importButtonTitle}>{fileName || 'CHOOSE COLLECTR CSV'}</Text><Text style={styles.importButtonCopy}>{fileName ? 'Tap to choose a different export' : 'Preview first · nothing is written yet'}</Text></View>
        <Ionicons name="chevron-forward" size={15} color={FateDropColors.echo} />
      </Pressable>

      {preview ? <View style={styles.previewPanel}>
        <Text style={styles.previewTitle}>IMPORT PREVIEW</Text>
        <View style={styles.previewGrid}>
          <PreviewMetric label="EXACT" value={preview.preview.matched.exact} />
          <PreviewMetric label="ADD" value={preview.preview.plan.create} />
          <PreviewMetric label="UPDATE" value={preview.preview.plan.update} />
          <PreviewMetric label="HELD" value={preview.preview.plan.hold} />
        </View>
        <Text style={styles.previewCopy}>{preview.preview.matched.ambiguous} ambiguous · {preview.preview.matched.unresolved} unresolved · {preview.preview.parsed.rejectedRows} rejected CSV rows. These are not silently added.</Text>
        <Pressable accessibilityRole="button" disabled={working === 'confirm' || preview.preview.scale?.mayBeTruncated === true} onPress={() => void confirmImport()} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}>
          {working === 'confirm' ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name="checkmark-circle-outline" size={17} color={FateDropColors.background} />}
          <Text style={styles.confirmText}>CONFIRM EXACT IMPORT</Text>
        </Pressable>
      </View> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.legalNote}>USER-SUPPLIED EXPORT · NO COLLECTR LOGIN AUTOMATION · NO SCRAPING · NO COLLECTR PRICE CLAIMS</Text>
    </View>
  </>;
}

function PeriodButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.periodButton, selected && styles.periodButtonActive]}><Text style={[styles.periodText, selected && styles.periodTextActive]}>{label}</Text></Pressable>;
}

function PersonalMoverColumn({ accent, label, items }: { accent: string; label: string; items: FateCollectorPersonalMover[] }) {
  return <View style={styles.moverColumn}>
    <View style={styles.moverHead}><Ionicons name={accent === FateDropColors.manifested ? 'trending-up-outline' : 'trending-down-outline'} size={14} color={accent} /><Text numberOfLines={2} style={[styles.moverLabel, { color: accent }]}>{label}</Text><Text style={styles.topThree}>TOP 3</Text></View>
    {items.length ? items.slice(0, 3).map((item, index) => <Pressable key={item.cardIdentityId} accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${item.name || 'owned card'}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.cardIdentityId, collectorNumber: item.collectorNumber || undefined, name: item.name || undefined, setId: item.setId || undefined, setName: item.setName || undefined, tcg: item.tcgCode || undefined } })} style={({ pressed }) => [styles.moverRow, pressed && styles.pressed]}>
      <Text style={styles.rank}>{index + 1}</Text>
      <View style={styles.flex}><Text style={styles.moverName} numberOfLines={2}>{item.name || 'Owned card'}</Text><Text style={styles.moverMeta} numberOfLines={1}>{item.setName || 'Verified set'} · {item.quantity} owned · {money(item.currentPrice, item.currencyCode)}</Text></View>
      <Text style={[styles.movement, { color: accent }]}>{movementText(item.movementPercent)}</Text>
    </Pressable>) : <Text style={styles.emptyMover}>No qualifying owned movement yet.</Text>}
  </View>;
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return <View style={styles.previewMetric}><Text style={styles.previewValue}>{value}</Text><Text style={styles.previewLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 17, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(228,207,166,.24)' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.echo, fontSize: 7, fontWeight: '900', letterSpacing: .95 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, lineHeight: 21, marginTop: 3 },
  copy: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, marginTop: 5 },
  periodRail: { flexDirection: 'row', gap: 4 },
  periodButton: { minWidth: 36, minHeight: 30, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, borderRadius: 999 },
  periodButtonActive: { borderColor: FateDropColors.echo, backgroundColor: `${FateDropColors.echo}14` },
  periodText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.echo },
  moverColumns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  moverColumn: { flex: 1, minWidth: 0 },
  moverHead: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 6 },
  moverLabel: { flex: 1, fontSize: 6.2, fontWeight: '900', letterSpacing: .35 },
  topThree: { color: FateDropColors.muted, fontSize: 5.7, fontWeight: '900' },
  moverRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: FateDropColors.borderSoft },
  rank: { width: 14, color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 13 },
  moverName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 10.5, lineHeight: 13 },
  moverMeta: { color: FateDropColors.muted, fontSize: 5.8, lineHeight: 8, marginTop: 3 },
  movement: { fontSize: 9, fontWeight: '900' },
  emptyMover: { color: FateDropColors.muted, fontSize: 7, lineHeight: 11, paddingVertical: 14 },
  buildingLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8 },
  buildingText: { flex: 1, color: FateDropColors.muted, fontSize: 6.8, lineHeight: 10 },
  binderRail: { gap: 8, paddingVertical: 12, paddingRight: 8 },
  binderCard: { width: 142, minHeight: 128, padding: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}55`, borderRadius: 14, backgroundColor: 'rgba(7,12,20,.55)' },
  binderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  binderPercent: { color: FateDropColors.echo, fontFamily: Fonts.serif, fontSize: 17 },
  binderName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13, lineHeight: 16, marginTop: 10 },
  binderMeta: { color: FateDropColors.muted, fontSize: 6.5, marginTop: 5 },
  binderTrack: { height: 2, marginTop: 12, backgroundColor: FateDropColors.borderSoft, overflow: 'hidden' },
  binderFill: { height: 2, backgroundColor: FateDropColors.echo },
  emptyBinder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  emptyBinderText: { flex: 1, color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11 },
  importButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}58`, borderRadius: 13, backgroundColor: `${FateDropColors.echo}08` },
  importButtonTitle: { color: FateDropColors.echo, fontSize: 7.5, fontWeight: '900', letterSpacing: .45 },
  importButtonCopy: { color: FateDropColors.muted, fontSize: 6.5, marginTop: 3 },
  previewPanel: { marginTop: 10, padding: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, borderRadius: 13, backgroundColor: 'rgba(3,8,20,.45)' },
  previewTitle: { color: FateDropColors.ivory, fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  previewGrid: { flexDirection: 'row', marginTop: 9 },
  previewMetric: { flex: 1, alignItems: 'center' },
  previewValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18 },
  previewLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', marginTop: 2 },
  previewCopy: { color: FateDropColors.secondary, fontSize: 6.6, lineHeight: 10, marginTop: 9 },
  confirmButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10, borderRadius: 11, backgroundColor: FateDropColors.echo },
  confirmText: { color: FateDropColors.background, fontSize: 7.5, fontWeight: '900', letterSpacing: .45 },
  message: { color: FateDropColors.secondary, fontSize: 7, lineHeight: 11, marginTop: 9 },
  legalNote: { color: FateDropColors.muted, fontSize: 5.3, lineHeight: 8, letterSpacing: .25, marginTop: 10 },
  pressed: { opacity: .72, transform: [{ scale: .986 }] },
});
