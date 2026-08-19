import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, EmptyWatchlistState, FateDropBackground, FateDropHeader, ProductCard, StatusBadge } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { retailers } from '@/constants/retailers';
import { FateDropColors } from '@/constants/theme';
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

export default function WatchlistScreen() {
  const [rows, setRows] = useState<WishlistRow[]>([]);
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void loadWatchlist().then(async (keys) => {
      setLegacyKeys(keys);
      const items = await migrateLegacyWatchlist(keys);
      // Product Spec v1: Wishlist is products/offers only. Older FateFind mirror
      // rows stay in storage for compatibility but are intentionally not shown.
      const offerItems = items.filter((item) => item.targetType === 'OFFER');
      const productItems = items.filter((item) => item.targetType === 'PRODUCT');

      let offerRows: WishlistRow[] = [];
      if (offerItems.length) {
        const response = await fetch(`${API_BASE_URL}/api/catalogue/offers`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids: offerItems.map((item) => item.targetId) }),
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
          } catch {
            // A saved product remains saved when current network data is unavailable.
          }
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
    <FateDropHeader title="Wishlist" rightAction={rows.length ? <StatusBadge label={`${rows.length} saved`} color={FateDropColors.violetLight} /> : null} />
    <AbstractHero
      eyebrow="Universal wishlist"
      title="I want this. Keep it saved."
      subtitle="Save products across retailers and stock states. Active price/stock hunting belongs to FateFind, not the Wishlist."
      icon="bookmark"
    />
  </>;

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading
          ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} />
          : <EmptyWatchlistState title="Bookmark your first product" subtitle="Save a product or retailer offer. Sold-out products remain saved." />}
        renderItem={({ item }) => item.kind === 'offer'
          ? <OfferRow row={item} onRemove={() => void remove(item)} onToggleAlerts={() => void toggleAlerts(item)} />
          : <ProductRow row={item} onRemove={() => void remove(item)} onToggleAlerts={() => void toggleAlerts(item)} />}
      />
    </SafeAreaView>
  );
}

function OfferRow({ row, onRemove, onToggleAlerts }: { row: Extract<WishlistRow, { kind: 'offer' }>; onRemove: () => void; onToggleAlerts: () => void }) {
  const { offer } = row;
  const retailer = retailers.find((value) => value.id === offer.retailerId);
  const available = offer.stockStatus === 'IN_STOCK';
  return (
    <View>
      <ProductCard
        title={offer.title}
        retailer={retailer?.name || offer.retailerId}
        price={offer.priceGbp === undefined ? 'Price unavailable' : `£${offer.priceGbp.toFixed(2)}`}
        stockLabel={available ? 'In stock' : 'Sold out · still saved'}
        stockTone={available ? 'mint' : 'red'}
        fateLabel={offer.pulseLabels?.[0]?.replaceAll('_', ' ')}
        fateTone={offer.pulseLabels?.includes('PRICE_DROPPED') ? 'mint' : 'violet'}
        imageSource={offer.imageUrl ? { uri: offer.imageUrl } : undefined}
        productUrl={available ? offer.productUrl : undefined}
        onOpenProduct={available && offer.productUrl ? () => void openTrackedRetailerLink({
          destinationUrl: offer.productUrl!,
          retailerId: offer.retailerId,
          offerId: offer.id,
          placement: 'wishlist',
        }) : undefined}
        inWatchlist
        onToggleWatchlist={onRemove}
        alertLabel={row.item.alertsEnabled ? 'On' : 'Off'}
      />
      <Pressable accessibilityLabel="Toggle alerts" onPress={onToggleAlerts} style={styles.alertControl}>
        <Ionicons name={row.item.alertsEnabled ? 'notifications' : 'notifications-off-outline'} size={15} color={row.item.alertsEnabled ? FateDropColors.mint : FateDropColors.muted} />
        <Text style={styles.alertText}>Product alerts {row.item.alertsEnabled ? 'on' : 'off'}</Text>
      </Pressable>
    </View>
  );
}

function ProductRow({ row, onRemove, onToggleAlerts }: { row: Extract<WishlistRow, { kind: 'product' }>; onRemove: () => void; onToggleAlerts: () => void }) {
  const group = row.group;
  const best = group?.offers
    .filter((offer) => offer.stockStatus === 'IN_STOCK')
    .sort((a, b) => (a.totalDeliveredGbp ?? a.priceGbp ?? Infinity) - (b.totalDeliveredGbp ?? b.priceGbp ?? Infinity))[0];

  return (
    <View style={styles.universal}>
      <View style={styles.universalTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kind}>Saved product</Text>
          <Text style={styles.title}>{row.item.label || row.item.targetId}</Text>
        </View>
        <Pressable onPress={onRemove}><Ionicons name="trash-outline" size={18} color={FateDropColors.coral} /></Pressable>
      </View>
      <Text style={styles.detail}>{group ? `${group.retailerCount} retailer${group.retailerCount === 1 ? '' : 's'} currently matched` : 'No current matching offers · still saved'}</Text>
      <Text style={styles.best}>{best ? `Best known current offer ${best.totalDeliveredGbp !== undefined ? `£${best.totalDeliveredGbp.toFixed(2)} delivered` : best.priceGbp !== undefined ? `£${best.priceGbp.toFixed(2)} + unknown delivery` : 'price unknown'} at ${best.retailerName}` : 'No known in-stock offer right now'}</Text>
      <Text style={styles.muted}>Want FateDrop to hunt under a price or delivery limit? Create a FateFind from Search or Alerts.</Text>
      <Pressable onPress={onToggleAlerts} style={styles.alertRow}>
        <Ionicons name={row.item.alertsEnabled ? 'notifications' : 'notifications-off-outline'} size={16} color={row.item.alertsEnabled ? FateDropColors.mint : FateDropColors.muted} />
        <Text style={styles.alertText}>Product alerts {row.item.alertsEnabled ? 'on' : 'off'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  state: { margin: 35 },
  alertControl: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, marginTop: -4 },
  alertText: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '800' },
  universal: { padding: 16, borderRadius: 19, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  universalTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  kind: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 5 },
  detail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 10 },
  best: { color: FateDropColors.mint, fontSize: 11, fontWeight: '800', marginTop: 7 },
  muted: { color: FateDropColors.muted, fontSize: 9, marginTop: 6, lineHeight: 14 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
});
