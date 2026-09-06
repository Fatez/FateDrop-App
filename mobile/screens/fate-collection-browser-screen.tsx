import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { CollectionsScreen } from '@/components/fate-collections-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useCollectionCardPrice } from '@/hooks/use-collection-card-price';
import { useCollectionsResource } from '@/hooks/use-collections-resource';
import {
  FateCollectorApiError,
  addExactCardToCollector,
  fetchFateCollectorCollection,
  fetchFateCollectorDashboard,
  fetchFateCollectorIntelligence,
  updateFateCollectorItemQuantity,
  type FateCollectorIntelligenceCard,
  type FateCollectorIntelligenceSet,
  type FateCollectorItem,
} from '@/services/fate-collector';

type ViewKey = 'overview' | 'cards' | 'sets';
type FilterKey = 'all' | 'pokemon' | 'one-piece';
type PeriodKey = 'd7' | 'd30';
type CollectionRow =
  | { kind: 'card'; card: FateCollectorIntelligenceCard }
  | { kind: 'legacy-card'; item: FateCollectorItem }
  | { kind: 'set'; set: FateCollectorIntelligenceSet };

function money(value: number | null | undefined, currency = 'GBP') {
  if (value == null || !Number.isFinite(value)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${value.toFixed(2)} ${currency}`; }
}

function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function normalise(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function isOnePiece(value: string | null | undefined) {
  return ['one_piece', 'one-piece', 'onepiece'].includes(normalise(value));
}

const readCollection = async () => {
  const [collection, dashboard, intelligence] = await Promise.all([
    fetchFateCollectorCollection(),
    fetchFateCollectorDashboard({ force: true }),
    fetchFateCollectorIntelligence({ force: true }).catch((cause) => {
      if (cause instanceof FateCollectorApiError && cause.status === 404) return null;
      throw cause;
    }),
  ]);
  return { collection, dashboard, intelligence };
};

export default function FateCollectionBrowserScreen() {
  const { data, loading, error, load } = useCollectionsResource(readCollection);
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [view, setView] = useState<ViewKey>('overview');
  const [period, setPeriod] = useState<PeriodKey>('d30');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const intelligence = data?.intelligence;
  const currency = intelligence?.currencyCode || data?.dashboard.summary.currencyCode || 'GBP';
  const rawItems = useMemo(() => data?.collection.items.filter((item) => item.copyState === 'raw') || [], [data]);
  const itemsByIdentity = useMemo(() => {
    const grouped = new Map<string, FateCollectorItem[]>();
    for (const item of rawItems) grouped.set(item.fateCardId, [...(grouped.get(item.fateCardId) || []), item]);
    return grouped;
  }, [rawItems]);

  const rows = useMemo<CollectionRow[]>(() => {
    const q = normalise(query);
    if (view === 'sets') {
      return (intelligence?.sets || []).filter((set) => {
        if (q && ![set.setName, set.tcgCode].map(normalise).join(' ').includes(q)) return false;
        if (filter === 'pokemon' && normalise(set.tcgCode) !== 'pokemon') return false;
        if (filter === 'one-piece' && !isOnePiece(set.tcgCode)) return false;
        return true;
      }).map((set) => ({ kind: 'set', set }));
    }
    if (view !== 'cards') return [];
    if (intelligence) {
      return intelligence.cards.filter((card) => {
        if (q && ![card.name, card.setName, card.collectorNumber, card.rarity, card.variantCode, card.tcgCode].map(normalise).join(' ').includes(q)) return false;
        if (filter === 'pokemon' && normalise(card.tcgCode) !== 'pokemon') return false;
        if (filter === 'one-piece' && !isOnePiece(card.tcgCode)) return false;
        return true;
      }).map((card) => ({ kind: 'card', card }));
    }
    const matching = rawItems.filter((item) => {
      const card = item.card;
      if (q && ![card?.name, card?.setName, card?.collectorNumber, card?.rarity, card?.variantCode, card?.tcgCode].map(normalise).join(' ').includes(q)) return false;
      if (filter === 'pokemon' && normalise(card?.tcgCode) !== 'pokemon') return false;
      if (filter === 'one-piece' && !isOnePiece(card?.tcgCode)) return false;
      return true;
    });
    return [...new Map(matching.map((item) => [item.fateCardId, item])).values()].map((item) => ({ kind: 'legacy-card', item }));
  }, [filter, intelligence, query, rawItems, view]);

  const rawFallback = data?.dashboard.summary.rawCollection;
  const knownValue = intelligence?.snapshot.currentKnownValue ?? rawFallback?.knownValue;
  const hasKnownValue = (intelligence?.snapshot.pricedCopies || rawFallback?.pricedUnits || 0) > 0;
  const movement = intelligence?.periods[period];

  return <CollectionsScreen>
    <FlatList
      data={rows}
      keyExtractor={(row) => row.kind === 'set' ? `set:${row.set.setId || row.set.setName}` : row.kind === 'card' ? `card:${row.card.cardIdentityId}` : `legacy:${row.item.fateCardId}`}
      renderItem={({ item }) => item.kind === 'set'
        ? <OwnedSetRow set={item.set} period={period} currency={currency} />
        : item.kind === 'card'
          ? <IntelligenceCardRow card={item.card} currency={currency} items={itemsByIdentity.get(item.card.cardIdentityId) || []} onChanged={load} />
          : <LegacyCardRow item={item.item} items={itemsByIdentity.get(item.item.fateCardId) || [item.item]} refreshKey={data} onChanged={load} />}
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={5}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.goldBright} />}
      ListHeaderComponent={<>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Fate Collections" onPress={() => router.canGoBack() ? router.back() : router.replace('/collections')} style={styles.back}><Ionicons name="chevron-back" size={21} color={FateDropColors.goldBright} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FATE COLLECTIONS · COLLECTION INTELLIGENCE</Text>
            <Text style={styles.title}>Your collection. Understood.</Text>
            <Text style={styles.copy}>Live intelligence from the exact raw cards you own. See value, movement and where your collection is strongest.</Text>
          </View>
        </View>

        <View style={styles.valueCard}>
          <View style={styles.valueOrbitA} /><View style={styles.valueOrbitB} />
          <Text style={styles.valueLabel}>KNOWN RAW-CARD VALUE</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.valueMain}>{hasKnownValue ? money(knownValue, currency) : '—'}</Text>
          <View style={styles.valueMetrics}>
            <HeroMetric label={`${period === 'd7' ? '7D' : '30D'} MOVEMENT`} value={movement?.status === 'available' ? percent(movement.movementPercent) : 'BUILDING'} accent={Number(movement?.movementPercent) < 0 ? FateDropColors.vanished : FateDropColors.manifested} />
            <View style={styles.valueDivider} />
            <HeroMetric label="TOTAL COPIES" value={String(intelligence?.snapshot.totalCopies ?? data?.dashboard.summary.rawCardUnits ?? '—')} />
            <View style={styles.valueDivider} />
            <HeroMetric label="PRICE COVERAGE" value={intelligence ? `${intelligence.snapshot.priceCoveragePercent.toFixed(1)}%` : rawFallback ? `${rawFallback.priceCoveragePercent.toFixed(1)}%` : '—'} />
          </View>
        </View>

        <View style={styles.scopeRail}>
          <ScopeButton label="Overview" selected={view === 'overview'} onPress={() => setView('overview')} />
          <ScopeButton label="Cards" selected={view === 'cards'} onPress={() => setView('cards')} />
          <ScopeButton label="Sets" selected={view === 'sets'} onPress={() => setView('sets')} />
        </View>

        {loading && !data ? <StateLine loading text="Understanding your collection…" /> : null}
        {error ? <StateLine danger text={error} /> : null}
        {view === 'overview' ? <Overview compact={compact} currency={currency} intelligence={intelligence} period={period} setPeriod={setPeriod} onCards={() => setView('cards')} /> : <InventoryHeader view={view} count={rows.length} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} period={period} setPeriod={setPeriod} />}
        {!loading && !error && view !== 'overview' && !rows.length ? <StateLine text={view === 'cards' ? 'No owned raw cards match this view.' : 'No owned sets match this view. Sets appear here automatically from your raw cards.'} /> : null}
      </>}
      ListFooterComponent={<View style={styles.truth}><Ionicons name="shield-checkmark-outline" size={17} color={FateDropColors.goldBright} /><Text style={styles.truthText}>Intelligence uses exact raw cards and current owned quantities. Duplicate copies stay one card identity, missing prices stay unknown, and graded slabs stay in Graded.</Text></View>}
    />
  </CollectionsScreen>;
}

function Overview({ compact, currency, intelligence, onCards, period, setPeriod }: {
  compact: boolean;
  currency: string;
  intelligence: Awaited<ReturnType<typeof fetchFateCollectorIntelligence>> | null | undefined;
  onCards: () => void;
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
}) {
  const history = period === 'd7' ? intelligence?.history.points.slice(-8) || [] : intelligence?.history.points || [];
  const movement = intelligence?.periods[period];
  const sets = intelligence?.sets.slice(0, 3) || [];
  return <>
    <View style={styles.sectionHeading}>
      <View style={styles.flex}><Text style={styles.sectionEyebrow}>YOUR COLLECTION OVER TIME</Text><Text style={styles.sectionTitle}>Value movement</Text><Text style={styles.sectionCopy}>The same cards and quantities are compared at both dates, so new additions never masquerade as gains.</Text></View>
      <View style={styles.periodRail}><PeriodButton label="7D" selected={period === 'd7'} onPress={() => setPeriod('d7')} /><PeriodButton label="30D" selected={period === 'd30'} onPress={() => setPeriod('d30')} /></View>
    </View>

    <View style={styles.chartCard}>
      <View style={styles.chartTop}>
        <View><Text style={styles.chartLabel}>COMPARABLE KNOWN VALUE</Text><Text style={styles.chartValue}>{money(movement?.currentValue, currency)}</Text></View>
        <View style={styles.chartMovement}><Ionicons name={Number(movement?.movementPercent) < 0 ? 'trending-down-outline' : 'trending-up-outline'} size={16} color={Number(movement?.movementPercent) < 0 ? FateDropColors.vanished : FateDropColors.manifested} /><Text style={[styles.chartMovementText, { color: Number(movement?.movementPercent) < 0 ? FateDropColors.vanished : FateDropColors.manifested }]}>{movement?.status === 'available' ? percent(movement.movementPercent) : 'BUILDING'}</Text></View>
      </View>
      <PortfolioChart points={history} />
      <Text style={styles.chartFoot}>{intelligence?.history.status === 'available' ? `${intelligence.history.currentValueCoveragePercent.toFixed(1)}% of today’s known value represented in chart history` : 'Stored market-day history is still building'}</Text>
    </View>

    <View style={styles.sectionHeadingSolo}><Text style={styles.sectionEyebrow}>WHERE YOUR VALUE LIVES</Text><Text style={styles.sectionTitle}>Set allocation</Text></View>
    <View style={styles.allocationCard}>
      {sets.length ? sets.map((set, index) => <View key={set.setId || `${set.setName}:${index}`} style={styles.allocationRow}>
        <View style={[styles.setBadge, { borderColor: index === 0 ? FateDropColors.goldBright : 'rgba(124,110,255,.55)' }]}><Text style={styles.setBadgeText}>{index + 1}</Text></View>
        <View style={styles.allocationBody}><View style={styles.allocationTop}><Text style={styles.allocationName} numberOfLines={1}>{set.setName || 'Verified set'}</Text><Text style={styles.allocationMoney}>{money(set.currentKnownValue, currency)}</Text></View><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, set.collectionSharePercent))}%` }]} /></View><Text style={styles.allocationMeta}>{set.collectionSharePercent.toFixed(1)}% of collection · {set.totalCopies} {set.totalCopies === 1 ? 'copy' : 'copies'}</Text></View>
      </View>) : <StateLine text="Your set allocation appears as exact owned cards receive FatePrice evidence." />}
    </View>

    <View style={[styles.insightRow, compact && styles.insightStack]}>
      <InsightCard icon="diamond-outline" label="TOP 5 UNIQUE CARDS" value={intelligence ? `${intelligence.snapshot.topFiveSharePercent.toFixed(1)}%` : '—'} copy="of known raw value" accent={FateDropColors.goldBright} />
      <InsightCard icon="shield-checkmark-outline" label="DATA HEALTH" value={intelligence ? `${intelligence.snapshot.priceCoveragePercent.toFixed(1)}%` : '—'} copy={intelligence?.snapshot.unpricedCopies ? `${intelligence.snapshot.unpricedCopies} unpriced ${intelligence.snapshot.unpricedCopies === 1 ? 'copy' : 'copies'}` : 'exact prices connected'} accent={FateDropColors.manifested} />
    </View>
    <Pressable accessibilityRole="button" onPress={onCards} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Ionicons name="layers-outline" size={18} color={FateDropColors.background} /><Text style={styles.primaryActionText}>VIEW ALL OWNED CARDS</Text><Ionicons name="chevron-forward" size={17} color={FateDropColors.background} /></Pressable>
  </>;
}

function InventoryHeader({ count, filter, period, query, setFilter, setPeriod, setQuery, view }: {
  count: number; filter: FilterKey; period: PeriodKey; query: string; setFilter: (filter: FilterKey) => void; setPeriod: (period: PeriodKey) => void; setQuery: (query: string) => void; view: Exclude<ViewKey, 'overview'>;
}) {
  return <>
    <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color={FateDropColors.secondary} /><TextInput accessibilityLabel={`Search owned ${view}`} value={query} onChangeText={setQuery} placeholder={`Search owned ${view}…`} placeholderTextColor={FateDropColors.muted} style={styles.searchInput} autoCorrect={false} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
      <FilterChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} /><FilterChip label="Pokémon" selected={filter === 'pokemon'} onPress={() => setFilter('pokemon')} /><FilterChip label="One Piece" selected={filter === 'one-piece'} onPress={() => setFilter('one-piece')} />
      {view === 'sets' ? <><FilterChip label="7D" selected={period === 'd7'} onPress={() => setPeriod('d7')} /><FilterChip label="30D" selected={period === 'd30'} onPress={() => setPeriod('d30')} /></> : null}
    </ScrollView>
    {view === 'cards' ? <Pressable accessibilityRole="button" onPress={() => router.push('/fate-price')} style={({ pressed }) => [styles.fatePriceAction, pressed && styles.pressed]}><Ionicons name="pricetag-outline" size={18} color={FateDropColors.goldBright} /><Text style={styles.fatePriceActionText}>Add an exact card from FatePrice</Text><Ionicons name="chevron-forward" size={16} color={FateDropColors.ivory} /></Pressable> : null}
    <View style={styles.listHead}><Text style={styles.listCount}>{count} {view === 'cards' ? 'UNIQUE OWNED CARDS' : 'SETS REPRESENTED'}</Text><Text style={styles.listSort}>{view === 'cards' ? 'Value high → low' : 'Collection share'}</Text></View>
  </>;
}

function PortfolioChart({ points }: { points: { marketDay: string; knownValue: number }[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(220, Math.min(840, width - 76));
  const chartHeight = 118;
  if (points.length < 2) return <View style={[styles.chartEmpty, { height: chartHeight }]}><Ionicons name="pulse-outline" size={25} color={FateDropColors.muted} /><Text style={styles.chartEmptyText}>Two stored market days are needed for a truthful line.</Text></View>;
  const values = points.map((point) => point.knownValue);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);
  const coordinates = points.map((point, index) => ({ x: (index / Math.max(1, points.length - 1)) * chartWidth, y: 8 + ((maximum - point.knownValue) / range) * (chartHeight - 20) }));
  return <View style={[styles.chartPlot, { width: chartWidth, height: chartHeight }]}>
    {[0, 1, 2].map((line) => <View key={line} style={[styles.chartGrid, { top: 10 + line * 45 }]} />)}
    {coordinates.slice(0, -1).map((point, index) => { const next = coordinates[index + 1]; const dx = next.x - point.x; const dy = next.y - point.y; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI; return <View key={`line:${index}`} style={[styles.chartLine, { width: length, left: point.x + dx / 2 - length / 2, top: point.y + dy / 2 - 1, transform: [{ rotate: `${angle}deg` }] }]} />; })}
    {coordinates.map((point, index) => <View key={`dot:${index}`} style={[styles.chartDot, { left: point.x - 3, top: point.y - 3 }]} />)}
  </View>;
}

function HeroMetric({ accent, label, value }: { accent?: string; label: string; value: string }) { return <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.heroMetricValue, accent ? { color: accent } : null]}>{value}</Text></View>; }
function ScopeButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.scopeButton, selected && styles.scopeButtonActive]}><Text style={[styles.scopeText, selected && styles.scopeTextActive]}>{label}</Text>{selected ? <View style={styles.scopeGem} /> : null}</Pressable>; }
function PeriodButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.periodButton, selected && styles.periodButtonActive]}><Text style={[styles.periodText, selected && styles.periodTextActive]}>{label}</Text></Pressable>; }
function FilterChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text></Pressable>; }
function InsightCard({ accent, copy, icon, label, value }: { accent: string; copy: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={styles.insightCard}><View style={[styles.insightIcon, { borderColor: `${accent}88` }]}><Ionicons name={icon} size={20} color={accent} /></View><Text style={styles.insightLabel}>{label}</Text><Text style={styles.insightValue}>{value}</Text><Text style={styles.insightCopy}>{copy}</Text></View>; }

function openFatePrice(card: { cardIdentityId: string; name: string | null; collectorNumber: string | null; setId: string | null; setName: string | null; tcgCode: string | null }) {
  router.push({ pathname: '/fate-price', params: { cardId: card.cardIdentityId, name: card.name || undefined, collectorNumber: card.collectorNumber || undefined, setId: card.setId || undefined, setName: card.setName || undefined, tcg: card.tcgCode || undefined } });
}

function QuantityControl({ cardIdentityId, items, quantity, onChanged }: { cardIdentityId: string; items: FateCollectorItem[]; quantity: number; onChanged: () => void | Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const increase = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const target = items.find((item) => item.quantity < 999);
      if (target) await updateFateCollectorItemQuantity(target.id, target.quantity + 1, target.revision);
      else await addExactCardToCollector(cardIdentityId, { quantity: 1 });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Quantity could not be updated.');
    } finally { setSaving(false); }
  };
  return <View style={styles.quantityWrap}><View style={styles.quantityControl}><Text style={styles.quantityText}>Qty {quantity}</Text><Pressable accessibilityRole="button" accessibilityLabel="Increase owned quantity" disabled={saving} onPress={(event) => { event.stopPropagation(); void increase(); }} style={({ pressed }) => [styles.quantityAdd, pressed && styles.pressed]}>{saving ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name="add" size={15} color={FateDropColors.background} />}</Pressable></View>{error ? <Text accessibilityLiveRegion="polite" numberOfLines={2} style={styles.quantityError}>{error}</Text> : null}</View>;
}

function IntelligenceCardRow({ card, currency, items, onChanged }: { card: FateCollectorIntelligenceCard; currency: string; items: FateCollectorItem[]; onChanged: () => void | Promise<void> }) {
  const art = card.thumbnailUrl || card.imageUrl;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${card.name || 'owned card'}`} onPress={() => openFatePrice(card)} style={({ pressed }) => [styles.cardRow, pressed && styles.pressed]}>
    {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <CardPlaceholder />}
    <View style={styles.cardText}><Text style={styles.cardName} numberOfLines={1}>{card.name || 'Verified card'}</Text><Text style={styles.cardSet} numberOfLines={1}>{card.setName || 'Verified set'}</Text><Text style={styles.cardMeta}>#{card.collectorNumber || '—'} · {card.rarity || card.variantCode || 'exact printing'}</Text></View>
    <View style={styles.cardRight}><Text style={styles.cardPrice}>{money(card.currentKnownValue, currency)}</Text>{card.quantity > 1 && card.currentUnitPrice != null ? <Text style={styles.eachPrice}>{money(card.currentUnitPrice, currency)} each</Text> : null}<QuantityControl cardIdentityId={card.cardIdentityId} items={items} quantity={card.quantity} onChanged={onChanged} /></View>
    <Ionicons name="chevron-forward" size={14} color={FateDropColors.ivory} />
  </Pressable>;
}

function LegacyCardRow({ item, items, refreshKey, onChanged }: { item: FateCollectorItem; items: FateCollectorItem[]; refreshKey: unknown; onChanged: () => void | Promise<void> }) {
  const price = useCollectionCardPrice(item.fateCardId, refreshKey);
  const card = item.card;
  const art = card?.thumbnailUrl || card?.imageUrl;
  return <Pressable accessibilityRole="button" onPress={() => openFatePrice({ cardIdentityId: item.fateCardId, name: card?.name || null, collectorNumber: card?.collectorNumber || null, setId: card?.setId || null, setName: card?.setName || null, tcgCode: card?.tcgCode || null })} style={({ pressed }) => [styles.cardRow, pressed && styles.pressed]}>
    {art ? <Image source={{ uri: art }} style={styles.cardArt} contentFit="contain" cachePolicy="memory-disk" /> : <CardPlaceholder />}
    <View style={styles.cardText}><Text style={styles.cardName} numberOfLines={1}>{card?.name || 'Verified card'}</Text><Text style={styles.cardSet} numberOfLines={1}>{card?.setName || 'Verified set'}</Text><Text style={styles.cardMeta}>#{card?.collectorNumber || '—'} · {card?.rarity || card?.variantCode || 'exact printing'}</Text></View>
    <View style={styles.cardRight}><Text style={styles.cardPrice}>{price ? money(price.amount * items.reduce((sum, owned) => sum + owned.quantity, 0), price.currencyCode) : 'FatePrice'}</Text><QuantityControl cardIdentityId={item.fateCardId} items={items} quantity={items.reduce((sum, owned) => sum + owned.quantity, 0)} onChanged={onChanged} /></View><Ionicons name="chevron-forward" size={14} color={FateDropColors.ivory} />
  </Pressable>;
}

function CardPlaceholder() { return <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={18} color={FateDropColors.echo} /></View>; }

function OwnedSetRow({ currency, period, set }: { currency: string; period: PeriodKey; set: FateCollectorIntelligenceSet }) {
  const movement = set[period];
  const movementColor = Number(movement.movementPercent) < 0 ? FateDropColors.vanished : FateDropColors.manifested;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${set.setName || 'set'} binder`} disabled={!set.setId} onPress={() => set.setId && router.push({ pathname: '/binder/[setId]', params: { setId: set.setId, setName: set.setName || undefined } })} style={({ pressed }) => [styles.setRow, pressed && styles.pressed]}>
    <View style={styles.setIcon}><Ionicons name="albums-outline" size={24} color={FateDropColors.goldBright} /></View>
    <View style={styles.setBody}><Text style={styles.setName} numberOfLines={1}>{set.setName || 'Verified set'}</Text><Text style={styles.setMeta}>{set.uniqueCards} unique cards · {set.totalCopies} copies · {set.collectionSharePercent.toFixed(1)}% share</Text><View style={styles.setBar}><View style={[styles.setBarFill, { width: `${Math.max(2, Math.min(100, set.collectionSharePercent))}%` }]} /></View></View>
    <View style={styles.setValue}><Text style={styles.setMoney}>{money(set.currentKnownValue, currency)}</Text><Text style={[styles.setMovement, { color: movementColor }]}>{movement.status === 'available' ? percent(movement.movementPercent) : 'BUILDING'}</Text></View><Ionicons name="chevron-forward" size={14} color={FateDropColors.ivory} />
  </Pressable>;
}

function StateLine({ danger = false, loading = false, text }: { danger?: boolean; loading?: boolean; text: string }) { return <View style={styles.stateLine}>{loading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Ionicons name={danger ? 'alert-circle-outline' : 'sparkles-outline'} size={20} color={danger ? FateDropColors.vanished : FateDropColors.muted} />}<Text style={styles.stateText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 140 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  back: { width: 42, height: 42, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,18,.62)' },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 34, lineHeight: 38, marginTop: 6, maxWidth: 355 },
  copy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 420 },
  valueCard: { minHeight: 180, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.62)', borderRadius: 18, backgroundColor: 'rgba(4,8,21,.72)', paddingHorizontal: 8, paddingVertical: 15 },
  valueOrbitA: { position: 'absolute', width: 325, height: 145, borderRadius: 165, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.30)' },
  valueOrbitB: { position: 'absolute', width: 240, height: 112, borderRadius: 120, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.38)' },
  valueLabel: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.35 },
  valueMain: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 44, lineHeight: 51, marginTop: 3, maxWidth: '92%' },
  valueMetrics: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  valueDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: 'rgba(226,197,141,.32)' },
  heroMetric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 3 },
  heroMetricLabel: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: .65, textAlign: 'center' },
  heroMetricValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15, lineHeight: 20, marginTop: 2, maxWidth: '100%' },
  scopeRail: { flexDirection: 'row', minHeight: 54, marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', backgroundColor: 'rgba(3,7,18,.68)' },
  scopeButton: { flex: 1, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  scopeButtonActive: { backgroundColor: 'rgba(124,110,255,.13)' },
  scopeText: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 14 },
  scopeTextActive: { color: FateDropColors.ivory },
  scopeGem: { position: 'absolute', bottom: -4, width: 8, height: 8, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 20, marginBottom: 11 },
  sectionHeadingSolo: { marginTop: 20, marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 25, lineHeight: 29, marginTop: 3 },
  sectionCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  periodRail: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', borderRadius: 20, overflow: 'hidden' },
  periodButton: { minWidth: 42, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  periodButtonActive: { backgroundColor: 'rgba(226,197,141,.13)' },
  periodText: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '900' },
  periodTextActive: { color: FateDropColors.ivory },
  chartCard: { padding: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 16, backgroundColor: 'rgba(4,8,21,.76)' },
  chartTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  chartLabel: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  chartValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 24, marginTop: 2 },
  chartMovement: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(124,110,255,.10)' },
  chartMovementText: { fontSize: 10, fontWeight: '900' },
  chartPlot: { alignSelf: 'center', marginTop: 8, overflow: 'hidden' },
  chartGrid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.12)' },
  chartLine: { position: 'absolute', height: 2, borderRadius: 2, backgroundColor: FateDropColors.goldBright },
  chartDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.ivory, borderWidth: 1, borderColor: FateDropColors.manifested },
  chartEmpty: { alignItems: 'center', justifyContent: 'center', gap: 7 },
  chartEmptyText: { color: FateDropColors.secondary, fontSize: 11, textAlign: 'center' },
  chartFoot: { color: FateDropColors.muted, fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 4 },
  allocationCard: { paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.36)', borderRadius: 16, backgroundColor: 'rgba(4,8,21,.75)' },
  allocationRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.06)' },
  setBadge: { width: 35, height: 44, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(124,110,255,.10)' },
  setBadgeText: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16 },
  allocationBody: { flex: 1, minWidth: 0 },
  allocationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  allocationName: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  allocationMoney: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  allocationMeta: { color: FateDropColors.secondary, fontSize: 9, marginTop: 5 },
  barTrack: { height: 4, overflow: 'hidden', borderRadius: 3, marginTop: 7, backgroundColor: 'rgba(255,255,255,.08)' },
  barFill: { height: 4, borderRadius: 3, backgroundColor: FateDropColors.manifested },
  insightRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  insightStack: { flexDirection: 'column' },
  insightCard: { flex: 1, minHeight: 136, alignItems: 'center', justifyContent: 'center', padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 15, backgroundColor: 'rgba(4,8,21,.76)' },
  insightIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 19 },
  insightLabel: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  insightValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 25, marginTop: 2 },
  insightCopy: { color: FateDropColors.secondary, fontSize: 10, marginTop: 2, textAlign: 'center' },
  primaryAction: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 13, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  primaryActionText: { color: FateDropColors.background, fontSize: 11, fontWeight: '900', letterSpacing: .9 },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.72)' },
  searchInput: { flex: 1, color: FateDropColors.ivory, fontSize: 13 },
  filterRail: { gap: 8, paddingTop: 11, paddingBottom: 5 },
  filterChip: { height: 38, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', borderRadius: 20, backgroundColor: 'rgba(4,8,21,.58)' },
  filterChipActive: { borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(226,197,141,.09)' },
  filterChipText: { color: FateDropColors.secondary, fontSize: 11 },
  filterChipTextActive: { color: FateDropColors.ivory },
  fatePriceAction: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, marginTop: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.58)', borderRadius: 13, backgroundColor: 'rgba(4,8,21,.75)' },
  fatePriceActionText: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 18, marginBottom: 9 },
  listCount: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: .9 },
  listSort: { color: FateDropColors.secondary, fontSize: 10 },
  cardRow: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8, marginBottom: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 13, backgroundColor: 'rgba(4,8,21,.76)' },
  cardArt: { width: 46, height: 64, borderRadius: 5, backgroundColor: 'rgba(124,110,255,.10)' },
  cardArtPlaceholder: { width: 46, height: 64, borderRadius: 5, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', backgroundColor: 'rgba(124,110,255,.08)' },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14 },
  cardSet: { color: FateDropColors.secondary, fontSize: 10, marginTop: 2 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 9, marginTop: 2 },
  cardRight: { minWidth: 72, alignItems: 'flex-end' },
  cardPrice: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  eachPrice: { color: FateDropColors.secondary, fontSize: 8, marginTop: 1 },
  quantityControl: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, paddingLeft: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 14, overflow: 'hidden' },
  quantityWrap: { alignItems: 'flex-end' },
  quantityText: { color: FateDropColors.secondary, fontSize: 9 },
  quantityAdd: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright },
  quantityError: { maxWidth: 92, color: FateDropColors.vanished, fontSize: 7, lineHeight: 9, marginTop: 2, textAlign: 'right' },
  setRow: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, marginBottom: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 14, backgroundColor: 'rgba(4,8,21,.76)' },
  setIcon: { width: 45, height: 55, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.48)', borderRadius: 8, backgroundColor: 'rgba(124,110,255,.09)' },
  setBody: { flex: 1, minWidth: 0 },
  setName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14 },
  setMeta: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  setBar: { height: 3, overflow: 'hidden', borderRadius: 2, marginTop: 7, backgroundColor: 'rgba(255,255,255,.08)' },
  setBarFill: { height: 3, backgroundColor: FateDropColors.manifested },
  setValue: { minWidth: 64, alignItems: 'flex-end' },
  setMoney: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12 },
  setMovement: { fontSize: 9, fontWeight: '900', marginTop: 4 },
  stateLine: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  stateText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  truth: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 15, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)' },
  truthText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: .72 },
});
