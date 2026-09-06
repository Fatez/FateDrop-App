import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FateCollectionsArt } from '@/components/fate-collections-art';
import { CollectionsScreen } from '@/components/fate-collections-ui';
import { useCollectionsResource } from '@/hooks/use-collections-resource';
import { isBinderComplete, orderBinders } from '@/lib/fate-collections-view';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  confirmCollectrCsv,
  FateCollectorApiError,
  fetchFateCollectorDashboard,
  previewCollectrCsv,
  type CollectrPreview,
  type FateCollectorSetBinder,
} from '@/services/fate-collector';

type BinderFilter = 'all' | 'progress' | 'complete';

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function money(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; }
}

function importError(error: unknown) {
  if (error instanceof FateCollectorApiError && error.status === 404 && error.code === 'NOT_FOUND') return 'Collectr imports are not available right now.';
  return error instanceof Error ? error.message : 'Fate Collections could not complete that import.';
}

const readDashboard = () => fetchFateCollectorDashboard({ force: true });

export default function FateBindersScreen() {
  const { data, loading, error, load } = useCollectionsResource(readDashboard);
  const [filter, setFilter] = useState<BinderFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'progress' | 'name'>('progress');
  const importLock = useRef(false);
  const [preview, setPreview] = useState<CollectrPreview | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importName, setImportName] = useState('');
  const [importWorking, setImportWorking] = useState(false);
  const [importMessage, setImportMessage] = useState('');


  const allBinders = useMemo(() => orderBinders(data?.summary.sets || []), [data?.summary.sets]);
  const completed = allBinders.filter(isBinderComplete);
  const inProgress = allBinders.filter((set) => !isBinderComplete(set));
  const visible = orderBinders(filter === 'complete' ? completed : filter === 'progress' ? inProgress : allBinders, query, sort);
  const closest = inProgress.find((set) => set.status === 'available' && Number(set.totalCount) > 0 && Number(set.ownedCount) > 0) || null;
  const currency = closest?.value?.currencyCode || data?.summary.currencyCode || 'GBP';
  const topNeeded = closest?.missingCards?.slice(0, 3) || [];

  const chooseCollectrCsv = async () => {
    if (importLock.current) return;
    importLock.current = true;
    setPreview(null);
    setCsvText('');
    setImportName('');
    setImportWorking(true);
    setImportMessage('');
    try {
      const picked = await File.pickFileAsync({ multipleFiles: false, mimeTypes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'] });
      if (picked.canceled) return;
      const file = picked.result;
      if (file.size > 2_000_000) throw new Error('That CSV is larger than FateDrop’s 2 MB safe import limit.');
      const text = await file.text();
      const next = await previewCollectrCsv(text);
      setCsvText(text);
      setImportName(file.name || 'Collectr export.csv');
      setPreview(next);
      setImportMessage('Preview ready. Exact rows can be confirmed; ambiguous or unresolved rows remain held.');
    } catch (caught) {
      setImportMessage(importError(caught));
    } finally {
      importLock.current = false;
      setImportWorking(false);
    }
  };

  const confirmImport = async () => {
    if (importLock.current || !preview || !csvText || preview.preview.scale?.mayBeTruncated || !(preview.confirmationToken || preview.preview.confirmationToken)) return;
    importLock.current = true;
    setImportWorking(true);
    setImportMessage('');
    try {
      const result = await confirmCollectrCsv(csvText, preview.confirmationToken || preview.preview.confirmationToken || '');
      setImportMessage(result.duplicate ? 'This exact export was already applied. Nothing was duplicated.' : `Import complete · ${result.summary.created} added · ${result.summary.updated} updated · ${result.summary.held} held.`);
      setPreview(null);
      setCsvText('');
      setImportName('');
      await load();
    } catch (caught) {
      setImportMessage(importError(caught));
    } finally {
      importLock.current = false;
      setImportWorking(false);
    }
  };

  return (
    <CollectionsScreen>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Fate Collections" onPress={() => router.canGoBack() ? router.back() : router.replace('/collections')} style={styles.back}><Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · BINDERS</Text>
            <Text style={styles.title}>Track the sets you are building.</Text>
            <Text style={styles.copy}>See your progress, find what’s missing, and get closer to completion — one verified raw card at a time.</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryMetric icon="checkmark-done-outline" value={data ? String(completed.length) : '—'} label="SETS COMPLETED" />
          <View style={styles.summaryDivider} />
          <SummaryMetric icon="ellipse-outline" value={data ? String(inProgress.length) : '—'} label="IN PROGRESS" />
          <View style={styles.summaryDivider} />
          <View style={styles.closestSummary}><Ionicons name="locate-outline" size={18} color={FateDropColors.goldBright} /><Text style={styles.closestSummaryName} numberOfLines={2}>{closest?.setName || '—'}</Text><Text style={styles.summaryLabel}>CLOSEST SET</Text></View>
        </View>

        {loading && !data ? <StateLine icon="time-outline" text="Opening your binders…" loading /> : null}
        {error ? <StateLine icon="alert-circle-outline" text={error} danger /> : null}

        {closest ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${closest.setName || 'closest set'} binder`}
            onPress={() => router.push({ pathname: '/binder/[setId]', params: { setId: closest.setId, setName: closest.setName || undefined } })}
            style={({ pressed }) => [styles.closestCard, pressed && styles.pressed]}
          >
            <View style={styles.closestTop}>
              <FateCollectionsArt kind="binders" size={104} />
              <View style={styles.closestMain}>
                <Text style={styles.closestEyebrow}>CLOSEST TO COMPLETION</Text>
                <Text style={styles.closestName}>{closest.setName || 'Verified set'}</Text>
                <Text style={styles.closestPercent}>{pct(closest.completionPercent)}</Text>
                <Text style={styles.closestOwned}>{closest.ownedCount ?? '—'} / {closest.totalCount ?? '—'} cards owned</Text>
              </View>
              <View style={styles.closestSide}>
                <Text style={styles.missingBig}>{closest.missingCount ?? '—'}</Text>
                <Text style={styles.missingLabel}>cards missing</Text>
                <Text style={styles.missingValue}>{money(closest.value?.missingValue, currency)}</Text>
                <Text style={styles.missingValueLabel}>verified missing value</Text>
              </View>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, closest.completionPercent || 0))}%` }]} /></View>
            <View style={styles.topNeeded}>
              <View style={styles.topNeededHead}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.topNeededTitle}>Still needed · checklist preview</Text></View>
              <View style={styles.topNeededRow}>
                {topNeeded.length ? topNeeded.map((card) => (
                  <View key={card.fateCardId} style={styles.neededMini}>
                    <View style={styles.neededMiniArt}><Ionicons name="sparkles-outline" size={14} color={FateDropColors.echo} /></View>
                    <View style={styles.flex}><Text style={styles.neededMiniName} numberOfLines={1}>{card.name || 'Verified card'}</Text><Text style={styles.neededMiniMeta}>#{card.collectorNumber || '—'}</Text></View>
                  </View>
                )) : <Text style={styles.noNeeded}>No verified missing-card detail yet.</Text>}
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.importPanel}>
          <View style={styles.importHead}>
            <View style={styles.flex}>
              <Text style={styles.importEyebrow}>COLLECTR IMPORT</Text>
              <Text style={styles.importTitle}>Update your binders from a collection CSV</Text>
              <Text style={styles.importCopy}>Preview a Collectr export before adding exact raw cards. Confirmed cards update their matching set binders; ambiguous or unresolved rows stay held.</Text>
            </View>
            {importWorking ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a Collectr CSV to preview"
            accessibilityState={{ disabled: importWorking, busy: importWorking }}
            disabled={importWorking}
            onPress={() => void chooseCollectrCsv()}
            style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}
          >
            <Ionicons name="document-attach-outline" size={20} color={FateDropColors.goldBright} />
            <View style={styles.flex}>
              <Text style={styles.importButtonTitle} numberOfLines={1}>{importName || 'CHOOSE COLLECTR CSV'}</Text>
              <Text style={styles.importButtonCopy}>{importName ? 'Choose a different export' : 'Preview only · no write yet · 2 MB maximum'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
          </Pressable>

          {preview ? (
            <View style={styles.previewCard}>
              <View style={styles.previewTop}><Text style={styles.previewTitle}>SAFE IMPORT PREVIEW</Text><Text style={styles.previewCount}>{preview.preview.matched.exact} exact</Text></View>
              <Text style={styles.previewCopy}>{preview.preview.plan.create} add · {preview.preview.plan.update} update · {preview.preview.plan.hold} held · {preview.preview.matched.ambiguous} ambiguous · {preview.preview.matched.unresolved} unresolved.</Text>
              {preview.preview.scale?.mayBeTruncated ? <Text style={styles.previewWarning}>This preview is incomplete. Choose a smaller export before confirming.</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm exact Collectr import"
                accessibilityState={{ disabled: importWorking || preview.preview.scale?.mayBeTruncated === true }}
                disabled={importWorking || preview.preview.scale?.mayBeTruncated === true || !(preview.confirmationToken || preview.preview.confirmationToken)}
                onPress={() => void confirmImport()}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
              >
                {importWorking ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name="checkmark-circle-outline" size={17} color={FateDropColors.background} />}
                <Text style={styles.confirmText}>CONFIRM EXACT IMPORT</Text>
              </Pressable>
            </View>
          ) : null}
          {importMessage ? <View accessibilityLiveRegion="polite" style={styles.importMessageRow}><Ionicons name="information-circle-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.importMessage}>{importMessage}</Text></View> : null}
        </View>

        <TextInput accessibilityLabel="Search binders" value={query} onChangeText={setQuery} placeholder="Search your sets…" placeholderTextColor={FateDropColors.secondary} style={styles.search} autoCorrect={false} />

        <View style={styles.filterRail}>
          <FilterButton label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterButton label="In progress" selected={filter === 'progress'} onPress={() => setFilter('progress')} />
          <FilterButton label="Completed" selected={filter === 'complete'} onPress={() => setFilter('complete')} />
        </View>

        <View style={styles.listHeader}><View style={styles.flex}><Text style={styles.listTitle}>Your Set Binders</Text><Text style={styles.listCopy}>Tap a binder to view your needed and owned cards.</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Sort binders by ${sort === 'progress' ? 'name' : 'progress'}`} onPress={() => setSort(sort === 'progress' ? 'name' : 'progress')} style={styles.sortPill}><Text style={styles.sortText}>Sort: {sort === 'progress' ? 'Progress' : 'Name'}</Text><Ionicons name="swap-vertical" size={14} color={FateDropColors.secondary} /></Pressable></View>

        <View style={styles.list}>
          {visible.map((binder) => <BinderRow key={binder.setId} binder={binder} />)}
          {!loading && !error && !visible.length ? <StateLine icon="albums-outline" text={query.trim() ? 'No binders match that search.' : filter === 'complete' ? 'No completed binders yet.' : filter === 'progress' ? 'No binders are currently in progress.' : 'Add an ungraded card from FatePrice to begin a binder.'} /> : null}
        </View>

        <View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Completion uses verified raw printings only. Graded slabs never fill binder slots, as they are tracked separately.</Text></View>
      </ScrollView>
    </CollectionsScreen>
  );
}

function SummaryMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.summaryMetric}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function FilterButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterButton, selected && styles.filterButtonActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable>;
}

function BinderRow({ binder }: { binder: FateCollectorSetBinder }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${binder.setName || 'set'} binder`} onPress={() => router.push({ pathname: '/binder/[setId]', params: { setId: binder.setId, setName: binder.setName || undefined } })} style={({ pressed }) => [styles.binderRow, pressed && styles.pressed]}>
      <View style={styles.binderThumb}><FateCollectionsArt kind="binders" size={58} /></View>
      <View style={styles.binderText}><Text style={styles.binderName} numberOfLines={1}>{binder.setName || 'Verified set'}</Text><Text style={styles.binderMeta}>{binder.status === 'available' ? `${binder.ownedCount ?? '—'} / ${binder.totalCount ?? '—'} cards` : 'Checklist building · owned cards kept'}</Text><View style={styles.rowTrack}><View style={[styles.rowFill, { width: `${Math.min(100, Math.max(0, binder.completionPercent || 0))}%` }]} /></View></View>
      <Text style={styles.binderPct}>{pct(binder.status === 'available' ? binder.completionPercent : null)}</Text>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function StateLine({ danger = false, icon, loading = false, text }: { danger?: boolean; icon: keyof typeof Ionicons.glyphMap; loading?: boolean; text: string }) {
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name={icon} size={18} color={danger ? FateDropColors.vanished : FateDropColors.muted} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  search: { minHeight: 48, borderWidth: 1, borderColor: 'rgba(226,197,141,.35)', borderRadius: 12, paddingHorizontal: 14, color: FateDropColors.ivory, fontSize: 14, backgroundColor: 'rgba(4,8,21,.82)', marginTop: 18 },
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.58)' },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 44, height: 44, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 32, lineHeight: 37, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  summaryRow: { minHeight: 92, marginTop: 18, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', backgroundColor: 'rgba(4,8,21,.62)' },
  summaryMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 56, backgroundColor: 'rgba(226,197,141,.24)' },
  summaryValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, marginTop: 3 },
  summaryLabel: { color: FateDropColors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: .75, marginTop: 2, textAlign: 'center' },
  closestSummary: { flex: 1.25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  closestSummaryName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13, lineHeight: 17, textAlign: 'center', marginTop: 3 },
  closestCard: { marginTop: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.68)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.78)', overflow: 'hidden' },
  closestTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  closestMain: { flex: 1 },
  closestEyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  closestName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19, marginTop: 4 },
  closestPercent: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 40, lineHeight: 44, marginTop: 2 },
  closestOwned: { color: FateDropColors.secondary, fontSize: 11 },
  closestSide: { width: 98, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  missingBig: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 25 },
  missingLabel: { color: FateDropColors.secondary, fontSize: 11, marginTop: 1 },
  missingValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 11 },
  missingValueLabel: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.10)', marginTop: 13, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  topNeeded: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)', marginTop: 14, paddingTop: 11 },
  topNeededHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topNeededTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15 },
  topNeededRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  neededMini: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 5 },
  neededMiniArt: { width: 30, height: 42, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  neededMiniName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 11 },
  neededMiniMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  noNeeded: { color: FateDropColors.secondary, fontSize: 11 },
  importPanel: { marginTop: 16, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 16, backgroundColor: 'rgba(4,8,21,.74)' },
  importHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  importEyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  importTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, lineHeight: 21, marginTop: 3 },
  importCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 5 },
  importButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', borderRadius: 12, backgroundColor: 'rgba(226,197,141,.06)' },
  importButtonTitle: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: .55 },
  importButtonCopy: { color: FateDropColors.secondary, fontSize: 9, marginTop: 3 },
  previewCard: { marginTop: 10, padding: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', borderRadius: 12, backgroundColor: 'rgba(3,7,18,.62)' },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewTitle: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  previewCount: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  previewCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 5 },
  previewWarning: { color: FateDropColors.vanished, fontSize: 10, lineHeight: 15, marginTop: 6 },
  confirmButton: { minHeight: 44, marginTop: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: FateDropColors.goldBright },
  confirmText: { color: FateDropColors.background, fontSize: 10, fontWeight: '900', letterSpacing: .65 },
  importMessageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 9 },
  importMessage: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  filterRail: { flexDirection: 'row', marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 20, overflow: 'hidden' },
  filterButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: 'rgba(226,197,141,.11)', borderWidth: 1, borderColor: 'rgba(226,197,141,.62)', borderRadius: 20 },
  filterText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 12 },
  filterTextActive: { color: FateDropColors.ivory },
  listHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 21, marginBottom: 11 },
  listTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24 },
  listCopy: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
  sortPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 11 },
  list: { gap: 9 },
  binderRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 12, backgroundColor: 'rgba(4,8,21,.68)' },
  binderThumb: { width: 64, alignItems: 'center', justifyContent: 'center' },
  binderText: { flex: 1 },
  binderName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16 },
  binderMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  rowTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.10)', marginTop: 7 },
  rowFill: { height: 4, borderRadius: 2, backgroundColor: FateDropColors.goldBright },
  binderPct: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 16 },
  stateLine: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  stateText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  truth: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 15, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: .72 },
});
