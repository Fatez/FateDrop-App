import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { CollectionsScreen } from '@/components/fate-collections-ui';
import { FateCollectionsArt } from '@/components/fate-collections-art';
import { useCollectionCardPrice } from '@/hooks/use-collection-card-price';
import { binderEntries, isBinderComplete } from '@/lib/fate-collections-view';
import { useCollectionsResource } from '@/hooks/use-collections-resource';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  addExactCardToCollector,
  fetchFateCollectorCollection,
  fetchFateCollectorDashboard,
  type FateCollectorItem,
  type FateCollectorMissingCard,
} from '@/services/fate-collector';

type BinderView = 'needed' | 'owned' | 'all';
type ArtFields = { imageUrl?: string | null; thumbnailUrl?: string | null };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
}

function money(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || 'GBP'}`;
  }
}

export default function FateBinderScreen() {
  const params = useLocalSearchParams<{ setId?: string | string[]; setName?: string | string[] }>();
  const setId = first(params.setId)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const request = useCallback(async () => {
    if (!setId) throw new Error('This binder does not have a set identity. Open it from Fate Collections.');
    const [dashboard, collection] = await Promise.all([fetchFateCollectorDashboard({ force: true }), fetchFateCollectorCollection()]);
    return { binder: dashboard.summary.sets?.find((item) => item.setId === setId) || null, items: collection.items };
  }, [setId]);
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


  const entries = useMemo(() => binderEntries(data?.items || [], binder?.missingCards || [], setId, view, query, sort), [data, binder, setId, view, query, sort]);
  const owned = useMemo(() => binderEntries(data?.items || [], [], setId, 'owned'), [data, setId]);
  const checklistReady = binder?.status === 'available' && Number(binder.totalCount) > 0;
  const complete = isBinderComplete(binder);
  const setName = binder?.setName || routeSetName || 'Set binder';
  const currency = binder?.value?.currencyCode || 'GBP';

  const addMissing = async (card: FateCollectorMissingCard) => {
    if (addLock.current) return;
    addLock.current = true;
    setAddingId(card.fateCardId);
    setMessage('');
    try {
      await addExactCardToCollector(card.fateCardId);
      setMessage(`${card.name || 'Card'} added to your ungraded collection.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'That card could not be added safely.');
    } finally {
      addLock.current = false;
      setAddingId('');
    }
  };

  return (
    <CollectionsScreen>

      <FlatList
        key={columns}
        numColumns={columns}
        data={entries}
        keyExtractor={(entry) => entry.key}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}
        ListHeaderComponent={<>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/binders')} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · BINDERS</Text>
            <Text style={styles.title}>{setName}</Text>
            <Text style={styles.copy}>Track every verified raw card in this set. Add missing cards, review owned copies, and keep graded slabs separate.</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressArt}>
            <View style={styles.artOrbit} />
            <FateCollectionsArt kind="binders" size={86} />
            <Text style={styles.artSetLabel} numberOfLines={2}>{setName}</Text>
          </View>
          <View style={styles.progressMain}>
            <Text style={styles.progressEyebrow}>SET COMPLETION</Text>
            <Text style={styles.progressPct}>{pct(checklistReady ? binder?.completionPercent : null)}</Text>
            <Text style={styles.progressOwned}>{binder?.ownedCount ?? '—'} / {binder?.totalCount ?? '—'} cards owned</Text>
          </View>
          <View style={styles.progressSide}>
            <Text style={styles.missingCount}>{binder?.missingCount ?? '—'}</Text>
            <Text style={styles.sideLabel}>cards missing</Text>
            <Text style={styles.missingValue}>{money(binder?.value?.missingValue, currency)}</Text>
            <Text style={styles.sideLabel}>verified missing value</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, binder?.completionPercent || 0))}%` }]} /></View>
          <View style={styles.progressTruth}>
            <Ionicons name="information-circle-outline" size={15} color={FateDropColors.goldBright} />
            <Text style={styles.progressTruthText}>Completion uses verified raw printings only · Graded cards do not fill binder slots.</Text>
          </View>
        </View>

        <View style={styles.setValues}>
          <View style={styles.flex}><Text style={styles.sideLabel}>FULL SET VALUE</Text><Text style={styles.missingValue}>{money(binder?.value?.fullSetValue, currency)}</Text></View>
          <View style={styles.flex}><Text style={styles.sideLabel}>OWNED SET VALUE</Text><Text style={styles.missingValue}>{money(binder?.value?.ownedValue, currency)}</Text></View>
        </View>
        <View style={styles.switcher}>
          <ViewButton label="NEEDED" value={checklistReady ? binder?.missingCount ?? null : null} selected={view === 'needed'} onPress={() => setView('needed')} />
          <ViewButton label="OWNED" value={data ? owned.length : null} selected={view === 'owned'} onPress={() => setView('owned')} />
          <ViewButton label="ALL" value={checklistReady ? binder?.totalCount ?? null : null} selected={view === 'all'} onPress={() => setView('all')} />
        </View>

        <TextInput accessibilityLabel="Search binder cards" value={query} onChangeText={setQuery} placeholder="Find a card or number…" placeholderTextColor={FateDropColors.secondary} style={styles.search} autoCorrect={false} />

        <View style={styles.listHead}>
          <Text style={styles.listTitle}>{entries.length} {view === 'needed' ? 'needed' : view === 'owned' ? 'owned' : ''} card entries</Text>
          <Pressable accessibilityRole="button" onPress={() => setSort(sort === 'number' ? 'name' : 'number')} style={styles.sortPill}><Text style={styles.sortText}>Sort: {sort === 'number' ? 'Number' : 'Name'}</Text><Ionicons name="swap-vertical" size={14} color={FateDropColors.secondary} /></Pressable>
        </View>

        {message ? <View accessibilityLiveRegion="polite" style={styles.message}><Ionicons name="sparkles-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.messageText}>{message}</Text></View> : null}
        {error ? <StateLine danger text={error} /> : null}
        {loading && !binder ? <StateLine loading text="Opening your binder…" /> : null}
        {!loading && !error && !checklistReady ? <StateLine text="This checklist is still building. Your owned cards remain available; completion and missing cards are not known yet." /> : null}

        </>}
        renderItem={({ item: entry }) => <View style={{ width: `${100 / columns}%`, paddingHorizontal: 4, paddingBottom: 10 }}>
          {entry.state === 'needed' ? <MissingCard card={entry.card} adding={addingId === entry.card.fateCardId} disabled={Boolean(addingId) || loading} onAdd={() => void addMissing(entry.card)} refreshKey={data} /> : <OwnedCard item={entry.item} setId={setId} setName={setName} refreshKey={data} />}
        </View>}
        ListFooterComponent={<>
        {!loading && !error && !entries.length ? <StateLine success={complete && !query.trim() && view === 'needed'} text={query.trim() ? 'No cards match that search.' : complete && view === 'needed' ? 'Nothing missing. Every verified checklist printing is represented.' : view === 'owned' ? 'No ungraded cards are recorded here yet.' : checklistReady ? 'No card details are available for this view yet.' : 'Open Owned to see the cards already in your collection.'} /> : null}


        <View style={styles.truth}>
          <Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} />
          <Text style={styles.truthText}>Duplicates increase copy count, not completion. One verified raw printing fills one checklist slot. Graded cards remain separate.</Text>
        </View>
        </>}
      />
    </CollectionsScreen>
  );
}

function ViewButton({ label, onPress, selected, value }: { label: string; onPress: () => void; selected: boolean; value: number | null }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.viewButton, selected && styles.viewButtonActive]}><Text style={[styles.viewValue, selected && styles.viewValueActive]}>{value ?? '—'}</Text><Text style={[styles.viewLabel, selected && styles.viewLabelActive]}>{label}</Text></Pressable>;
}

function MissingCard({ adding, card, disabled, onAdd, refreshKey }: { adding: boolean; card: FateCollectorMissingCard; disabled: boolean; onAdd: () => void; refreshKey: unknown }) {
  const price = useCollectionCardPrice(card.fateCardId, refreshKey);
  const withArt = card as FateCollectorMissingCard & ArtFields;
  const art = withArt.thumbnailUrl || withArt.imageUrl || null;
  return (
    <View style={styles.card}>
      {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={24} color={FateDropColors.echo} /></View>}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{card.name || 'Verified card'}</Text>
        <Text style={styles.cardPrice}>{money(price?.amount, price?.currencyCode)}</Text>
        <Text style={styles.cardNumber}>#{card.collectorNumber || '—'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{card.rarity || card.variantCode || 'Exact printing'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: card.fateCardId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setId: card.setId, setName: card.setName || undefined, tcg: card.tcgCode || undefined } })} style={styles.priceButton}>
          <Ionicons name="analytics-outline" size={12} color={FateDropColors.echo} /><Text style={styles.priceButtonText}>FATEPRICE</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${card.name || 'card'} as owned`} accessibilityState={{ disabled, busy: adding }} disabled={disabled} onPress={onAdd} style={({ pressed }) => [styles.addButton, disabled && styles.disabled, pressed && styles.pressed]}>
        {adding ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <><Ionicons name="add" size={15} color={FateDropColors.background} /><Text style={styles.addText}>ADD OWNED</Text></>}
      </Pressable>
    </View>
  );
}

function OwnedCard({ item, setId, setName, refreshKey }: { item: FateCollectorItem; setId: string; setName: string; refreshKey: unknown }) {
  const price = useCollectionCardPrice(item.fateCardId, refreshKey);
  const card = item.card as (NonNullable<FateCollectorItem['card']> & ArtFields) | null | undefined;
  const art = card?.thumbnailUrl || card?.imageUrl || null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fate-price', params: { cardId: item.fateCardId, name: card?.name || undefined, collectorNumber: card?.collectorNumber || undefined, setId, setName, tcg: card?.tcgCode || undefined } })} style={({ pressed }) => [styles.card, styles.ownedCard, pressed && styles.pressed]}>
      {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <View style={[styles.cardArtPlaceholder, styles.ownedArt]}><Ionicons name="checkmark-circle-outline" size={24} color={FateDropColors.manifested} /></View>}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{card?.name || 'Verified card'}</Text>
        <Text style={styles.cardNumber}>#{card?.collectorNumber || '—'}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.conditionCode?.replaceAll('_', ' ') || 'condition unknown'} · ×{item.quantity}</Text>
        <Text style={styles.cardPrice}>{money(price?.amount, price?.currencyCode)}{price ? ' each' : ''}</Text>
        <Text style={styles.ownedLabel}>OWNED · ×{item.quantity}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} />
    </Pressable>
  );
}

function StateLine({ danger = false, loading = false, success = false, text }: { danger?: boolean; loading?: boolean; success?: boolean; text: string }) {
  const color = danger ? FateDropColors.vanished : success ? FateDropColors.manifested : FateDropColors.muted;
  return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : success ? 'checkmark-circle-outline' : 'time-outline'} size={19} color={color} />}<Text style={styles.stateText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  gridRow: { marginHorizontal: -4 },
  disabled: { opacity: .5 },
  cardPrice: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 17, marginTop: 7 },
  setValues: { flexDirection: 'row', gap: 16, padding: 14, backgroundColor: 'rgba(4,8,21,.85)', borderRadius: 12, marginTop: 10 },
  search: { minHeight: 48, borderWidth: 1, borderColor: 'rgba(226,197,141,.35)', borderRadius: 12, paddingHorizontal: 14, color: FateDropColors.ivory, fontSize: 14, backgroundColor: 'rgba(4,8,21,.82)', marginTop: 18 },
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,18,.58)' },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 44, height: 44, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: FateDropColors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.58)' },
  flex: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 32, lineHeight: 37, marginTop: 5 },
  copy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  progressCard: { marginTop: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(226,197,141,.66)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.76)', overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  progressArt: { width: 92, minHeight: 116, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artOrbit: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.42)' },
  artSetLabel: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 11, textAlign: 'center', marginTop: 8 },
  progressMain: { flex: 1, minWidth: 120 },
  progressEyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  progressPct: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 42, lineHeight: 48, marginTop: 2 },
  progressOwned: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  progressSide: { width: 92, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  missingCount: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 25 },
  sideLabel: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 1 },
  missingValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 10 },
  track: { width: '100%', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.10)', marginTop: 2 },
  fill: { height: 5, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  progressTruth: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 10, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.22)' },
  progressTruthText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  switcher: { flexDirection: 'row', marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', borderRadius: 21, overflow: 'hidden' },
  viewButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  viewButtonActive: { borderWidth: 1, borderColor: FateDropColors.goldBright, borderRadius: 21, backgroundColor: 'rgba(226,197,141,.09)' },
  viewValue: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 15 },
  viewValueActive: { color: FateDropColors.ivory },
  viewLabel: { color: FateDropColors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: .8, marginTop: 1 },
  viewLabelActive: { color: FateDropColors.goldBright },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, marginBottom: 9 },
  listTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19 },
  sortPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 11 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
  messageText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flex: 1, width: '100%', minHeight: 250, padding: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.76)', overflow: 'hidden' },
  ownedCard: { minHeight: 220, borderColor: 'rgba(124,110,255,.48)' },
  cardArt: { width: '100%', aspectRatio: .72, borderRadius: 7, backgroundColor: 'rgba(124,110,255,.08)' },
  cardArtPlaceholder: { width: '100%', aspectRatio: .72, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  ownedArt: { borderColor: 'rgba(66,225,151,.36)' },
  cardBody: { flex: 1, paddingTop: 8 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14, lineHeight: 17 },
  cardNumber: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
  priceButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7, paddingHorizontal: 8, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', borderRadius: 13 },
  priceButtonText: { color: FateDropColors.echo, fontSize: 11, fontWeight: '900', letterSpacing: .7 },
  addButton: { minHeight: 44, marginTop: 9, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: FateDropColors.goldBright },
  addText: { color: FateDropColors.background, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  ownedLabel: { color: FateDropColors.manifested, fontSize: 11, fontWeight: '900', letterSpacing: .8, marginTop: 9 },
  stateLine: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  truth: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 15, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: .72 },
});
