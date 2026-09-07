import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { CanonicalThumbnail } from '@/components/canonical-thumbnail';
import { FateCollectionsArt } from '@/components/fate-collections-art';
import { CollectionsScreen } from '@/components/fate-collections-ui';
import { FateMetricStrip, FateProgressRing, FateSectionHeading } from '@/components/fate-polish-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useCollectionCardPrice } from '@/hooks/use-collection-card-price';
import { useCollectionsResource } from '@/hooks/use-collections-resource';
import { binderEntries, isBinderComplete } from '@/lib/fate-collections-view';
import { addExactCardToCollector, confirmFateCollectorSetCompletion, fetchFateCollectorCollection, fetchFateCollectorSetProgress, previewFateCollectorSetCompletion, removeFateCollectorSetCompletion, type FateCollectorItem, type FateCollectorMissingCard, type FateCollectorSetBinder, type FateCollectorSetCompletionPreview } from '@/services/fate-collector';

type BinderView = 'needed' | 'owned' | 'all';
type ArtFields = { imageUrl?: string | null; thumbnailUrl?: string | null };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
function pct(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`; }
function money(value: number | null | undefined, currency: string | undefined) { if (value == null || !Number.isFinite(value)) return '—'; try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value); } catch { return `${value.toFixed(2)} ${currency || 'GBP'}`; } }

export default function FateBinderScreenV2() {
  const params = useLocalSearchParams<{ setId?: string | string[]; setName?: string | string[] }>();
  const setId = first(params.setId)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const request = useCallback(async () => { if (!setId) throw new Error('This binder does not have a set identity. Open it from Fate Collections.'); const [progress, collection] = await Promise.all([fetchFateCollectorSetProgress(setId), fetchFateCollectorCollection()]); return { binder: progress.progress, items: collection.items }; }, [setId]);
  const { data, loading, error, load } = useCollectionsResource(request, setId);
  const binder = data?.binder;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'number' | 'name'>('number');
  const addLock = useRef(false);
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 350 || fontScale > 1.3 ? 1 : width >= 720 ? 3 : 2;
  const [view, setView] = useState<BinderView>('needed');
  const [addingId, setAddingId] = useState('');
  const [message, setMessage] = useState('');
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionPreview, setCompletionPreview] = useState<FateCollectorSetCompletionPreview | null>(null);

  const entries = useMemo(() => binderEntries(data?.items || [], binder?.missingCards || [], setId, view, query, sort), [data, binder, setId, view, query, sort]);
  const owned = useMemo(() => binderEntries(data?.items || [], [], setId, 'owned'), [data, setId]);
  const checklistReady = binder?.status === 'available' && Number(binder.totalCount) > 0;
  const complete = isBinderComplete(binder);
  const setName = binder?.setName || routeSetName || 'Set binder';
  const currency = binder?.value?.currencyCode || 'GBP';
  const topMissing = binder?.topMissingCards?.slice(0, 3) || [];
  const missingPriceCoverageComplete = binder?.value?.missingExpectedCount != null && binder?.value?.missingUnpricedCount === 0;

  const addMissing = async (card: FateCollectorMissingCard) => { if (addLock.current) return; addLock.current = true; setAddingId(card.fateCardId); setMessage(''); try { await addExactCardToCollector(card.fateCardId); setMessage(`${card.name || 'Card'} added to your ungraded collection.`); await load(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'That card could not be added safely.'); } finally { addLock.current = false; setAddingId(''); } };
  const openSetCompletion = async () => {
    if (!binder || completionBusy) return;
    setMessage('');
    if (complete && binder.hasUserCompletionAssertion) {
      setCompletionPreview(null);
      setCompletionOpen(true);
      return;
    }
    setCompletionBusy(true);
    try {
      const preview = await previewFateCollectorSetCompletion(setId);
      setCompletionPreview(preview);
      setCompletionOpen(true);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'This checklist could not be prepared safely.');
    } finally {
      setCompletionBusy(false);
    }
  };
  const confirmSetCompletion = async () => {
    if (!completionPreview || completionBusy) return;
    setCompletionBusy(true);
    try {
      const result = await confirmFateCollectorSetCompletion(setId, completionPreview.confirmationToken);
      setMessage(result.duplicate ? 'This verified checklist was already complete.' : `${result.newlyConfirmedPrintingCount} printing slots marked complete. Exact finishes can be confirmed whenever you are ready.`);
      setCompletionOpen(false);
      setCompletionPreview(null);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'This checklist could not be completed safely.');
      setCompletionOpen(false);
    } finally {
      setCompletionBusy(false);
    }
  };
  const removeSetCompletion = async () => {
    if (completionBusy) return;
    setCompletionBusy(true);
    try {
      await removeFateCollectorSetCompletion(setId);
      setMessage('Checklist confirmation removed. Your individually recorded cards are untouched.');
      setCompletionOpen(false);
      setCompletionPreview(null);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'This checklist confirmation could not be removed.');
    } finally {
      setCompletionBusy(false);
    }
  };

  return <CollectionsScreen><FlatList
    key={columns} numColumns={columns} data={entries} keyExtractor={(entry) => entry.key} initialNumToRender={12} maxToRenderPerBatch={6} windowSize={5}
    keyboardShouldPersistTaps="handled" columnWrapperStyle={columns > 1 ? styles.gridRow : undefined} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}
    ListHeaderComponent={<>
      <View style={styles.headerRow}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/binders')} style={styles.back}><Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>FATE COLLECTIONS · BINDERS</Text><Text style={styles.title}>{setName}</Text><Text style={styles.copy}>See exactly what you own, what you still need, and the verified value of the gap. Graded slabs stay separate from binder completion.</Text></View></View>

      <View style={styles.progressCard}>
        <View style={styles.progressVisual}><FateProgressRing value={checklistReady ? binder?.completionPercent : null} size={112} /><FateCollectionsArt kind="binders" size={58} /></View>
        <View style={styles.progressMain}><Text style={styles.progressEyebrow}>SET COMPLETION</Text><Text style={styles.progressTitle}>{complete ? 'Binder complete.' : checklistReady ? `${binder?.missingCount ?? '—'} cards stand between you and completion.` : 'Verified checklist building.'}</Text><Text style={styles.progressOwned}>{binder?.ownedCount ?? '—'} / {binder?.totalCount ?? '—'} verified printing slots represented</Text>{binder?.exactIdentityConfirmationNeededCount ? <Text style={styles.progressEvidence}>{binder.exactOwnedCount ?? 0} exact · {binder.exactIdentityConfirmationNeededCount} need finish confirmation for value</Text> : null}</View>
        {checklistReady && (!complete || binder?.hasUserCompletionAssertion) ? <Pressable accessibilityRole="button" accessibilityLabel={complete ? `Manage ${setName} checklist completion` : `Mark ${setName} checklist complete`} disabled={completionBusy} onPress={() => void openSetCompletion()} style={({ pressed }) => [styles.completionAction, complete && styles.completionActionManage, (pressed || completionBusy) && styles.pressed]}>{completionBusy && !completionOpen ? <ActivityIndicator size="small" color={complete ? FateDropColors.goldBright : FateDropColors.background} /> : <Ionicons name={complete ? 'options-outline' : 'checkmark-done-outline'} size={15} color={complete ? FateDropColors.goldBright : FateDropColors.background} />}<Text style={[styles.completionActionText, complete && styles.completionActionTextManage]}>{complete ? 'MANAGE COMPLETION' : 'MARK CHECKLIST COMPLETE'}</Text></Pressable> : null}
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, binder?.completionPercent || 0))}%` }]} /></View>
      </View>

      <FateMetricStrip items={[
        { icon: 'checkmark-circle-outline', value: String(binder?.ownedCount ?? '—'), label: 'OWNED SLOTS', color: FateDropColors.manifested },
        { icon: 'search-outline', value: String(binder?.missingCount ?? '—'), label: 'STILL NEEDED', color: FateDropColors.echo },
        { icon: 'wallet-outline', value: money(binder?.value?.missingValue ?? binder?.value?.knownMissingValue, currency), label: binder?.value?.missingValue != null ? 'COST TO FINISH' : 'KNOWN REMAINDER', color: FateDropColors.goldBright },
        { icon: 'albums-outline', value: pct(checklistReady ? binder?.completionPercent : null), label: 'COMPLETE', color: FateDropColors.violetLight },
      ]} />
      <View style={styles.progressTruth}><Ionicons name="calculator-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.progressTruthText}>{binder?.value?.missingExpectedCount != null ? binder.value.missingUnpricedCount === 0 ? `All ${binder.value.missingExpectedCount} missing slots have verified current prices. Cost to finish is fully covered.` : `${binder.value.missingPricedCount ?? 0} of ${binder.value.missingExpectedCount} missing slots are priced · ${binder.value.missingUnpricedCount ?? 0} still unpriced. FateDrop shows the known remainder and does not estimate the rest.` : 'Finish-cost coverage appears as verified price evidence becomes available.'}</Text></View>

      {topMissing.length ? <>
        <FateSectionHeading eyebrow="FINISH THE SET" title={missingPriceCoverageComplete ? '3 most expensive cards left' : 'Highest-priced known cards left'} copy={missingPriceCoverageComplete ? 'The three highest current FatePrice values among the exact cards you still need.' : 'Price coverage is incomplete, so these are the highest-priced missing cards FateDrop can verify right now.'} />
        <View style={styles.topMissingRail}>
          {topMissing.map((card) => <Pressable key={`top:${card.fateCardId}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: card.fateCardId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setId: card.setId, setName: card.setName || undefined, tcg: card.tcgCode || undefined } })} style={({ pressed }) => [styles.topMissingCard, pressed && styles.pressed]}>
            <CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={card.thumbnailUrl || card.imageUrl} width={54} height={76} />
            <Text style={styles.topMissingName} numberOfLines={2}>{card.name || 'Verified card'}</Text>
            <Text style={styles.topMissingNumber}>#{card.collectorNumber || '—'}</Text>
            <Text style={styles.topMissingPrice}>{money(card.currentPrice, card.currencyCode || currency)}</Text>
          </Pressable>)}
        </View>
      </> : null}

      <View style={styles.valueBand}><View style={styles.valueCell}><Text style={styles.valueLabel}>OWNED SET VALUE</Text><Text style={styles.value}>{money(binder?.value?.ownedValue, currency)}</Text></View><View style={styles.valueDivider} /><View style={styles.valueCell}><Text style={styles.valueLabel}>VERIFIED FULL SET VALUE</Text><Text style={styles.value}>{money(binder?.value?.fullSetValue, currency)}</Text></View></View>
      <View style={styles.progressTruth}><Ionicons name="information-circle-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.progressTruthText}>Completion uses verified raw printings only. Duplicates add quantity, not extra completion. Graded cards never fill binder slots.</Text></View>

      <FateSectionHeading eyebrow="CHECKLIST" title={view === 'needed' ? 'Cards still needed' : view === 'owned' ? 'Cards you own' : 'Complete set checklist'} copy={view === 'needed' ? 'Missing cards are deliberately high contrast so the next action is obvious.' : 'Search exact card names or collector numbers.'} />
      <View style={styles.switcher}><ViewButton label="NEEDED" value={checklistReady ? binder?.missingCount ?? null : null} selected={view === 'needed'} onPress={() => setView('needed')} /><ViewButton label="OWNED" value={data ? owned.length : null} selected={view === 'owned'} onPress={() => setView('owned')} /><ViewButton label="ALL" value={checklistReady ? binder?.totalCount ?? null : null} selected={view === 'all'} onPress={() => setView('all')} /></View>
      <View style={styles.searchWrap}><Ionicons name="search-outline" size={17} color={FateDropColors.secondary} /><TextInput accessibilityLabel="Search binder cards" value={query} onChangeText={setQuery} placeholder="Find a card or number…" placeholderTextColor={FateDropColors.secondary} style={styles.search} autoCorrect={false} /></View>
      <View style={styles.listHead}><Text style={styles.listTitle}>{entries.length} {view === 'needed' ? 'needed' : view === 'owned' ? 'owned' : ''} entries</Text><Pressable onPress={() => setSort(sort === 'number' ? 'name' : 'number')} style={styles.sortPill}><Text style={styles.sortText}>Sort: {sort === 'number' ? 'Number' : 'Name'}</Text><Ionicons name="swap-vertical" size={14} color={FateDropColors.secondary} /></Pressable></View>
      {message ? <View style={styles.message}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.messageText}>{message}</Text></View> : null}
      {error ? <StateLine danger text={error} /> : null}{loading && !binder ? <StateLine loading text="Opening your binder…" /> : null}{!loading && !error && !checklistReady ? <StateLine text="This checklist is still building. Owned cards remain available; unknown completion stays unknown." /> : null}
    </>}
    renderItem={({ item: entry }) => <View style={{ width: `${100 / columns}%`, paddingHorizontal: 4, paddingBottom: 10 }}>{entry.state === 'needed' ? <MissingCard card={entry.card} adding={addingId === entry.card.fateCardId} disabled={Boolean(addingId) || loading} onAdd={() => void addMissing(entry.card)} refreshKey={data} /> : <OwnedCard item={entry.item} setId={setId} setName={setName} refreshKey={data} />}</View>}
    ListFooterComponent={<>{!loading && !error && !entries.length ? <StateLine success={complete && !query.trim() && view === 'needed'} text={query.trim() ? 'No cards match that search.' : complete && view === 'needed' ? binder?.exactIdentityConfirmationNeededCount ? 'Checklist complete from your confirmation. Confirm exact finishes over time to unlock card-level value.' : 'Nothing missing. Every verified checklist printing is represented.' : view === 'owned' ? binder?.hasUserCompletionAssertion ? 'No exact cards are recorded here yet. Your checklist confirmation remains separate from valued holdings.' : 'No ungraded cards are recorded here yet.' : checklistReady ? 'No card details are available for this view yet.' : 'Open Owned to see the cards already in your collection.'} /> : null}<View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Binder progress may use your explicit checklist confirmation. FatePrice values use Exact raw printings only; no finish or price is guessed.</Text></View></>}
  /><SetCompletionModal visible={completionOpen} busy={completionBusy} binder={binder} preview={completionPreview} setName={setName} onClose={() => { if (!completionBusy) setCompletionOpen(false); }} onConfirm={() => void confirmSetCompletion()} onRemove={() => void removeSetCompletion()} /></CollectionsScreen>;
}

function ViewButton({ label, onPress, selected, value }: { label: string; onPress: () => void; selected: boolean; value: number | null }) { return <Pressable onPress={onPress} style={[styles.viewButton, selected && styles.viewButtonActive]}><Text style={[styles.viewValue, selected && styles.viewValueActive]}>{value ?? '—'}</Text><Text style={[styles.viewLabel, selected && styles.viewLabelActive]}>{label}</Text></Pressable>; }
function MissingCard({ adding, card, disabled, onAdd, refreshKey }: { adding: boolean; card: FateCollectorMissingCard; disabled: boolean; onAdd: () => void; refreshKey: unknown }) { const price = useCollectionCardPrice(card.fateCardId, refreshKey); const withArt = card as FateCollectorMissingCard & ArtFields; const art = withArt.thumbnailUrl || withArt.imageUrl || null; return <View style={[styles.card, styles.neededCard]}><View style={styles.neededBadge}><Ionicons name="search-outline" size={10} color={FateDropColors.echo} /><Text style={styles.neededBadgeText}>NEEDED</Text></View><CanonicalThumbnail kind="card" setId={card.setId} collectorNumber={card.collectorNumber} sourceUrl={art} width={76} height={106} /><View style={styles.cardBody}><Text style={styles.cardName} numberOfLines={2}>{card.name || 'Verified card'}</Text><Text style={styles.cardNumber}>#{card.collectorNumber || '—'}</Text><Text style={styles.cardMeta} numberOfLines={1}>{card.rarity || card.variantCode || 'Exact printing'}</Text><Text style={styles.cardPrice}>{money(price?.amount, price?.currencyCode)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Buy ${card.name || 'this missing card'} from a verified retailer`} onPress={() => router.push({ pathname: '/fate-price-buy', params: { cardId: card.fateCardId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setName: card.setName || undefined, setId: card.setId, printingId: card.printingId || undefined, tcg: card.tcgCode || undefined } })} style={styles.priceButton}><Ionicons name="storefront-outline" size={12} color={FateDropColors.cyan} /><Text style={styles.priceButtonText}>BUY THIS CARD</Text></Pressable></View><Pressable disabled={disabled} onPress={onAdd} style={[styles.addButton, disabled && styles.disabled]}>{adding ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <><Ionicons name="add" size={14} color={FateDropColors.background} /><Text style={styles.addText}>ADD OWNED</Text></>}</Pressable></View>; }
function OwnedCard({ item, setId, setName, refreshKey }: { item: FateCollectorItem; setId: string; setName: string; refreshKey: unknown }) { const price = useCollectionCardPrice(item.fateCardId, refreshKey); const card = item.card as (NonNullable<FateCollectorItem['card']> & ArtFields) | null | undefined; const art = card?.thumbnailUrl || card?.imageUrl || null; return <Pressable onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, collectorNumber: card?.collectorNumber || undefined, setId, setName, tcg: card?.tcgCode || undefined } })} style={({ pressed }) => [styles.card, styles.ownedCard, pressed && styles.pressed]}><View style={styles.ownedBadge}><Ionicons name="checkmark" size={10} color={FateDropColors.manifested} /><Text style={styles.ownedBadgeText}>OWNED ×{item.quantity}</Text></View><CanonicalThumbnail kind="card" setId={card?.setId || setId} collectorNumber={card?.collectorNumber} sourceUrl={art} width={76} height={106} /><View style={styles.cardBody}><Text style={styles.cardName} numberOfLines={2}>{card?.name || 'Verified card'}</Text><Text style={styles.cardNumber}>#{card?.collectorNumber || '—'}</Text><Text style={styles.cardMeta}>{item.conditionCode?.replaceAll('_', ' ') || 'condition unknown'}</Text><Text style={styles.cardPrice}>{money(price?.amount, price?.currencyCode)}{price ? ' each' : ''}</Text></View><Ionicons name="chevron-forward" size={15} color={FateDropColors.ivory} /></Pressable>; }
function StateLine({ danger = false, loading = false, success = false, text }: { danger?: boolean; loading?: boolean; success?: boolean; text: string }) { const color = danger ? FateDropColors.vanished : success ? FateDropColors.manifested : FateDropColors.muted; return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : success ? 'checkmark-circle-outline' : 'time-outline'} size={18} color={color} />}<Text style={styles.stateText}>{text}</Text></View>; }

function SetCompletionModal({ visible, busy, binder, preview, setName, onClose, onConfirm, onRemove }: { visible: boolean; busy: boolean; binder?: FateCollectorSetBinder; preview: FateCollectorSetCompletionPreview | null; setName: string; onClose: () => void; onConfirm: () => void; onRemove: () => void }) {
  const managing = Boolean(binder?.hasUserCompletionAssertion && !preview);
  const count = preview?.action.printingCount ?? binder?.userConfirmedCount ?? 0;
  const exact = binder?.exactOwnedCount ?? 0;
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}><View style={styles.modalStage}><Pressable accessibilityRole="button" accessibilityLabel="Close set completion" onPress={onClose} style={StyleSheet.absoluteFill} /><View accessibilityViewIsModal style={styles.modalPanel}>
    <View pointerEvents="none" style={styles.modalOrbitOuter} /><View pointerEvents="none" style={styles.modalOrbitInner} />
    <View style={styles.modalArt}><FateCollectionsArt kind="binders" size={58} /></View>
    <Text style={styles.modalEyebrow}>FATE COLLECTIONS · VERIFIED CHECKLIST</Text>
    <Text style={styles.modalTitle}>{managing ? `${setName} is marked complete.` : `Mark ${setName} complete?`}</Text>
    <Text style={styles.modalCopy}>{managing ? 'This is your checklist-level confirmation. Remove it at any time; cards you added individually will remain untouched.' : `${count} missing verified printing ${count === 1 ? 'slot' : 'slots'} will be marked as represented in this binder.`}</Text>
    <View style={styles.modalMetrics}><View style={styles.modalMetric}><Text style={styles.modalMetricValue}>{exact}</Text><Text style={styles.modalMetricLabel}>EXACT CARDS</Text></View><View style={styles.modalMetricDivider} /><View style={styles.modalMetric}><Text style={styles.modalMetricValue}>{count}</Text><Text style={styles.modalMetricLabel}>{managing ? 'USER CONFIRMED' : 'TO CONFIRM'}</Text></View></View>
    <View style={styles.modalTruth}><Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright} /><Text style={styles.modalTruthText}>No finish, condition or price will be invented. These slots complete the binder only; exact cards enter Personal Collection value after you confirm their identity.</Text></View>
    {managing ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${setName} checklist confirmation`} disabled={busy} onPress={onRemove} style={[styles.modalRemove, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={FateDropColors.vanished} /> : <Ionicons name="return-up-back-outline" size={16} color={FateDropColors.vanished} />}<Text style={styles.modalRemoveText}>REMOVE CHECKLIST CONFIRMATION</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={`Confirm ${setName} checklist complete`} disabled={busy || !preview?.requiresUserConfirmation} onPress={onConfirm} style={[styles.modalConfirm, (busy || !preview?.requiresUserConfirmation) && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name="checkmark-done-outline" size={17} color={FateDropColors.background} />}<Text style={styles.modalConfirmText}>YES, MARK CHECKLIST COMPLETE</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={onClose} disabled={busy} style={styles.modalCancel}><Text style={styles.modalCancelText}>{managing ? 'DONE' : 'NOT YET'}</Text></Pressable>
  </View></View></Modal>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 }, flex: { flex: 1 }, gridRow: { alignItems: 'stretch' }, pressed: { opacity: .72 }, disabled: { opacity: .45 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 }, back: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' }, eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.15 }, title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 30, lineHeight: 35, marginTop: 5 }, copy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, marginTop: 6 },
  progressCard: { position: 'relative', overflow: 'hidden', marginTop: 16, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(226,197,141,.44)', backgroundColor: 'rgba(5,9,20,.86)' }, progressVisual: { flexDirection: 'row', alignItems: 'center', gap: 10 }, progressMain: { marginTop: 11 }, progressEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, progressTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, lineHeight: 24, marginTop: 4 }, progressOwned: { color: FateDropColors.secondary, fontSize: 10, marginTop: 4 }, progressEvidence: { color: FateDropColors.violetLight, fontSize: 8.5, lineHeight: 13, marginTop: 4 }, completionAction: { minHeight: 42, marginTop: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: FateDropColors.goldBright }, completionActionManage: { borderWidth: 1, borderColor: 'rgba(226,197,141,.44)', backgroundColor: 'rgba(226,197,141,.05)' }, completionActionText: { color: FateDropColors.background, fontSize: 8, fontWeight: '900', letterSpacing: .65 }, completionActionTextManage: { color: FateDropColors.goldBright }, track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.09)', marginTop: 12, overflow: 'hidden' }, fill: { height: 4, borderRadius: 2, backgroundColor: FateDropColors.goldBright }, valueBand: { flexDirection: 'row', marginTop: 11, marginBottom: 8, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FateDropColors.border }, valueCell: { flex: 1 }, valueDivider: { width: 1, backgroundColor: FateDropColors.border, marginHorizontal: 13 }, valueLabel: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .55 }, value: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900', marginTop: 3 }, progressTruth: { flexDirection: 'row', gap: 7, padding: 10, borderRadius: 12, backgroundColor: `${FateDropColors.goldBright}06` }, progressTruthText: { flex: 1, color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13 },
  switcher: { flexDirection: 'row', borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.border, overflow: 'hidden' }, viewButton: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center' }, viewButtonActive: { backgroundColor: `${FateDropColors.goldBright}0E` }, viewValue: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 16 }, viewValueActive: { color: FateDropColors.goldBright }, viewLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .6, marginTop: 2 }, viewLabelActive: { color: FateDropColors.ivory }, searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 47, marginTop: 9, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(4,8,21,.82)' }, search: { flex: 1, color: FateDropColors.ivory, fontSize: 12 }, listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 9 }, listTitle: { color: FateDropColors.secondary, fontSize: 9.5 }, sortPill: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4 }, sortText: { color: FateDropColors.secondary, fontSize: 8.5 }, message: { flexDirection: 'row', gap: 7, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: `${FateDropColors.goldBright}24`, backgroundColor: `${FateDropColors.goldBright}07`, marginBottom: 9 }, messageText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 13 },
  topMissingRail: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 }, topMissingCard: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(5,9,20,.82)' }, topMissingName: { color: FateDropColors.ivory, fontSize: 9.5, fontWeight: '800', textAlign: 'center', marginTop: 3 }, topMissingNumber: { color: FateDropColors.muted, fontSize: 7.5 }, topMissingPrice: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', marginTop: 2 },
  card: { minHeight: 290, position: 'relative', alignItems: 'center', padding: 10, borderRadius: 17, borderWidth: 1, backgroundColor: 'rgba(5,9,20,.88)', overflow: 'hidden' }, neededCard: { borderColor: `${FateDropColors.echo}55`, backgroundColor: `${FateDropColors.echo}06` }, ownedCard: { borderColor: `${FateDropColors.manifested}38`, backgroundColor: `${FateDropColors.manifested}05` }, neededBadge: { position: 'absolute', zIndex: 3, top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(8,13,21,.94)', borderWidth: 1, borderColor: `${FateDropColors.echo}58` }, neededBadgeText: { color: FateDropColors.echo, fontSize: 6.4, fontWeight: '900', letterSpacing: .5 }, ownedBadge: { position: 'absolute', zIndex: 3, top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(8,13,21,.94)', borderWidth: 1, borderColor: `${FateDropColors.manifested}48` }, ownedBadgeText: { color: FateDropColors.manifested, fontSize: 6.4, fontWeight: '900' }, cardArt: { width: '100%', height: 145, marginTop: 6 }, cardArtPlaceholder: { width: '100%', height: 145, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: `${FateDropColors.echo}08` }, ownedArt: { backgroundColor: `${FateDropColors.manifested}08` }, cardBody: { width: '100%', marginTop: 8 }, cardName: { color: FateDropColors.ivory, fontSize: 11.5, lineHeight: 15, fontWeight: '900' }, cardNumber: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', marginTop: 4 }, cardMeta: { color: FateDropColors.muted, fontSize: 8, marginTop: 3 }, cardPrice: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900', marginTop: 7 }, priceButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: `${FateDropColors.cyan}30` }, priceButtonText: { color: FateDropColors.cyan, fontSize: 6.5, fontWeight: '900' }, addButton: { width: '100%', minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 9, borderRadius: 10, backgroundColor: FateDropColors.goldBright }, addText: { color: FateDropColors.background, fontSize: 7, fontWeight: '900' },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, marginVertical: 8, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, stateText: { flex: 1, color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14 }, truth: { flexDirection: 'row', gap: 8, marginTop: 17, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.20)', backgroundColor: 'rgba(4,8,21,.62)' }, truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 },
  modalStage: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,2,10,.84)' }, modalPanel: { width: '100%', maxWidth: 460, alignSelf: 'center', overflow: 'hidden', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(226,197,141,.55)', backgroundColor: 'rgba(4,8,21,.98)' }, modalOrbitOuter: { position: 'absolute', top: -108, alignSelf: 'center', width: 300, height: 210, borderRadius: 150, borderWidth: 1, borderColor: 'rgba(124,110,255,.34)' }, modalOrbitInner: { position: 'absolute', top: -76, alignSelf: 'center', width: 220, height: 155, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(226,197,141,.28)' }, modalArt: { height: 74, alignItems: 'center', justifyContent: 'center' }, modalEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 4 }, modalTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24, lineHeight: 29, textAlign: 'center', marginTop: 7 }, modalCopy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 8 }, modalMetrics: { minHeight: 64, flexDirection: 'row', marginTop: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(226,197,141,.22)' }, modalMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, modalMetricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20 }, modalMetricLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .65, marginTop: 2 }, modalMetricDivider: { width: 1, marginVertical: 12, backgroundColor: 'rgba(226,197,141,.22)' }, modalTruth: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 15, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(124,110,255,.38)', backgroundColor: 'rgba(124,110,255,.07)' }, modalTruthText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 }, modalConfirm: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 15, borderRadius: 13, backgroundColor: FateDropColors.goldBright }, modalConfirmText: { color: FateDropColors.background, fontSize: 8, fontWeight: '900', letterSpacing: .55 }, modalRemove: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 15, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.vanished}66`, backgroundColor: `${FateDropColors.vanished}09` }, modalRemoveText: { color: FateDropColors.vanished, fontSize: 8, fontWeight: '900', letterSpacing: .45 }, modalCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, modalCancelText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
});
