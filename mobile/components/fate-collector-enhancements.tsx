import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import {
  confirmCollectrCsv,
  FateCollectorApiError,
  previewCollectrCsv,
  type CollectrPreview,
  type FateCollectorPersonalMover,
  type FateCollectorSetBinder,
  type FateCollectorsDashboardSnapshot,
} from '@/services/fate-collector';
import type { FateCollectorsSnapshot } from '@/services/fate-market';

type PersonalPeriod = 'd7' | 'd30';

function movementText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function percentText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function money(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode || 'GBP', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode || 'GBP'}`;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof FateCollectorApiError && error.status === 404 && error.code === 'NOT_FOUND') {
    return 'Preview is ready, but confirmed collection imports are not enabled on this Cloud deployment yet.';
  }
  return error instanceof Error ? error.message : 'Fate Collections could not complete that action.';
}

export function FateCollectorEnhancements({
  data,
  onCollectionChanged,
  signedIn,
}: {
  data: FateCollectorsSnapshot | null;
  onCollectionChanged: () => Promise<void>;
  signedIn: boolean;
}) {
  const [period, setPeriod] = useState<PersonalPeriod>('d30');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CollectrPreview | null>(null);
  const [working, setWorking] = useState<'pick' | 'preview' | 'confirm' | ''>('');
  const [message, setMessage] = useState('');

  const collectorData = data as FateCollectorsDashboardSnapshot | null;
  const pulse = collectorData?.personalPulse?.periods[period];
  const binders = useMemo(() => (collectorData?.summary.sets || [])
    .filter((set) => set.ownedCount == null || set.ownedCount > 0)
    .sort((left, right) => Number(right.completionPercent || 0) - Number(left.completionPercent || 0)), [collectorData?.summary.sets]);
  const valuationCurrency = collectorData?.evidence.valuationCurrencyCode || collectorData?.summary.currencyCode || 'GBP';
  const sourceCurrency = collectorData?.evidence.sourceMarketCurrencyCode || 'EUR';

  const pickCollectionCsv = async () => {
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
        setMessage('That CSV is larger than FateDrop’s 2 MB safe import limit. Nothing was written.');
        return;
      }
      const text = await file.text();
      setCsvText(text);
      setFileName(file.name || 'collection export.csv');
      setWorking('preview');
      const next = await previewCollectrCsv(text);
      setPreview(next);
      setMessage('Preview complete. Exact rows can be confirmed; held or unresolved rows remain outside your collection.');
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
      setPreview(null);
      setCsvText('');
      setFileName('');
      setMessage(result.duplicate
        ? 'This exact collection export was already applied. Nothing was duplicated.'
        : `Import complete · ${result.summary.created} added · ${result.summary.updated} updated · ${result.summary.held} held for review.`);
      await onCollectionChanged();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setWorking('');
    }
  };

  if (!signedIn) return null;

  return <>
    <View style={[styles.section, styles.pulseSection]}>
      <View style={styles.headingRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>PERSONAL COLLECTION PULSE</Text>
          <Text style={styles.title}>What moved among your cards?</Text>
          <Text style={styles.copy}>Your top three risers and fallers are ranked only from exact cards in your collection.</Text>
        </View>
        <View style={styles.personalBadge}><Text style={styles.personalBadgeText}>YOUR CARDS</Text></View>
      </View>

      <View style={styles.periodRow}>
        <Text style={styles.periodPrompt}>MOVEMENT WINDOW</Text>
        <View style={styles.periodRail}>
          <PeriodButton label="7D" selected={period === 'd7'} onPress={() => setPeriod('d7')} />
          <PeriodButton label="30D" selected={period === 'd30'} onPress={() => setPeriod('d30')} />
        </View>
      </View>

      <View style={styles.policyCard}>
        <Ionicons name="git-compare-outline" size={17} color={FateDropColors.echo} />
        <View style={styles.flex}>
          <Text style={styles.policyTitle}>VALUE AND MOVEMENT HAVE DIFFERENT JOBS</Text>
          <Text style={styles.policyCopy}>Current values are presented in {valuationCurrency}. Movement compares FatePrice central prices in the source {sourceCurrency} market, so currency changes cannot create a rise or fall.</Text>
        </View>
      </View>

      <View style={styles.qualifyingLine}>
        <Ionicons name={pulse?.status === 'available' ? 'checkmark-circle-outline' : 'time-outline'} size={15} color={pulse?.status === 'available' ? FateDropColors.manifested : FateDropColors.muted} />
        <Text style={styles.qualifyingText}>{pulse ? `${pulse.eligibleOwnedIdentities} owned exact ${pulse.eligibleOwnedIdentities === 1 ? 'card qualifies' : 'cards qualify'} for ${period === 'd7' ? '7-day' : '30-day'} comparison.` : 'Waiting for owned-card FatePrice history.'}</Text>
      </View>

      <PersonalMoverList accent={FateDropColors.manifested} items={pulse?.risers || []} label="RISERS" period={period} />
      <PersonalMoverList accent={FateDropColors.vanished} items={pulse?.decliners || []} label="FALLERS" period={period} />

      {!pulse || pulse.status === 'building' ? <View style={styles.buildingLine}><Ionicons name="information-circle-outline" size={15} color={FateDropColors.muted} /><Text style={styles.buildingText}>A card appears only when its exact identity has a trustworthy FatePrice baseline. Missing history is excluded, never treated as 0%.</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Compare with the broad FatePulse market" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} style={({ pressed }) => [styles.compareButton, pressed && styles.pressed]}>
        <Ionicons name="pulse-outline" size={16} color={FateDropColors.manifested} />
        <View style={styles.flex}><Text style={styles.compareButtonTitle}>COMPARE THE BROAD MARKET</Text><Text style={styles.compareButtonCopy}>Open FatePulse’s separate global card and set rankings.</Text></View>
        <Ionicons name="arrow-forward" size={14} color={FateDropColors.manifested} />
      </Pressable>
    </View>

    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.flex}><Text style={styles.eyebrow}>SET BINDERS</Text><Text style={styles.title}>Open the sets you are building</Text><Text style={styles.copy}>Binders count verified raw printings only. Tap one to see every owned and missing card; graded slabs stay separate.</Text></View>
        <View style={styles.countBadge}><Text style={styles.countBadgeValue}>{binders.length}</Text><Text style={styles.countBadgeLabel}>BINDERS</Text></View>
      </View>
      {binders.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.binderRail}>
        {binders.map((binder) => <BinderCard binder={binder} key={binder.setId} />)}
      </ScrollView> : <View style={styles.emptyBinder}><Ionicons name="albums-outline" size={19} color={FateDropColors.muted} /><View style={styles.flex}><Text style={styles.emptyBinderTitle}>No binders yet</Text><Text style={styles.emptyBinderText}>Add an exact card from FatePrice or import a collection CSV to begin.</Text></View></View>}
    </View>

    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.flex}><Text style={styles.eyebrow}>OPTIONAL COLLECTION IMPORT</Text><Text style={styles.title}>Bring in a collection CSV</Text></View>
        {working ? <ActivityIndicator size="small" color={FateDropColors.echo} /> : null}
      </View>
      <Text style={styles.copy}>Choose a CSV exported from another collection tracker. FateDrop imports ownership only—not third-party prices, artwork or login data.</Text>
      <View style={styles.importSteps}>
        <ImportStep number="1" label="CHOOSE" />
        <View style={styles.stepLine} />
        <ImportStep number="2" label="PREVIEW" />
        <View style={styles.stepLine} />
        <ImportStep number="3" label="CONFIRM" />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose a collection CSV to preview" disabled={Boolean(working)} onPress={() => void pickCollectionCsv()} style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}>
        <Ionicons name="document-attach-outline" size={19} color={FateDropColors.echo} />
        <View style={styles.flex}><Text style={styles.importButtonTitle}>{fileName || 'CHOOSE COLLECTION CSV'}</Text><Text style={styles.importButtonCopy}>{fileName ? 'Choose a different export' : 'Preview only · no write yet · 2 MB maximum'}</Text></View>
        <Ionicons name="chevron-forward" size={16} color={FateDropColors.echo} />
      </Pressable>

      {preview ? <View style={styles.previewPanel}>
        <View style={styles.previewHeading}><Ionicons name="document-text-outline" size={16} color={FateDropColors.echo} /><Text style={styles.previewTitle}>SAFE IMPORT PREVIEW</Text></View>
        <View style={styles.previewGrid}>
          <PreviewMetric label="EXACT" value={preview.preview.matched.exact} />
          <PreviewMetric label="ADD" value={preview.preview.plan.create} />
          <PreviewMetric label="UPDATE" value={preview.preview.plan.update} />
          <PreviewMetric label="HELD" value={preview.preview.plan.hold} />
        </View>
        <Text style={styles.previewCopy}>{preview.preview.matched.ambiguous} ambiguous · {preview.preview.matched.unresolved} unresolved · {preview.preview.parsed.rejectedRows} rejected CSV rows. None are silently added.</Text>
        {preview.preview.scale?.mayBeTruncated ? <Text style={styles.previewWarning}>This preview may be truncated, so confirmation is disabled.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Confirm exact collection import" disabled={working === 'confirm' || preview.preview.scale?.mayBeTruncated === true} onPress={() => void confirmImport()} style={({ pressed }) => [styles.confirmButton, preview.preview.scale?.mayBeTruncated && styles.buttonDisabled, pressed && styles.pressed]}>
          {working === 'confirm' ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name="checkmark-circle-outline" size={18} color={FateDropColors.background} />}
          <Text style={styles.confirmText}>CONFIRM EXACT IMPORT</Text>
        </Pressable>
      </View> : null}
      {message ? <View accessibilityLiveRegion="polite" style={styles.messageRow}><Ionicons name="information-circle-outline" size={15} color={FateDropColors.echo} /><Text style={styles.message}>{message}</Text></View> : null}
      <Text style={styles.legalNote}>USER-SUPPLIED EXPORT · NO THIRD-PARTY LOGIN AUTOMATION · NO SCRAPING · NO IMPORTED PRICE CLAIMS</Text>
    </View>
  </>;
}

function PeriodButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.periodButton, selected && styles.periodButtonActive]}><Text style={[styles.periodText, selected && styles.periodTextActive]}>{label}</Text></Pressable>;
}

function PersonalMoverList({ accent, items, label, period }: { accent: string; items: FateCollectorPersonalMover[]; label: 'RISERS' | 'FALLERS'; period: PersonalPeriod }) {
  return <View style={styles.moverList}>
    <View style={styles.moverHead}>
      <View style={[styles.moverIcon, { borderColor: `${accent}66`, backgroundColor: `${accent}0E` }]}><Ionicons name={label === 'RISERS' ? 'trending-up-outline' : 'trending-down-outline'} size={16} color={accent} /></View>
      <View style={styles.flex}><Text style={[styles.moverLabel, { color: accent }]}>YOUR TOP {label}</Text><Text style={styles.moverSubLabel}>{period === 'd7' ? '7-DAY' : '30-DAY'} · UP TO 3 EXACT CARDS</Text></View>
    </View>
    {items.length ? items.slice(0, 3).map((item, index) => <Pressable key={item.cardIdentityId} accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${item.name || 'owned card'}, ${movementText(item.movementPercent)}`} onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.cardIdentityId, collectorNumber: item.collectorNumber || undefined, name: item.name || undefined, setId: item.setId || undefined, setName: item.setName || undefined, tcg: item.tcgCode || undefined } })} style={({ pressed }) => [styles.moverRow, pressed && styles.pressed]}>
      <View style={[styles.rank, { borderColor: `${accent}55` }]}><Text style={[styles.rankText, { color: accent }]}>{index + 1}</Text></View>
      <View style={styles.moverIdentity}><Text style={styles.moverName} numberOfLines={2}>{item.name || 'Owned card'}</Text><Text style={styles.moverMeta} numberOfLines={1}>{item.setName || 'Verified set'}{item.collectorNumber ? ` · #${item.collectorNumber}` : ''} · ×{item.quantity}</Text></View>
      <View style={styles.moverValues}><Text style={[styles.movement, { color: accent }]}>{movementText(item.movementPercent)}</Text><Text style={styles.currentPrice}>{money(item.currentPrice, item.currencyCode)}</Text></View>
      <Ionicons name="chevron-forward" size={13} color={FateDropColors.muted} />
    </Pressable>) : <View style={styles.emptyMover}><Text style={styles.emptyMoverTitle}>No qualifying {label.toLowerCase()}</Text><Text style={styles.emptyMoverCopy}>Owned cards without an exact baseline stay out of this ranking.</Text></View>}
  </View>;
}

function BinderCard({ binder }: { binder: FateCollectorSetBinder }) {
  const available = binder.status === 'available' && binder.completionPercent != null;
  const missing = binder.missingCount == null ? 'Checklist unavailable' : binder.missingCount === 0 ? 'Set complete' : `${binder.missingCount} ${binder.missingCount === 1 ? 'card' : 'cards'} missing`;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${binder.setName || 'set'} binder, ${available ? percentText(binder.completionPercent) : 'completion unavailable'}`} onPress={() => router.push({ pathname: '/binder/[setId]', params: { setId: binder.setId, setName: binder.setName || undefined } })} style={({ pressed }) => [styles.binderCard, pressed && styles.pressed]}>
    <View style={styles.binderTop}><View style={styles.binderIcon}><Ionicons name="albums-outline" size={18} color={FateDropColors.echo} /></View><Text style={styles.binderPercent}>{available ? percentText(binder.completionPercent) : '—'}</Text></View>
    <Text style={styles.binderName} numberOfLines={2}>{binder.setName || 'Verified set'}</Text>
    <Text style={styles.binderMeta}>{binder.ownedCount == null ? 'Owned count building' : `${binder.ownedCount} of ${binder.totalCount ?? '—'} exact cards`}</Text>
    <View style={styles.binderTrack}><View style={[styles.binderFill, { width: `${Math.max(0, Math.min(100, binder.completionPercent || 0))}%` }]} /></View>
    <View style={styles.binderBottom}><Text style={[styles.binderMissing, binder.missingCount === 0 && { color: FateDropColors.manifested }]}>{missing}</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.echo} /></View>
  </Pressable>;
}

function ImportStep({ label, number }: { label: string; number: string }) {
  return <View style={styles.importStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View><Text style={styles.stepLabel}>{label}</Text></View>;
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return <View style={styles.previewMetric}><Text style={styles.previewValue}>{value}</Text><Text style={styles.previewLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 20, paddingTop: 18, paddingBottom: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(228,207,166,.27)' },
  pulseSection: { marginTop: 22 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.echo, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, lineHeight: 24, marginTop: 4 },
  copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 15, marginTop: 6 },
  personalBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}66`, backgroundColor: `${FateDropColors.echo}0B` },
  personalBadgeText: { color: FateDropColors.echo, fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  periodRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 2 },
  periodPrompt: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .65 },
  periodRail: { width: 126, flexDirection: 'row', padding: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(3,8,20,.52)' },
  periodButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  periodButtonActive: { backgroundColor: `${FateDropColors.echo}20` },
  periodText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.echo },
  policyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.45)', borderRadius: 16, backgroundColor: 'rgba(124,110,255,.07)' },
  policyTitle: { color: FateDropColors.echo, fontSize: 8.5, fontWeight: '900', letterSpacing: .55 },
  policyCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  qualifyingLine: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 4 },
  qualifyingText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 13 },
  moverList: { overflow: 'hidden', marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)', borderRadius: 17, backgroundColor: 'rgba(3,8,20,.55)' },
  moverHead: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  moverIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  moverLabel: { fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  moverSubLabel: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '800', letterSpacing: .35, marginTop: 3 },
  moverRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.16)' },
  rank: { width: 29, height: 29, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: Fonts.serif, fontSize: 14 },
  moverIdentity: { flex: 1, minWidth: 0 },
  moverName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14, lineHeight: 17 },
  moverMeta: { color: FateDropColors.muted, fontSize: 8.5, marginTop: 4 },
  moverValues: { alignItems: 'flex-end', maxWidth: 78 },
  movement: { fontSize: 12, fontWeight: '900' },
  currentPrice: { color: FateDropColors.secondary, fontSize: 8.5, marginTop: 4 },
  emptyMover: { minHeight: 78, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.16)' },
  emptyMoverTitle: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 13 },
  emptyMoverCopy: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 12, textAlign: 'center', marginTop: 4 },
  buildingLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4, marginTop: 11 },
  buildingText: { flex: 1, color: FateDropColors.muted, fontSize: 9, lineHeight: 13 },
  compareButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.manifested}55`, borderRadius: 15, backgroundColor: `${FateDropColors.manifested}08` },
  compareButtonTitle: { color: FateDropColors.manifested, fontSize: 8.5, fontWeight: '900', letterSpacing: .55 },
  compareButtonCopy: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 12, marginTop: 3 },
  countBadge: { minWidth: 58, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}55`, backgroundColor: `${FateDropColors.echo}09` },
  countBadgeValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18 },
  countBadgeLabel: { color: FateDropColors.echo, fontSize: 7, fontWeight: '900', marginTop: 1 },
  binderRail: { gap: 10, paddingVertical: 13, paddingRight: 12 },
  binderCard: { width: 180, minHeight: 172, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}55`, borderRadius: 18, backgroundColor: 'rgba(7,12,20,.66)' },
  binderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  binderIcon: { width: 33, height: 33, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}55`, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.echo}0B` },
  binderPercent: { color: FateDropColors.echo, fontFamily: Fonts.serif, fontSize: 20 },
  binderName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, lineHeight: 19, marginTop: 13 },
  binderMeta: { color: FateDropColors.secondary, fontSize: 9, marginTop: 6 },
  binderTrack: { height: 4, marginTop: 13, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.09)', overflow: 'hidden' },
  binderFill: { height: 4, borderRadius: 2, backgroundColor: FateDropColors.echo },
  binderBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginTop: 10 },
  binderMissing: { flex: 1, color: FateDropColors.muted, fontSize: 8.5 },
  emptyBinder: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, borderRadius: 16, backgroundColor: 'rgba(3,8,20,.45)' },
  emptyBinderTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14 },
  emptyBinderText: { color: FateDropColors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  importSteps: { minHeight: 58, flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingHorizontal: 10 },
  importStep: { alignItems: 'center', gap: 4 },
  stepNumber: { width: 25, height: 25, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}66`, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.echo}0B` },
  stepNumberText: { color: FateDropColors.echo, fontFamily: Fonts.serif, fontSize: 12 },
  stepLabel: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: .35 },
  stepLine: { flex: 1, height: StyleSheet.hairlineWidth, marginHorizontal: 7, marginBottom: 16, backgroundColor: `${FateDropColors.echo}42` },
  importButton: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: `${FateDropColors.echo}62`, borderRadius: 16, backgroundColor: `${FateDropColors.echo}09` },
  importButtonTitle: { color: FateDropColors.echo, fontSize: 9, fontWeight: '900', letterSpacing: .45 },
  importButtonCopy: { color: FateDropColors.muted, fontSize: 8.5, marginTop: 4 },
  previewPanel: { marginTop: 11, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, borderRadius: 16, backgroundColor: 'rgba(3,8,20,.58)' },
  previewHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  previewTitle: { color: FateDropColors.ivory, fontSize: 9, fontWeight: '900', letterSpacing: .65 },
  previewGrid: { flexDirection: 'row', marginTop: 13 },
  previewMetric: { flex: 1, alignItems: 'center' },
  previewValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21 },
  previewLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', marginTop: 3 },
  previewCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 13, marginTop: 12 },
  previewWarning: { color: FateDropColors.vanished, fontSize: 9, lineHeight: 13, marginTop: 8 },
  confirmButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, borderRadius: 13, backgroundColor: FateDropColors.echo },
  buttonDisabled: { opacity: .42 },
  confirmText: { color: FateDropColors.background, fontSize: 9, fontWeight: '900', letterSpacing: .45 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 10, paddingHorizontal: 2 },
  message: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 13 },
  legalNote: { color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11, letterSpacing: .2, marginTop: 12 },
  pressed: { opacity: .72, transform: [{ scale: .986 }] },
});
