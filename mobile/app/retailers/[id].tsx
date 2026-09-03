import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { retailerHeroUri } from '@/constants/retailer-hero';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { fetchRetailerDirectory, fetchRetailerProfile, type NetworkRetailer } from '@/services/retailer-directory';
import type { ProductOffer } from '@/types/domain';

function classLabel(value: string) {
  if (value === 'national') return 'Major retailer';
  if (value === 'independent' || value === 'regional') return 'Independent & local';
  if (value === 'specialist') return 'TCG specialist';
  return String(value || 'retailer').replaceAll('_', ' ');
}

function tcgLabel(value: string) {
  const key = value.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
  if (key === 'pokemon') return 'Pokémon';
  if (key === 'one piece') return 'One Piece';
  if (['mtg', 'magic', 'magic the gathering'].includes(key)) return 'Magic';
  if (key === 'lorcana') return 'Lorcana';
  if (key === 'yu gi oh' || key === 'yugioh') return 'Yu-Gi-Oh!';
  return key.split(/\s+/).filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function presenceLabel(retailer: NetworkRetailer) {
  if (retailer.online && retailer.physicalStores === true) return 'Online + physical stores';
  if (retailer.physicalStores === true) return 'Physical stores';
  if (retailer.online && retailer.physicalStores === false) return 'Online retailer';
  if (retailer.online) return 'Online · physical status unknown';
  return 'Retail presence unknown';
}

function verificationLabel(retailer: NetworkRetailer) {
  return String(retailer.verification || '').toLowerCase() === 'verified'
    ? 'Verified retailer'
    : 'Verification not established';
}

function physicalDetail(retailer: NetworkRetailer) {
  if (retailer.physicalStores !== true) {
    return retailer.physicalStores === false
      ? 'No physical-store presence reported by FateDrop Cloud.'
      : 'Physical-store presence has not been established.';
  }
  if (retailer.physicalLocations && retailer.physicalLocations > 0) {
    return `${retailer.physicalLocations} physical location${retailer.physicalLocations === 1 ? '' : 's'} currently known to FateDrop. Branch stock remains unknown unless Local Radar has exact-branch evidence.`;
  }
  return 'Physical-store presence is known. Branch stock remains unknown unless Local Radar has exact-branch evidence.';
}

function monitoringLabel(retailer: NetworkRetailer) {
  if (!retailer.monitoring.configured) return 'No active monitor reported';
  if (retailer.monitoring.healthy && !retailer.monitoring.stale) return 'Monitor healthy';
  if (retailer.monitoring.stale) return 'Monitor stale';
  return 'Monitor needs attention';
}

function monitoringTone(retailer: NetworkRetailer) {
  return retailer.monitoring.healthy && !retailer.monitoring.stale ? FateDropColors.mint : FateDropColors.secondary;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return <View style={styles.infoRow}>
    <View style={styles.infoIcon}><Ionicons name={icon} size={20} color={FateDropColors.violetLight} /></View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
  </View>;
}

function CatalogueCard({ item, retailer }: { item: ProductOffer; retailer: NetworkRetailer }) {
  return <View style={styles.productCard}>
    <View style={styles.productImageFrame}>
      {item.imageUrl
        ? <Image source={{ uri: item.imageUrl }} style={styles.productImage} contentFit="contain" />
        : <View style={styles.productFallback}><Ionicons name="albums-outline" size={34} color={FateDropColors.violetLight} /></View>}
    </View>
    <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
    <Text style={styles.stockText}>In stock</Text>
    <View style={styles.productBottom}>
      <Text style={styles.productPrice}>{item.priceGbp === undefined ? 'Price unavailable' : `£${item.priceGbp.toFixed(2)}`}</Text>
      {item.productUrl ? <Pressable
        accessibilityLabel={`Open ${item.title} at ${retailer.name}`}
        onPress={() => void openTrackedRetailerLink({ destinationUrl: item.productUrl!, retailerId: retailer.id, offerId: item.id, placement: 'retailer-storefront' })}
        style={({ pressed }) => [styles.productOpen, pressed && styles.pressed]}
      ><Ionicons name="chevron-forward" size={19} color={FateDropColors.ivory} /></Pressable> : null}
    </View>
  </View>;
}

export default function RetailerStorefront() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [retailer, setRetailer] = useState<NetworkRetailer | null>(null);
  const [loadingRetailer, setLoadingRetailer] = useState(Boolean(id));
  const [retailerError, setRetailerError] = useState('');
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const cleanCatalogueQuery = catalogueQuery.trim();
  const catalogue = useCatalogue({ retailerId: id || undefined, query: cleanCatalogueQuery || undefined, inStockOnly: true, limit: 50 });

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoadingRetailer(false);
      setRetailerError('Retailer could not be found.');
      return;
    }

    void (async () => {
      setLoadingRetailer(true);
      setRetailerError('');
      try {
        let found: NetworkRetailer | null = null;
        try {
          found = (await fetchRetailerProfile(id)).retailer;
        } catch {
          const result = await fetchRetailerDirectory();
          found = result.retailers.find((item) => item.id === id) || null;
        }
        if (!cancelled) {
          setRetailer(found);
          setRetailerError(found ? '' : 'This retailer is not present in the current FateDrop retailer directory.');
        }
      } catch (cause) {
        if (!cancelled) {
          setRetailer(null);
          setRetailerError(cause instanceof Error ? cause.message : 'Retailer directory is unavailable.');
        }
      } finally {
        if (!cancelled) setLoadingRetailer(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  const strictOffers = useMemo(
    () => retailer ? catalogue.offers.filter((item) => item.stockStatus === 'IN_STOCK' && !item.preorder) : [],
    [catalogue.offers, retailer],
  );

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FateDropBackground />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back to retailers" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={25} color={FateDropColors.ivory} />
        </Pressable>
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Retailer</Text>
          <Text style={styles.pageSubtitle}>PREMIUM CARDS · REAL CONNECTIONS</Text>
        </View>
        <View style={styles.topSpacer} />
      </View>

      {loadingRetailer ? <View style={styles.loadingPanel}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Loading retailer storefront…</Text></View> : null}
      {retailerError ? <View style={styles.errorPanel}><Ionicons name="warning-outline" size={19} color={FateDropColors.amber} /><Text style={styles.errorText}>{retailerError}</Text></View> : null}

      {retailer ? <>
        <View style={styles.heroCard}>
          <Image source={{ uri: retailerHeroUri }} style={styles.heroImage} contentFit="cover" contentPosition="right center" />
          <View style={styles.heroShade} />
          <View style={styles.identityTile}>
            {retailer.logoUrl
              ? <Image source={{ uri: retailer.logoUrl }} style={styles.identityLogo} contentFit="contain" />
              : <Text style={styles.identityInitials}>{initials(retailer.name)}</Text>}
          </View>
          <View style={styles.heroIdentity}>
            <Text style={styles.retailerName} numberOfLines={2}>{retailer.name}</Text>
            <Text style={styles.retailerClass}>{classLabel(retailer.retailerClass).toUpperCase()}</Text>
            <View style={styles.heroStatusRow}><Ionicons name="storefront-outline" size={17} color={FateDropColors.ivory} /><Text style={styles.heroStatusText}>{presenceLabel(retailer)}</Text></View>
            <View style={styles.heroStatusRow}><Ionicons name="shield-checkmark-outline" size={17} color={FateDropColors.ivory} /><Text style={styles.heroStatusText}>{verificationLabel(retailer)}</Text></View>
          </View>
        </View>

        <View style={styles.actions}>
          {retailer.websiteUrl ? <Pressable
            onPress={() => void openTrackedRetailerLink({ destinationUrl: retailer.websiteUrl!, retailerId: retailer.id, placement: 'retailer-storefront-profile' })}
            style={({ pressed }) => [styles.visitButton, pressed && styles.pressed]}
          ><Ionicons name="open-outline" size={20} color={FateDropColors.ivory} /><Text style={styles.actionText}>Visit retailer</Text></Pressable> : null}
          {retailer.physicalStores === true ? <Pressable
            onPress={() => router.push({ pathname: '/local-radar', params: { retailerId: retailer.id, retailerName: retailer.name } })}
            style={({ pressed }) => [styles.findButton, pressed && styles.pressed]}
          ><Ionicons name="location-outline" size={21} color={FateDropColors.ivory} /><Text style={styles.actionText}>Find stores</Text></Pressable> : null}
        </View>

        {retailer.description ? <Text style={styles.description}>{retailer.description}</Text> : null}

        <View style={styles.infoPanel}>
          <InfoRow icon="pricetag-outline" label="Retailer type" value={classLabel(retailer.retailerClass)} />
          <InfoRow icon="albums-outline" label="Trading card games" value={retailer.tcgs.length ? retailer.tcgs.map(tcgLabel).join(' · ') : 'Not supplied by FateDrop Cloud'} />
          <InfoRow icon="location-outline" label="Physical presence" value={physicalDetail(retailer)} />
          <InfoRow icon="pulse-outline" label="Monitoring" value={monitoringLabel(retailer)} valueColor={monitoringTone(retailer)} />
        </View>

        {retailer.locations?.length ? <View style={styles.locationsPanel}>
          <View style={styles.locationsHead}>
            <View>
              <Text style={styles.locationsEyebrow}>PHYSICAL LOCATIONS</Text>
              <Text style={styles.locationsTitle}>Known stores</Text>
            </View>
            <Text style={styles.locationsCount}>{retailer.locations.length}</Text>
          </View>
          {retailer.locations.map((location) => <View key={location.id} style={styles.locationRow}>
            <View style={styles.locationPin}><Ionicons name="location-outline" size={18} color={FateDropColors.cyan} /></View>
            <View style={styles.locationCopy}>
              <Text style={styles.locationName}>{location.name}</Text>
              <Text style={styles.locationAddress}>{[location.address, location.postcode].filter(Boolean).join(' · ') || 'Address not supplied by FateDrop Cloud'}</Text>
              {location.phone ? <Text style={styles.locationPhone}>{location.phone}</Text> : null}
            </View>
          </View>)}
          <Pressable
            onPress={() => router.push({ pathname: '/local-radar', params: { retailerId: retailer.id, retailerName: retailer.name } })}
            style={({ pressed }) => [styles.locationsRadar, pressed && styles.pressed]}
          ><Ionicons name="navigate-outline" size={17} color={FateDropColors.goldBright} /><Text style={styles.locationsRadarText}>VIEW THIS RETAILER IN LOCAL RADAR</Text></Pressable>
        </View> : null}

        <View style={styles.truthPanel}>
          <View style={styles.truthIcon}><Ionicons name="shield-checkmark-outline" size={27} color={FateDropColors.goldBright} /></View>
          <Text style={styles.truthText}>Online retailer availability never proves stock at a physical branch. Local Radar only confirms physical availability from exact-branch evidence.</Text>
        </View>

        <View style={styles.cataloguePanel}>
          <View style={styles.catalogueHeadingRow}>
            <View style={styles.catalogueHeadingCopy}>
              <Text style={styles.catalogueTitle}>Shop catalogue ✦</Text>
              <Text style={styles.catalogueMeta}>Search only {retailer.name}’s connected in-stock offers. Use FateFind to compare the same product across retailers.</Text>
            </View>
            <Ionicons name="diamond-outline" size={23} color={FateDropColors.violetLight} />
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={19} color={FateDropColors.secondary} />
            <TextInput
              value={catalogueQuery}
              onChangeText={setCatalogueQuery}
              placeholder={`Search ${retailer.name}`}
              placeholderTextColor={FateDropColors.muted}
              style={styles.input}
              returnKeyType="search"
              accessibilityLabel={`Search ${retailer.name} catalogue`}
            />
            {catalogueQuery ? <Pressable accessibilityRole="button" accessibilityLabel="Clear storefront catalogue search" onPress={() => setCatalogueQuery('')} hitSlop={8}><Ionicons name="close-circle" size={19} color={FateDropColors.secondary} /></Pressable> : null}
          </View>

          {cleanCatalogueQuery ? <Text style={styles.searchContext}>Showing current verified in-stock matches for “{cleanCatalogueQuery}”.</Text> : null}

          {catalogue.loading ? <ActivityIndicator color={FateDropColors.goldBright} style={styles.catalogueLoading} /> : null}
          {catalogue.error ? <View style={styles.catalogueError}><Text style={styles.catalogueErrorText}>{catalogue.error}</Text><Pressable onPress={() => void catalogue.retry()}><Text style={styles.retryText}>RETRY</Text></Pressable></View> : null}

          {!catalogue.loading && !catalogue.error && strictOffers.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsRow}>
            {strictOffers.map((item) => <CatalogueCard key={item.id} item={item} retailer={retailer} />)}
          </ScrollView> : null}

          {!catalogue.loading && !catalogue.error && !strictOffers.length ? <View style={styles.emptyPanel}>
            <Ionicons name="albums-outline" size={26} color={FateDropColors.muted} />
            <Text style={styles.emptyTitle}>{cleanCatalogueQuery ? 'No in-stock matches' : 'No connected in-stock offers'}</Text>
            <Text style={styles.emptyText}>{cleanCatalogueQuery ? 'Try another search inside this retailer.' : 'FateDrop has no currently verified in-stock online offers connected to this retailer.'}</Text>
          </View> : null}

          {catalogue.hasMore ? <Pressable onPress={() => void catalogue.loadMore()} disabled={catalogue.loadingMore} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
            {catalogue.loadingMore ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Text style={styles.loadMoreText}>LOAD MORE</Text>}
          </Pressable> : null}
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050A12' },
  content: { paddingHorizontal: 14, paddingBottom: 120 },
  topBar: { minHeight: 96, flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 12 },
  backButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.bronze}AA`, backgroundColor: 'rgba(5,10,18,.88)' },
  pageHeading: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  pageTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 27, fontWeight: '700' },
  pageSubtitle: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 8, letterSpacing: 2.1, marginTop: 7 },
  topSpacer: { width: 48 },
  loadingPanel: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 12, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  loadingText: { color: FateDropColors.secondary, fontSize: 11 },
  errorPanel: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 12, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.amber}55`, backgroundColor: `${FateDropColors.amber}0D` },
  errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 11, lineHeight: 16 },
  heroCard: { height: 220, position: 'relative', overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: `${FateDropColors.bronze}AA`, backgroundColor: '#09101A' },
  heroImage: { ...StyleSheet.absoluteFill },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,8,15,.52)' },
  identityTile: { position: 'absolute', left: 18, top: 28, width: 92, height: 92, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.goldBright}AA`, backgroundColor: 'rgba(242,233,218,.94)' },
  identityLogo: { width: '88%', height: '88%' },
  identityInitials: { color: '#213B32', fontFamily: Fonts?.serif, fontSize: 31, fontWeight: '700' },
  heroIdentity: { position: 'absolute', left: 126, right: 18, top: 34 },
  retailerName: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 33, fontWeight: '700' },
  retailerClass: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginTop: 8 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  heroStatusText: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  visitButton: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.violetLight}AA`, backgroundColor: 'rgba(72,49,133,.55)' },
  findButton: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.blue}88`, backgroundColor: 'rgba(17,42,74,.66)' },
  actionText: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 16, fontWeight: '700' },
  description: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 12, lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
  infoPanel: { marginTop: 14, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.bronze}88`, backgroundColor: 'rgba(7,14,24,.94)' },
  infoRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${FateDropColors.bronze}66`, paddingVertical: 11 },
  infoIcon: { width: 31, alignItems: 'center' },
  infoLabel: { width: 112, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 13 },
  infoValue: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 13, lineHeight: 18 },
  locationsPanel: { marginTop: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.cyan}44`, backgroundColor: 'rgba(6,17,29,.95)' },
  locationsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  locationsEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  locationsTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 20, marginTop: 2 },
  locationsCount: { color: FateDropColors.cyan, fontFamily: Fonts?.serif, fontSize: 22 },
  locationRow: { flexDirection: 'row', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${FateDropColors.cyan}33` },
  locationPin: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}0D` },
  locationCopy: { flex: 1 },
  locationName: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 14, fontWeight: '700' },
  locationAddress: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  locationPhone: { color: FateDropColors.cyan, fontSize: 9, marginTop: 3 },
  locationsRadar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.goldBright}55`, backgroundColor: `${FateDropColors.goldBright}08` },
  locationsRadarText: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  truthPanel: { marginTop: 14, minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 19, borderWidth: 1, borderColor: `${FateDropColors.goldBright}99`, backgroundColor: 'rgba(8,18,29,.96)' },
  truthIcon: { width: 45, height: 50, alignItems: 'center', justifyContent: 'center' },
  truthText: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 12, lineHeight: 18 },
  cataloguePanel: { marginTop: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.bronze}88`, backgroundColor: 'rgba(6,13,22,.96)' },
  catalogueHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  catalogueHeadingCopy: { flex: 1 },
  catalogueTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 23, fontWeight: '700' },
  catalogueMeta: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 11, lineHeight: 16, marginTop: 4 },
  search: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.bronze}88`, backgroundColor: 'rgba(5,12,21,.95)' },
  input: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 13 },
  searchContext: { color: FateDropColors.cyan, fontSize: 9, lineHeight: 14, marginTop: 9 },
  catalogueLoading: { marginVertical: 28 },
  catalogueError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.amber}44` },
  catalogueErrorText: { flex: 1, color: FateDropColors.secondary, fontSize: 10 },
  retryText: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  productsRow: { gap: 10, paddingTop: 14, paddingRight: 4 },
  productCard: { width: 205, minHeight: 288, padding: 11, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.bronze}88`, backgroundColor: 'rgba(8,16,27,.97)' },
  productImageFrame: { height: 145, borderRadius: 13, overflow: 'hidden', backgroundColor: 'rgba(12,20,34,.9)', alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  productFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  productTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 15, lineHeight: 19, marginTop: 10 },
  stockText: { color: FateDropColors.mint, fontSize: 10, fontWeight: '800', marginTop: 6 },
  productBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
  productPrice: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 20 },
  productOpen: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.bronze}AA`, backgroundColor: 'rgba(10,20,32,.96)' },
  emptyPanel: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 18 },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 16, marginTop: 9 },
  emptyText: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 },
  loadMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border },
  loadMoreText: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  pressed: { opacity: .76 },
});