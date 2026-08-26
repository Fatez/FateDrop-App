import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';

type RadarValue = {
  priceKnown?: boolean;
  itemPricePence?: number | null;
  rrp?: { known?: boolean; pence?: number | null; source?: string | null } | null;
  itemVsRrp?: { deltaPercent?: number | null } | null;
};

type RadarStockProduct = {
  productIdentityId?: string | null;
  title?: string | null;
  lifecycleState?: string | null;
  status?: string | null;
  confidence?: number | null;
  freshnessAgeMinutes?: number | null;
  contradictionCount?: number | null;
  advisory?: boolean | null;
  scope?: string | null;
  expectedFrom?: string | null;
  expectedTo?: string | null;
  note?: string | null;
  sourceLabel?: string | null;
  sourceType?: string | null;
  value?: RadarValue | null;
};

type RadarShop = {
  id: string;
  name: string;
  retailerId?: string | null;
  address?: string | null;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMiles?: number | null;
  networkStatus?: string | null;
  localStockStatus?: string | null;
  localStockEvidence?: {
    lifecycleState?: string | null;
    confidence?: number | null;
    freshnessAgeMinutes?: number | null;
    verifiedBranchStock?: boolean | null;
    advisory?: boolean | null;
    scope?: string | null;
    expectedFrom?: string | null;
    expectedTo?: string | null;
    note?: string | null;
    sourceLabel?: string | null;
    sourceType?: string | null;
  } | null;
  localStockProducts?: RadarStockProduct[] | null;
};

type RadarResponse = {
  success?: boolean;
  error?: string;
  shops?: RadarShop[];
  counts?: {
    shops?: number;
    localInStockBranches?: number;
    localLowStockBranches?: number;
    incomingWatchBranches?: number;
  };
};

const locationAdapter = new ExpoLocationAdapter();

function money(pence?: number | null) {
  return typeof pence === 'number' && Number.isFinite(pence) ? `£${(pence / 100).toFixed(2)}` : null;
}

function confidenceLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'UNKNOWN';
  if (value >= 0.85) return 'HIGH';
  if (value >= 0.6) return 'MEDIUM';
  return 'LOW';
}

function ageLabel(minutes?: number | null) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'Freshness unknown';
  if (minutes < 1) return 'Observed just now';
  if (minutes < 60) return `Observed ${Math.round(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return `Observed ${hours} hr${hours === 1 ? '' : 's'} ago`;
}

function dateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function expectedWindow(product?: RadarStockProduct | null) {
  if (!product) return null;
  const from = dateLabel(product.expectedFrom);
  const to = dateLabel(product.expectedTo);
  if (from && to && from === to) return from;
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `By ${to}`;
  return null;
}

function valueLine(value?: RadarValue | null) {
  if (!value) return 'Price unknown · RRP unknown';
  const price = value.priceKnown ? money(value.itemPricePence) : null;
  const rrp = value.rrp?.known ? money(value.rrp.pence) : null;
  const delta = value.itemVsRrp?.deltaPercent;
  const parts = [price || 'Price unknown', rrp ? `RRP ${rrp}` : 'RRP unknown'];
  if (typeof delta === 'number' && Number.isFinite(delta)) {
    parts.push(Math.abs(delta) < 0.05 ? 'AT RRP' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% ${delta > 0 ? 'ABOVE' : 'BELOW'} RRP`);
  }
  return parts.join(' · ');
}

function lifecycle(shop: RadarShop) {
  return String(shop.localStockEvidence?.lifecycleState || shop.localStockProducts?.[0]?.lifecycleState || '').toLowerCase();
}

function signalLabel(shop: RadarShop) {
  const state = lifecycle(shop);
  if (shop.localStockEvidence?.verifiedBranchStock && state === 'manifested') return 'LOCAL MANIFESTED';
  if (state === 'echo') return 'LOCAL ECHO';
  if (state === 'whisper' || shop.localStockStatus === 'incoming_watch') return 'LOCAL WHISPER';
  if (state === 'vanished') return 'LOCAL VANISHED';
  return shop.networkStatus === 'live_connected' ? 'TRACKED RETAILER' : 'NEARBY RETAILER';
}

function hasCoords(shop: RadarShop) {
  return typeof shop.latitude === 'number' && Number.isFinite(shop.latitude)
    && typeof shop.longitude === 'number' && Number.isFinite(shop.longitude);
}

export default function LocalRadarStockScreen() {
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState(25);
  const [shops, setShops] = useState<RadarShop[]>([]);
  const [counts, setCounts] = useState<RadarResponse['counts']>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const load = useCallback(async (nextArea: UserArea) => {
    setLoading(true);
    setError('');
    try {
      const params = [`types=shops`, `radiusMiles=${radius}`];
      if (nextArea.source === 'DEVICE' && nextArea.latitude !== undefined && nextArea.longitude !== undefined) {
        params.push(`lat=${encodeURIComponent(String(nextArea.latitude))}`, `lng=${encodeURIComponent(String(nextArea.longitude))}`);
      } else if (nextArea.postcode) {
        params.push(`postcode=${encodeURIComponent(nextArea.postcode)}`);
      } else {
        throw new Error('LOCATION_UNRESOLVED');
      }
      const response = await fetch(`${SIGNAL_ENGINE_URL}/api/local-radar?${params.join('&')}`);
      const payload = await response.json() as RadarResponse;
      if (!response.ok || payload.success === false) throw new Error(payload.error || 'RADAR_UNAVAILABLE');
      setArea(nextArea);
      setShops(payload.shops || []);
      setCounts(payload.counts || {});
    } catch {
      setShops([]);
      setCounts({});
      setError('Physical stock radar could not load. Try your postcode or location again.');
    } finally {
      setLoading(false);
    }
  }, [radius]);

  useEffect(() => {
    if (area) void load(area);
  }, [area, load]);

  const handleDeviceLocation = async () => {
    try {
      await load(await locationAdapter.requestCurrentArea());
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'LOCATION_DENIED'
        ? 'Location permission was denied. Enter a UK postcode instead.'
        : 'Your location could not be determined.');
    }
  };

  const handlePostcodeScan = async () => {
    try {
      await load(await locationAdapter.fromPostcode(postcode));
    } catch {
      setError('Enter a valid UK postcode.');
    }
  };

  const mapShops = useMemo(() => shops.filter(hasCoords), [shops]);
  const first = mapShops[0];
  const center = area?.source === 'DEVICE' && area.latitude !== undefined && area.longitude !== undefined
    ? { latitude: area.latitude, longitude: area.longitude }
    : first
      ? { latitude: first.latitude as number, longitude: first.longitude as number }
      : { latitude: 52.5, longitude: -1.5 };
  const confirmed = (counts?.localInStockBranches || 0) + (counts?.localLowStockBranches || 0);

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Local Radar</Text></Pressable>
    <Text style={styles.eyebrow}>PHYSICAL IN-STORE STOCK</Text>
    <Text style={styles.title}>Nearby stores and incoming stock intelligence.</Text>
    <Text style={styles.subtitle}>Verified collection or branch availability can become Local Manifested. Preparation, expected deliveries and manual/community reports stay clearly labelled until physical stock is verified.</Text>

    <View style={styles.locationCard}>
      <Pressable onPress={() => void handleDeviceLocation()} disabled={loading} style={styles.primaryButton}><Ionicons name="locate" size={18} color={FateDropColors.text}/><Text style={styles.primaryText}>{loading ? 'Scanning…' : 'Use my location'}</Text></Pressable>
      <View style={styles.postcodeRow}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.postcodeInput}/><Pressable onPress={() => void handlePostcodeScan()} style={styles.postcodeButton}><Text style={styles.primaryText}>Scan</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>

    <View style={styles.mapShell}>
      <MapView style={styles.map} region={{ ...center, latitudeDelta: 0.32, longitudeDelta: 0.32 }} showsUserLocation={area?.source === 'DEVICE'} showsMyLocationButton={false}>
        {mapShops.map(shop => {
          const signal = signalLabel(shop);
          const product = shop.localStockProducts?.[0];
          return <Marker
            key={shop.id}
            coordinate={{ latitude: shop.latitude as number, longitude: shop.longitude as number }}
            title={shop.name}
            description={`${signal}${product?.title ? ` · ${product.title}` : ''}`}
            pinColor={shop.localStockEvidence?.verifiedBranchStock ? FateDropColors.mint : signal === 'LOCAL ECHO' || signal === 'LOCAL WHISPER' ? FateDropColors.cyan : FateDropColors.violetLight}
            onPress={() => setSelectedStoreId(shop.id)}
          />;
        })}
      </MapView>
      {!area ? <View style={styles.mapOverlay}><Ionicons name="storefront" size={30} color={FateDropColors.cyan}/><Text style={styles.mapOverlayTitle}>Scan nearby physical retailers</Text><Text style={styles.mapOverlayText}>Set a location to map tracked Pokémon sellers and branch-level intelligence.</Text></View> : null}
    </View>

    {area ? <View style={styles.stats}><StatusBadge label={`${shops.length} stores`} color={FateDropColors.violetLight}/><StatusBadge label={`${confirmed} verified stock`} color={FateDropColors.mint}/><StatusBadge label={`${counts?.incomingWatchBranches || 0} preparing`} color={FateDropColors.cyan}/></View> : null}
    {area ? <><Text style={styles.sectionTitle}>Radius</Text><View style={styles.filters}>{[5,10,25,50].map(value => <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => setRadius(value)}/>)}</View></> : null}

    <View style={styles.truthCard}><Ionicons name="information-circle" size={18} color={FateDropColors.cyan}/><Text style={styles.truthText}>Expected stock is advisory intelligence, not a promise. Check the store before travelling when evidence is not yet verified branch stock.</Text></View>
    <View style={styles.listHeader}><Text style={styles.sectionTitle}>Nearby stores</Text><StatusBadge label={`${shops.length} results`} color={FateDropColors.cyan}/></View>
  </>;

  return <SafeAreaView style={styles.safe}>
    <FateDropBackground />
    <FlatList
      data={shops}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>{area ? 'No nearby tracked Pokémon retailers or current stock intelligence found in this radius.' : 'Use your location or a postcode to start Local Radar.'}</Text>}
      renderItem={({ item }) => {
        const signal = signalLabel(item);
        const product = item.localStockProducts?.[0];
        const products = item.localStockProducts || [];
        const verified = signal === 'LOCAL MANIFESTED';
        const preparing = signal === 'LOCAL ECHO' || signal === 'LOCAL WHISPER';
        const selected = selectedStoreId === item.id;
        const statusText = verified
          ? 'Physical stock confirmed at this branch'
          : preparing
            ? 'Incoming / preparation intelligence · NOT YET CONFIRMED'
            : 'No verified branch stock currently';
        return <Pressable
          onPress={() => setSelectedStoreId(selected ? null : item.id)}
          style={[styles.card, selected ? styles.cardSelected : null]}
        >
          <View style={styles.icon}><Ionicons name="storefront" size={21} color={verified ? FateDropColors.mint : preparing ? FateDropColors.cyan : FateDropColors.violetLight}/></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.signal, verified ? styles.manifested : preparing ? styles.echo : undefined]}>{signal}</Text>
            <Text style={styles.storeName}>{item.name}</Text>
            <Text style={styles.meta}>{product?.title || statusText}</Text>
            {product ? <Text style={styles.meta}>{statusText} · {ageLabel(product.freshnessAgeMinutes)} · Confidence {confidenceLabel(product.confidence)}</Text> : null}
            {product ? <Text style={styles.value}>{valueLine(product.value)}</Text> : null}
            <Text style={styles.meta}>{item.distanceMiles !== null && item.distanceMiles !== undefined ? `${item.distanceMiles.toFixed(1)} miles · ` : ''}{item.address || item.postcode || 'Location pending'}</Text>
            {(product?.contradictionCount || 0) > 0 ? <Text style={styles.warning}>{product?.contradictionCount} recent contradiction{product?.contradictionCount === 1 ? '' : 's'} reflected in confidence</Text> : null}

            {selected ? <View style={styles.intelPanel}>
              <Text style={styles.intelHeading}>STORE INTELLIGENCE</Text>
              {products.length ? products.map((entry, index) => {
                const window = expectedWindow(entry);
                const advisory = entry.advisory === true;
                const entryVerified = entry.lifecycleState === 'manifested' && !advisory;
                return <View key={`${entry.productIdentityId || entry.title || 'product'}:${index}`} style={styles.productIntel}>
                  <View style={styles.productIntelHeader}>
                    <Text style={[styles.productState, entryVerified ? styles.manifested : styles.echo]}>{entryVerified ? 'VERIFIED PHYSICAL STOCK' : advisory ? 'LOCAL INTEL · UNCONFIRMED' : `LOCAL ${String(entry.lifecycleState || 'WATCH').toUpperCase()}`}</Text>
                    <Text style={styles.confidence}>{confidenceLabel(entry.confidence)}</Text>
                  </View>
                  <Text style={styles.productTitle}>{entry.title || 'Trading card product'}</Text>
                  {window ? <Text style={styles.expected}>Expected window · {window}</Text> : null}
                  <Text style={styles.productMeta}>{ageLabel(entry.freshnessAgeMinutes)}{entry.sourceLabel || entry.sourceType ? ` · Source: ${entry.sourceLabel || entry.sourceType}` : ''}</Text>
                  <Text style={styles.value}>{valueLine(entry.value)}</Text>
                  {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
                  {advisory ? <Text style={styles.advisory}>Not confirmed at this exact branch. Check with the store before travelling.</Text> : null}
                </View>;
              }) : <Text style={styles.productMeta}>No current product-specific stock intelligence for this store.</Text>}
              {item.retailerId ? <Pressable onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: item.retailerId! } })} style={styles.retailerButton}><Text style={styles.retailerButtonText}>View retailer details</Text><Ionicons name="chevron-forward" size={15} color={FateDropColors.text}/></Pressable> : null}
            </View> : null}
          </View>
          <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={17} color={FateDropColors.muted}/>
        </Pressable>;
      }}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:18,paddingBottom:80},
  back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},
  eyebrow:{color:FateDropColors.cyan,fontSize:10,fontWeight:'900',letterSpacing:1.5,marginTop:8},title:{color:FateDropColors.text,fontSize:27,fontWeight:'900',lineHeight:32,marginTop:5},subtitle:{color:FateDropColors.secondary,fontSize:12,lineHeight:18,marginTop:8,marginBottom:14},
  locationCard:{padding:14,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},primaryButton:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,padding:12,borderRadius:13,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontWeight:'900'},postcodeRow:{flexDirection:'row',gap:8,marginTop:8},postcodeInput:{flex:1,color:FateDropColors.text,padding:11,borderRadius:12,backgroundColor:FateDropColors.cardElevated},postcodeButton:{justifyContent:'center',paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:10,marginTop:7},
  mapShell:{height:390,borderRadius:22,overflow:'hidden',marginTop:14,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.cardElevated},map:{...StyleSheet.absoluteFillObject},mapOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',padding:34,backgroundColor:'rgba(8,8,18,0.86)'},mapOverlayTitle:{color:FateDropColors.text,fontSize:17,fontWeight:'900',marginTop:7},mapOverlayText:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,textAlign:'center',marginTop:4},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},sectionTitle:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginVertical:14},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},truthCard:{flexDirection:'row',gap:9,padding:13,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:15},truthText:{flex:1,color:FateDropColors.secondary,fontSize:10,lineHeight:15},listHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  card:{flexDirection:'row',alignItems:'flex-start',gap:11,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:9},cardSelected:{borderColor:FateDropColors.cyan},icon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.cardElevated},signal:{color:FateDropColors.muted,fontSize:9,fontWeight:'900',letterSpacing:.7,marginBottom:3},manifested:{color:FateDropColors.mint},echo:{color:FateDropColors.cyan},storeName:{color:FateDropColors.text,fontWeight:'900'},meta:{color:FateDropColors.muted,fontSize:10,marginTop:4,lineHeight:15},value:{color:FateDropColors.secondary,fontSize:10,fontWeight:'800',marginTop:5},warning:{color:FateDropColors.coral,fontSize:9,marginTop:4},empty:{color:FateDropColors.muted,textAlign:'center',margin:35,lineHeight:18},
  intelPanel:{marginTop:13,paddingTop:12,borderTopWidth:1,borderTopColor:FateDropColors.border},intelHeading:{color:FateDropColors.text,fontSize:11,fontWeight:'900',letterSpacing:1,marginBottom:8},productIntel:{padding:11,borderRadius:13,backgroundColor:FateDropColors.cardElevated,marginBottom:8},productIntelHeader:{flexDirection:'row',justifyContent:'space-between',gap:8},productState:{fontSize:8,fontWeight:'900',letterSpacing:.6},confidence:{color:FateDropColors.muted,fontSize:8,fontWeight:'900'},productTitle:{color:FateDropColors.text,fontSize:12,fontWeight:'900',marginTop:5},expected:{color:FateDropColors.cyan,fontSize:10,fontWeight:'900',marginTop:6},productMeta:{color:FateDropColors.muted,fontSize:9,lineHeight:14,marginTop:5},note:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:6},advisory:{color:FateDropColors.coral,fontSize:9,fontWeight:'800',lineHeight:14,marginTop:7},retailerButton:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:11,borderRadius:12,backgroundColor:FateDropColors.violet,marginTop:3},retailerButtonText:{color:FateDropColors.text,fontSize:10,fontWeight:'900'}
});