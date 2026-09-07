import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateJourneyRail, FateMetricStrip, FateSectionHeading } from '@/components/fate-polish-ui';
import { AbstractHero, EmptyWatchlistState, FateDropBackground, FateDropHeader, ProductCard, StatusBadge } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { retailers } from '@/constants/retailers';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { loadWatchlist, toggleWatchlist } from '@/lib/watchlist';
import { adaptLegacyOffer } from '@/services/catalogue';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { LocalWishlistRepository, migrateLegacyWatchlist } from '@/services/wishlist';
import type { ProductOffer, WishlistItem } from '@/types/domain';
import type { LegacyCatalogueProduct } from '@/types/legacy';
import type { TruePriceGroup, TruePriceResponse } from '@/types/true-price';

type WishlistRow =
  | { kind: 'offer'; item: WishlistItem; offer: ProductOffer }
  | { kind: 'product'; item: WishlistItem; group?: TruePriceGroup };

const repository = new LocalWishlistRepository();

function timeAgo(value?: string) {
  if (!value) return 'evidence time unknown';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'evidence time unknown';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 2) return 'checked just now';
  if (minutes < 60) return `checked ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `checked ${hours}h ago`;
  return `checked ${Math.round(hours / 24)}d ago`;
}

export default function WatchlistScreenV2() {
  const { snapshot, signedIn } = useFateDropId();
  const [rows, setRows] = useState<WishlistRow[]>([]);
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const activeFinds = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const matches = snapshot?.fateMatches?.length ?? 0;
  const alerting = rows.filter((row) => row.item.alertsEnabled).length;

  const load = useCallback(() => {
    setLoading(true);
    void loadWatchlist().then(async (keys) => {
      setLegacyKeys(keys);
      const items = await migrateLegacyWatchlist(keys);
      const offerItems = items.filter((item) => item.targetType === 'OFFER');
      const productItems = items.filter((item) => item.targetType === 'PRODUCT');

      let offerRows: WishlistRow[] = [];
      if (offerItems.length) {
        const response = await fetch(`${API_BASE_URL}/api/catalogue/offers`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: offerItems.map((item) => item.targetId) }),
        });
        const data = await response.json();
        const offers = (data.products || []).map((product: LegacyCatalogueProduct) => adaptLegacyOffer(product)) as ProductOffer[];
        offerRows = offerItems.flatMap((item) => {
          const offer = offers.find((value) => value.id === item.targetId);
          return offer ? [{ kind: 'offer' as const, item, offer }] : [];
        });
      }

      const productRows = await Promise.all(productItems.map(async (item) => {
        let group: TruePriceGroup | undefined;
        if (item.label) {
          try {
            const response = await fetch(`${API_BASE_URL}/api/true-price?q=${encodeURIComponent(item.label)}`);
            const data = await response.json() as TruePriceResponse;
            group = data.groups.find((value) => value.id === item.targetId);
          } catch { /* Saved state survives live evidence gaps. */ }
        }
        return { kind: 'product' as const, item, group };
      }));

      setRows([...productRows, ...offerRows]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const remove = async (row: WishlistRow) => {
    if (row.kind === 'offer') {
      const next = await toggleWatchlist(row.offer.id, legacyKeys);
      setLegacyKeys(next);
    }
    await repository.remove(row.item.id);
    setRows((current) => current.filter((value) => value.item.id !== row.item.id));
  };

  const toggleAlerts = async (row: WishlistRow) => {
    const updated = { ...row.item, alertsEnabled: !row.item.alertsEnabled };
    await repository.save(updated);
    setRows((current) => current.map((value) => value.item.id === updated.id ? { ...value, item: updated } as WishlistRow : value));
  };

  const header = <>
    <FateDropHeader title="Wishlist" subtitle="SAVE · WATCH · HUNT" rightAction={rows.length ? <StatusBadge label={`${rows.length} saved`} color={FateDropColors.violetLight} /> : null} />
    <AbstractHero eyebrow="Universal wishlist" title="Save it first. Decide how hard FateDrop should hunt later." subtitle="Wishlist remembers products. Product alerts watch broad changes. FateFind applies your price and stock rules. A FateMatch appears only when a hunt genuinely qualifies." icon="bookmark" />

    <FateJourneyRail steps={[
      { label: 'SAVED', detail: `${rows.length} remembered`, icon: 'bookmark-outline', state: rows.length ? 'done' : 'active' },
      { label: 'WATCHING', detail: `${alerting} alerts on`, icon: 'notifications-outline', state: alerting ? 'done' : rows.length ? 'active' : 'idle' },
      { label: 'FATEFIND', detail: `${activeFinds} searching`, icon: 'telescope-outline', state: activeFinds ? 'done' : rows.length ? 'active' : 'idle' },
      { label: 'MATCHED', detail: `${matches} found`, icon: 'sparkles-outline', state: matches ? 'done' : activeFinds ? 'active' : 'idle' },
    ]} />

    <FateMetricStrip items={[
      { icon: 'bookmark-outline', value: String(rows.length), label: 'SAVED', color: FateDropColors.violetLight },
      { icon: 'notifications-outline', value: String(alerting), label: 'ALERTING', color: FateDropColors.cyan },
      { icon: 'telescope-outline', value: String(activeFinds), label: 'ACTIVE FINDS', color: FateDropColors.goldBright },
      { icon: 'sparkles-outline', value: String(matches), label: 'FATEMATCHES', color: FateDropColors.manifested },
    ]} />

    <FateSectionHeading eyebrow="SAVED PRODUCTS" title="Your watch board" copy="Availability and retailer evidence are live where known. A Wishlist item never invents a target price — price rules belong to FateFind." action="FATEMATCH" onAction={() => router.push('/fate-match')} />
  </>;

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading
          ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Reading your saved products and current evidence…</Text></View>
          : <EmptyWatchlistState title="Bookmark your first product" subtitle="Save a product from Search or FateFind. Sold-out products remain saved." />}
        renderItem={({ item }) => item.kind === 'offer'
          ? <OfferRow row={item} onRemove={() => void remove(item)} onToggleAlerts={() => void toggleAlerts(item)} />
          : <ProductRow row={item} onRemove={() => void remove(item)} onToggleAlerts={() => void toggleAlerts(item)} />}
      />
    </SafeAreaView>
  );
}

function StateRibbon({ alerting, retailerCount, available, lastChecked }: { alerting: boolean; retailerCount: number; available: boolean; lastChecked?: string }) {
  return <View style={styles.stateRibbon}>
    <View style={styles.ribbonItem}><View style={[styles.stateDot, { backgroundColor: available ? FateDropColors.manifested : FateDropColors.vanished }]} /><Text style={styles.ribbonText}>{available ? 'AVAILABLE' : 'NOT LIVE'}</Text></View>
    <View style={styles.ribbonDivider} /><View style={styles.ribbonItem}><Ionicons name="storefront-outline" size={12} color={FateDropColors.cyan} /><Text style={styles.ribbonText}>{retailerCount} RETAILER{retailerCount === 1 ? '' : 'S'}</Text></View>
    <View style={styles.ribbonDivider} /><View style={styles.ribbonItem}><Ionicons name={alerting ? 'notifications' : 'notifications-off-outline'} size={12} color={alerting ? FateDropColors.goldBright : FateDropColors.muted} /><Text style={styles.ribbonText}>{alerting ? 'WATCHING' : 'SAVED ONLY'}</Text></View>
    <Text style={styles.checkedText}>{timeAgo(lastChecked)}</Text>
  </View>;
}

function OfferRow({ row, onRemove, onToggleAlerts }: { row: Extract<WishlistRow, { kind: 'offer' }>; onRemove: () => void; onToggleAlerts: () => void }) {
  const { offer } = row;
  const retailer = retailers.find((value) => value.id === offer.retailerId);
  const available = offer.stockStatus === 'IN_STOCK';
  return <View style={styles.savedShell}>
    <StateRibbon alerting={row.item.alertsEnabled} retailerCount={1} available={available} lastChecked={offer.lastCheckedAt} />
    <ProductCard
      title={offer.title} retailer={retailer?.name || offer.retailerId}
      price={offer.priceGbp === undefined ? 'Price unavailable' : `£${offer.priceGbp.toFixed(2)}`}
      stockLabel={available ? 'In stock' : 'Sold out · still saved'} stockTone={available ? 'mint' : 'red'}
      fateLabel={offer.pulseLabels?.[0]?.replaceAll('_', ' ')} fateTone={offer.pulseLabels?.includes('PRICE_DROPPED') ? 'mint' : 'violet'}
      imageSource={offer.imageUrl ? { uri: offer.imageUrl } : undefined}
      productUrl={available ? offer.productUrl : undefined}
      onOpenProduct={available && offer.productUrl ? () => void openTrackedRetailerLink({ destinationUrl: offer.productUrl!, retailerId: offer.retailerId, offerId: offer.id, placement: 'wishlist' }) : undefined}
      inWatchlist onToggleWatchlist={onRemove} alertLabel={row.item.alertsEnabled ? 'On' : 'Off'}
    />
    <WatchActions title={offer.title} alertsEnabled={row.item.alertsEnabled} onToggleAlerts={onToggleAlerts} />
  </View>;
}

function ProductRow({ row, onRemove, onToggleAlerts }: { row: Extract<WishlistRow, { kind: 'product' }>; onRemove: () => void; onToggleAlerts: () => void }) {
  const group = row.group;
  const liveOffers = group?.offers.filter((offer) => offer.stockStatus === 'IN_STOCK') || [];
  const best = [...liveOffers].sort((a, b) => (a.totalDeliveredGbp ?? a.priceGbp ?? Infinity) - (b.totalDeliveredGbp ?? b.priceGbp ?? Infinity))[0];
  const latestChecked = group?.offers.map((offer) => offer.lastCheckedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
  const title = row.item.label || row.item.targetId;

  return <View style={styles.universal}>
    <StateRibbon alerting={row.item.alertsEnabled} retailerCount={group?.retailerCount ?? 0} available={Boolean(liveOffers.length)} lastChecked={latestChecked} />
    <View style={styles.universalTop}>
      <View style={styles.flex}><Text style={styles.kind}>SAVED PRODUCT</Text><Text style={styles.title}>{title}</Text></View>
      <Pressable accessibilityLabel="Remove from Wishlist" onPress={onRemove} style={styles.delete}><Ionicons name="trash-outline" size={17} color={FateDropColors.coral} /></Pressable>
    </View>

    <View style={styles.evidenceBand}>
      <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>CURRENT COVERAGE</Text><Text style={styles.evidenceValue}>{group ? `${group.retailerCount} retailer${group.retailerCount === 1 ? '' : 's'}` : 'Evidence unavailable'}</Text></View>
      <View style={styles.evidenceDivider} />
      <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>BEST KNOWN NOW</Text><Text style={[styles.evidenceValue, best && { color: FateDropColors.manifested }]}>{best ? (best.totalDeliveredGbp !== undefined ? `£${best.totalDeliveredGbp.toFixed(2)} delivered` : best.priceGbp !== undefined ? `£${best.priceGbp.toFixed(2)} item` : 'Price unknown') : 'No live offer'}</Text></View>
    </View>

    {best ? <Text style={styles.best}>Best current evidence: {best.retailerName}{best.deliveryKnown ? ' · delivery verified' : ' · delivery pending'}.</Text> : <Text style={styles.muted}>Saved safely. FateDrop does not turn missing live evidence into a fake price or availability claim.</Text>}

    <View style={styles.ruleNote}><Ionicons name="options-outline" size={14} color={FateDropColors.goldBright} /><View style={styles.flex}><Text style={styles.ruleTitle}>No target price lives on Wishlist.</Text><Text style={styles.ruleCopy}>Set a maximum item price, True Price or RRP tolerance in FateFind when you want an active hunt.</Text></View></View>
    <WatchActions title={title} alertsEnabled={row.item.alertsEnabled} onToggleAlerts={onToggleAlerts} />
  </View>;
}

function WatchActions({ title, alertsEnabled, onToggleAlerts }: { title: string; alertsEnabled: boolean; onToggleAlerts: () => void }) {
  return <View style={styles.actions}>
    <Pressable onPress={onToggleAlerts} style={[styles.action, alertsEnabled && styles.actionActive]}><Ionicons name={alertsEnabled ? 'notifications' : 'notifications-outline'} size={14} color={alertsEnabled ? FateDropColors.manifested : FateDropColors.secondary} /><Text style={styles.actionText}>{alertsEnabled ? 'PRODUCT ALERTS ON' : 'TURN PRODUCT ALERTS ON'}</Text></Pressable>
    <Pressable onPress={() => router.push({ pathname: '/fate-match', params: { query: title } })} style={[styles.action, styles.huntAction]}><Ionicons name="telescope-outline" size={14} color={FateDropColors.goldBright} /><Text style={styles.huntText}>SET FATEFIND RULES</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 120 }, flex: { flex: 1 }, loading: { alignItems: 'center', gap: 9, margin: 35 }, loadingText: { color: FateDropColors.secondary, fontSize: 10 },
  savedShell: { borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(8,13,21,.82)', overflow: 'hidden', padding: 7 },
  stateRibbon: { minHeight: 35, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, paddingHorizontal: 9, paddingBottom: 7 }, ribbonItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, stateDot: { width: 6, height: 6, borderRadius: 3 }, ribbonText: { color: FateDropColors.secondary, fontSize: 6.8, fontWeight: '900', letterSpacing: .55 }, ribbonDivider: { width: 1, height: 12, backgroundColor: FateDropColors.border }, checkedText: { marginLeft: 'auto', color: FateDropColors.muted, fontSize: 7.2 },
  universal: { padding: 15, borderRadius: 20, backgroundColor: 'rgba(9,14,22,.90)', borderWidth: 1, borderColor: FateDropColors.border }, universalTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, kind: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, lineHeight: 21, marginTop: 5 }, delete: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.coral}30`, backgroundColor: `${FateDropColors.coral}0A` },
  evidenceBand: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FateDropColors.border }, evidenceCell: { flex: 1 }, evidenceDivider: { width: 1, height: 34, backgroundColor: FateDropColors.border, marginHorizontal: 13 }, evidenceLabel: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .6 }, evidenceValue: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900', marginTop: 4 }, best: { color: FateDropColors.manifested, fontSize: 10, fontWeight: '800', marginTop: 10 }, muted: { color: FateDropColors.muted, fontSize: 9.5, lineHeight: 14, marginTop: 10 },
  ruleNote: { flexDirection: 'row', gap: 8, marginTop: 11, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.goldBright}24`, backgroundColor: `${FateDropColors.goldBright}08` }, ruleTitle: { color: FateDropColors.ivory, fontSize: 9.5, fontWeight: '900' }, ruleCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 10 }, action: { flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.card }, actionActive: { borderColor: `${FateDropColors.manifested}40`, backgroundColor: `${FateDropColors.manifested}09` }, huntAction: { borderColor: `${FateDropColors.goldBright}38`, backgroundColor: `${FateDropColors.goldBright}09` }, actionText: { color: FateDropColors.secondary, fontSize: 6.8, fontWeight: '900', letterSpacing: .3, textAlign: 'center' }, huntText: { color: FateDropColors.goldBright, fontSize: 6.8, fontWeight: '900', letterSpacing: .3 },
});
