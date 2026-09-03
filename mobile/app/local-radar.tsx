import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  clusterShops,
  clusterZoomRegion,
  filterShopsByCategory,
  retailerCategory,
  type LocalRadarRetailerCategory,
} from '@/lib/local-radar-map';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';
import { areaParams, expectedStockForShop, fetchLocalRadar, prioritizeRadarShops, shopPhysicalEvidenceState, shopSignal, type RadarShop } from '@/services/local-radar-intelligence';

const adapter = new ExpoLocationAdapter();
const UK_REGION: Region = { latitude: 52.7, longitude: -1.5, latitudeDelta: 8.2, longitudeDelta: 7.6 };
const DEFAULT_MAP_MARKER_BUDGET = 72;
const STORE_PREVIEW_LIMIT = 80;

const STORE_FILTERS: { key: LocalRadarRetailerCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'supermarket', label: 'Supermarkets' },
  { key: 'large', label: 'Large retailers' },
  { key: 'independent', label: 'Independents' },
];

function markerColor(shop: RadarShop) {
  const state = shopPhysicalEvidenceState(shop);
  if (state === 'verified') return FateDropColors.mint;
  if (state === 'expected') return FateDropColors.cyan;
  if (state === 'reported') return FateDropColors.echo;
  if (state === 'expired') return FateDropColors.muted;
  return FateDropColors.goldBright;
}

function storeTypeLabel(shop: RadarShop) {
  const category = retailerCategory(shop);
  if (category === 'supermarket') return 'Supermarket';
  if (category === 'large') return 'Large retailer';
  if (category === 'independent') return 'Independent';
  return 'Unclassified';
}

function regionFor(area: UserArea | undefined, shops: RadarShop[]): Region {
  const mapped = shops.filter(shop => typeof shop.latitude === 'number' && typeof shop.longitude === 'number');
  if (mapped.length) {
    const latitudes = mapped.map(shop => Number(shop.latitude));
    const longitudes = mapped.map(shop => Number(shop.longitude));
    if (area?.latitude !== undefined && area.longitude !== undefined) {
      latitudes.push(area.latitude);
      longitudes.push(area.longitude);
    }
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeSpan = maxLatitude - minLatitude;
    const longitudeSpan = maxLongitude - minLongitude;
    return {
      latitude: (minLatitude + maxLatitude) / 2,
      longitude: (minLongitude + maxLongitude) / 2,
      latitudeDelta: Math.max(0.28, latitudeSpan * 1.25),
      longitudeDelta: Math.max(0.28, longitudeSpan * 1.25),
    };
  }
  if (area?.latitude !== undefined && area.longitude !== undefined) {
    return { latitude: area.latitude, longitude: area.longitude, latitudeDelta: 0.28, longitudeDelta: 0.28 };
  }
  return UK_REGION;
}

export default function LocalRadarScreen() {
  const params = useLocalSearchParams<{ retailerId?: string; retailerName?: string }>();
  const scopedRetailerId = typeof params.retailerId === 'string' ? params.retailerId : '';
  const scopedRetailerName = typeof params.retailerName === 'string' ? params.retailerName : '';
  const { height } = useWindowDimensions();
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState(25);
  const [shops, setShops] = useState<RadarShop[]>([]);
  const [selected, setSelected] = useState<RadarShop | null>(null);
  const [storeFilter, setStoreFilter] = useState<LocalRadarRetailerCategory>('all');
  const [markerBudget, setMarkerBudget] = useState(DEFAULT_MAP_MARKER_BUDGET);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState<Region>(UK_REGION);
  const mapRef = useRef<MapView | null>(null);
  const clusterAnimationInFlight = useRef(false);
  const clusterReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationActionInFlight = useRef(false);

  useEffect(() => () => {
    if (clusterReleaseTimer.current) clearTimeout(clusterReleaseTimer.current);
  }, []);

  const load = useCallback(async (nextArea: UserArea, nextRadius = radius) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLocalRadar(nextArea, nextRadius, 'shops');
      const allShops = payload.shops || [];
      setMarkerBudget(Math.max(8, Math.min(100, Number(payload.mapPolicy?.markerBudget) || DEFAULT_MAP_MARKER_BUDGET)));
      const nextShops = scopedRetailerId ? allShops.filter((shop) => shop.retailerId === scopedRetailerId) : allShops;
      const nextRegion = regionFor(nextArea, nextShops);
      setShops(nextShops);
      if (mapRef.current) mapRef.current.animateToRegion(nextRegion, 260);
      else setRegion(nextRegion);
      setSelected(current => current ? nextShops.find(shop => shop.id === current.id) || null : null);
    } catch (reason) {
      setShops([]);
      setSelected(null);
      setError(reason instanceof Error && reason.message === 'INVALID_POSTCODE' ? 'Enter a valid UK postcode.' : 'Local Radar could not reach the physical-store network.');
    } finally {
      locationActionInFlight.current = false;
      setLoading(false);
    }
  }, [radius, scopedRetailerId]);

  useEffect(() => {
    if (area) void Promise.resolve().then(() => load(area, radius));
  }, [area, radius, load]);

  const handleDeviceLocation = async () => {
    if (locationActionInFlight.current) return;
    locationActionInFlight.current = true;
    setLoading(true);
    setError('');
    try { setArea(await adapter.requestCurrentArea()); }
    catch (reason) {
      locationActionInFlight.current = false;
      setLoading(false);
      setError(reason instanceof Error && reason.message === 'LOCATION_DENIED' ? 'Location permission was denied. Enter a postcode instead.' : 'Location could not be determined.');
    }
  };

  const handlePostcodeSearch = async () => {
    if (locationActionInFlight.current) return;
    locationActionInFlight.current = true;
    setLoading(true);
    setError('');
    try { setArea(await adapter.fromPostcode(postcode)); }
    catch {
      locationActionInFlight.current = false;
      setLoading(false);
      setError('Enter a valid UK postcode.');
    }
  };

  const categoryCounts = useMemo(() => {
    const counts = { all: shops.length, supermarket: 0, large: 0, independent: 0, unclassified: 0 };
    for (const shop of shops) counts[retailerCategory(shop)] += 1;
    return counts;
  }, [shops]);
  const filteredShops = useMemo(
    () => scopedRetailerId ? shops : filterShopsByCategory(shops, storeFilter),
    [scopedRetailerId, shops, storeFilter],
  );
  useEffect(() => {
    void Promise.resolve().then(() => {
      setSelected(current => current && filteredShops.some(shop => shop.id === current.id) ? current : null);
    });
  }, [filteredShops]);
  const mappedShops = useMemo(() => filteredShops.filter(shop => typeof shop.latitude === 'number' && typeof shop.longitude === 'number'), [filteredShops]);
  const mapPoints = useMemo(() => clusterShops(mappedShops, region, { maxMarkers: markerBudget }), [mappedShops, markerBudget, region]);
  const prioritizedShops = useMemo(() => prioritizeRadarShops(filteredShops).slice(0, STORE_PREVIEW_LIMIT), [filteredShops]);
  const confirmed = useMemo(() => filteredShops.filter(shop => shopPhysicalEvidenceState(shop) === 'verified').length, [filteredShops]);
  const expected = useMemo(() => filteredShops.filter(shop => shopPhysicalEvidenceState(shop) === 'expected').length, [filteredShops]);
  const reported = useMemo(() => filteredShops.filter(shop => shopPhysicalEvidenceState(shop) === 'reported').length, [filteredShops]);
  const navParams = { ...areaParams(area, radius), ...(storeFilter !== 'all' ? { storeType: storeFilter } : {}) };
  const mapHeight = Math.max(330, Math.min(480, height * 0.48));
  const selectedExpected = selected ? expectedStockForShop(selected) : null;
  const scopedName = scopedRetailerName || 'this retailer';
  const previewLimited = filteredShops.length > STORE_PREVIEW_LIMIT;

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/></Pressable>
      <View style={styles.titleWrap}><Text style={styles.eyebrow}>FATE NETWORK · LOCAL RADAR</Text><Text style={styles.title}>{scopedRetailerId ? `Find ${scopedName} near you` : 'What is happening around you?'}</Text></View>
    </View>

    <View style={[styles.mapShell, { height: mapHeight }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={UK_REGION}
        onRegionChangeComplete={(nextRegion) => {
          setRegion(nextRegion);
          clusterAnimationInFlight.current = false;
          if (clusterReleaseTimer.current) {
            clearTimeout(clusterReleaseTimer.current);
            clusterReleaseTimer.current = null;
          }
        }}
        showsUserLocation={area?.source === 'DEVICE'}
        showsMyLocationButton={false}
      >
        {mapPoints.map(point => point.kind === 'cluster' ? <Marker
          key={point.id}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          pinColor={FateDropColors.violetLight}
          title={`${point.count} nearby stores`}
          description="Tap to zoom"
          tracksViewChanges={false}
          onPress={() => {
            if (clusterAnimationInFlight.current) return;
            clusterAnimationInFlight.current = true;
            setSelected(null);
            const nextRegion = clusterZoomRegion(point, region);
            mapRef.current?.animateToRegion(nextRegion, 260);
            if (clusterReleaseTimer.current) clearTimeout(clusterReleaseTimer.current);
            clusterReleaseTimer.current = setTimeout(() => {
              clusterAnimationInFlight.current = false;
              clusterReleaseTimer.current = null;
            }, 650);
          }}
        /> : <Marker
          key={point.id}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          pinColor={markerColor(point.shop)}
          title={point.shop.name}
          description={shopSignal(point.shop)}
          tracksViewChanges={false}
          onPress={() => setSelected(point.shop)}
        />)}
      </MapView>
      <View style={styles.mapLegend}><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.mint}]}/><Text style={styles.legendText}>In-store</Text></View><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.cyan}]}/><Text style={styles.legendText}>Expected</Text></View><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.echo}]}/><Text style={styles.legendText}>Reported</Text></View><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.goldBright}]}/><Text style={styles.legendText}>Store</Text></View></View>
      {area ? <View style={styles.mapStats}><StatusBadge label={`${filteredShops.length} stores`} color={FateDropColors.violetLight}/><StatusBadge label={`${mapPoints.length} map pins`} color={FateDropColors.goldBright}/><StatusBadge label={`${confirmed} in-store`} color={FateDropColors.mint}/><StatusBadge label={`${expected} expected`} color={FateDropColors.cyan}/>{reported ? <StatusBadge label={`${reported} reported`} color={FateDropColors.echo}/> : null}</View> : null}
      {!area ? <View style={styles.mapPrompt}><Ionicons name="navigate-circle-outline" size={36} color={FateDropColors.goldBright}/><Text style={styles.mapPromptTitle}>Search your area</Text><Text style={styles.mapPromptCopy}>{scopedRetailerId ? `Use your location or postcode to find known ${scopedName} branches.` : 'Known and candidate Pokémon retailers will appear as bounded clustered map pins.'}</Text></View> : null}
      {area && scopedRetailerId && !loading && !filteredShops.length ? <View style={styles.mapPrompt}><Ionicons name="storefront-outline" size={32} color={FateDropColors.goldBright}/><Text style={styles.mapPromptTitle}>No nearby branch found</Text><Text style={styles.mapPromptCopy}>Local Radar did not find a canonical {scopedName} branch inside this radius. Increase the radius or try another location.</Text></View> : null}
      {area && !scopedRetailerId && storeFilter !== 'all' && !loading && !filteredShops.length ? <View style={styles.mapPrompt}><Ionicons name="options-outline" size={32} color={FateDropColors.goldBright}/><Text style={styles.mapPromptTitle}>No stores match this filter</Text><Text style={styles.mapPromptCopy}>Try another store type or increase your Local Radar radius.</Text></View> : null}
      {selected ? <View style={styles.selectedCard}>
        <View style={styles.selectedCopy}><Text style={[styles.selectedSignal,{color:markerColor(selected)}]}>{shopSignal(selected)} · {storeTypeLabel(selected)}</Text><Text style={styles.selectedName}>{selected.name}</Text><Text style={styles.selectedMeta}>{selected.distanceMiles != null ? `${selected.distanceMiles.toFixed(1)} miles · ` : ''}{selected.address || selected.postcode || 'Location pending'}</Text>{selectedExpected ? <Text style={styles.selectedMeta}>{selectedExpected.title}{selectedExpected.label ? ` · ${selectedExpected.label}` : ''}</Text> : null}</View>
        <Pressable onPress={() => router.push({ pathname:'/local-radar-store', params:{ id:selected.id, ...navParams } })} style={styles.selectedButton}><Text style={styles.selectedButtonText}>Open</Text><Ionicons name="chevron-forward" size={15} color={FateDropColors.text}/></Pressable>
      </View> : null}
    </View>

    <View style={styles.searchCard}>
      <Pressable onPress={() => void handleDeviceLocation()} disabled={loading} style={styles.locate}><Ionicons name="locate" size={16} color={FateDropColors.text}/><Text style={styles.locateText}>{loading ? 'Scanning…' : 'Use my location'}</Text></Pressable>
      <View style={styles.manual}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.input}/><Pressable onPress={() => void handlePostcodeSearch()} disabled={loading} style={styles.setButton}><Text style={styles.locateText}>{loading ? 'Scanning…' : 'Set'}</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {area ? <View style={styles.radiusRow}>{[5,10,25,50].map(value => <Pressable key={value} onPress={() => setRadius(value)} disabled={loading} style={[styles.radiusChip, radius === value && styles.radiusChipActive]}><Text style={[styles.radiusText, radius === value && styles.radiusTextActive]}>{value} mi</Text></Pressable>)}</View> : null}
    </View>

    {area && !scopedRetailerId ? <View style={styles.storeFilterCard}>
      <View style={styles.filterHeader}><Text style={styles.filterTitle}>Store type</Text><Text style={styles.filterMeta}>Cloud-classified · map and preview</Text></View>
      <View style={styles.storeFilterRow}>{STORE_FILTERS.map(option => <Pressable
        key={option.key}
        onPress={() => setStoreFilter(option.key)}
        style={[styles.storeFilterChip, storeFilter === option.key && styles.storeFilterChipActive]}
      ><Text style={[styles.storeFilterText, storeFilter === option.key && styles.storeFilterTextActive]}>{option.label} · {categoryCounts[option.key]}</Text></Pressable>)}</View>
      {categoryCounts.unclassified ? <Text style={styles.unclassifiedNote}>{categoryCounts.unclassified} branches lack Cloud classification and remain visible under All only.</Text> : null}
    </View> : null}

    {scopedRetailerId ? <View style={styles.scopeCard}><Ionicons name="link-outline" size={18} color={FateDropColors.cyan}/><Text style={styles.scopeText}>This Local Radar view is scoped to branches tied to the same FateDrop retailer ID as {scopedName}. It does not match stores by name or infer physical stock from the retailer’s online catalogue.</Text></View> : <>
      <Text style={styles.question}>What would you like Local Radar to show?</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push({ pathname:'/local-radar-stock', params:navParams })} style={styles.actionCard}><View style={[styles.actionIcon,{backgroundColor:`${FateDropColors.mint}15`}]}><Ionicons name="storefront-outline" size={25} color={FateDropColors.mint}/></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Local Stores</Text><Text style={styles.actionMeta}>Open the full virtualised store list. Expected stock appears only from credible arrival evidence, and Confirmed only from exact physical-store evidence.</Text></View><Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright}/></Pressable>
        <Pressable onPress={() => router.push({ pathname:'/local-radar-events', params:navParams })} style={styles.actionCard}><View style={[styles.actionIcon,{backgroundColor:`${FateDropColors.violetLight}15`}]}><Ionicons name="calendar-outline" size={25} color={FateDropColors.violetLight}/></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Events</Text><Text style={styles.actionMeta}>Card shows, trade nights, tournaments and collector activity around you.</Text></View><Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright}/></Pressable>
      </View>
    </>}

    {area ? <><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{scopedRetailerId ? `Nearby ${scopedName} branches` : 'Nearby stores'}</Text><Text style={styles.sectionMeta}>{previewLimited ? `Showing the first ${STORE_PREVIEW_LIMIT} of ${filteredShops.length}. Open Local Stores for the full list.` : 'In-store confirmed, then Expected, Reported, no longer confirmed, and Unknown; distance breaks ties.'}</Text></View>{prioritizedShops.map(shop => { const expectedStock = expectedStockForShop(shop); return <Pressable key={shop.id} onPress={() => router.push({ pathname:'/local-radar-store', params:{ id:shop.id, ...navParams } })} style={styles.storeRow}><View style={[styles.storeDot,{backgroundColor:markerColor(shop)}]}/><View style={styles.storeCopy}><Text style={styles.storeName}>{shop.name}</Text><Text style={styles.storeMeta}>{storeTypeLabel(shop)} · {shopSignal(shop)} · {shop.distanceMiles != null ? `${shop.distanceMiles.toFixed(1)} miles` : shop.postcode || 'distance pending'}</Text>{expectedStock ? <Text style={styles.storeMeta}>{expectedStock.title}{expectedStock.label ? ` · ${expectedStock.label}` : ''}</Text> : null}</View><Ionicons name="chevron-forward" size={16} color={FateDropColors.muted}/></Pressable>; })}</> : null}

    <View style={styles.truthCard}><Ionicons name="shield-checkmark-outline" size={19} color={FateDropColors.goldBright}/><Text style={styles.truthText}>All physical availability intelligence stays in Echo. A store pin proves location evidence only; In-store confirmed requires fresh exact-branch proof. Expected and Reported are advisory, expiry never creates Vanished, and online stock remains separate.</Text></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:16,paddingBottom:120},topRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8},back:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},titleWrap:{flex:1},eyebrow:{color:FateDropColors.goldBright,fontSize:8,fontWeight:'900',letterSpacing:1.1},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:19,lineHeight:22,fontWeight:'700',marginTop:1},searchCard:{padding:11,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:10,marginBottom:2},locate:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,padding:10,borderRadius:11,backgroundColor:FateDropColors.violet},locateText:{color:FateDropColors.text,fontWeight:'900',fontSize:11},manual:{flexDirection:'row',gap:7,marginTop:7},input:{flex:1,color:FateDropColors.text,paddingHorizontal:11,paddingVertical:9,borderRadius:10,backgroundColor:FateDropColors.cardElevated,fontSize:11},setButton:{justifyContent:'center',paddingHorizontal:16,borderRadius:10,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:9,marginTop:7},radiusRow:{flexDirection:'row',gap:6,marginTop:8},radiusChip:{flex:1,alignItems:'center',paddingVertical:7,borderRadius:9,backgroundColor:FateDropColors.cardElevated,borderWidth:1,borderColor:'transparent'},radiusChipActive:{borderColor:FateDropColors.gold},radiusText:{color:FateDropColors.muted,fontSize:9,fontWeight:'800'},radiusTextActive:{color:FateDropColors.goldBright},mapShell:{overflow:'hidden',borderRadius:22,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.cardElevated},mapLegend:{position:'absolute',top:10,left:10,flexDirection:'row',gap:7,paddingHorizontal:9,paddingVertical:7,borderRadius:12,backgroundColor:'rgba(8,14,20,.88)'},legendItem:{flexDirection:'row',alignItems:'center',gap:4},dot:{width:7,height:7,borderRadius:4},legendText:{color:FateDropColors.text,fontSize:8,fontWeight:'800'},mapStats:{position:'absolute',top:44,left:10,right:10,flexDirection:'row',flexWrap:'wrap',gap:5},clusterMarker:{minWidth:38,height:38,paddingHorizontal:8,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.violet,borderWidth:2,borderColor:FateDropColors.goldBright},clusterCount:{color:FateDropColors.text,fontSize:11,fontWeight:'900'},mapPrompt:{position:'absolute',top:'35%',left:30,right:30,alignItems:'center',padding:18,borderRadius:17,backgroundColor:'rgba(8,14,20,.90)'},mapPromptTitle:{color:FateDropColors.text,fontSize:16,fontWeight:'900',marginTop:5},mapPromptCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:15,textAlign:'center',marginTop:3},selectedCard:{position:'absolute',left:10,right:10,bottom:10,flexDirection:'row',alignItems:'center',gap:10,padding:11,borderRadius:15,backgroundColor:'rgba(8,14,20,.95)',borderWidth:1,borderColor:FateDropColors.border},selectedCopy:{flex:1},selectedSignal:{fontSize:8,fontWeight:'900',letterSpacing:.7},selectedName:{color:FateDropColors.text,fontSize:13,fontWeight:'900',marginTop:2},selectedMeta:{color:FateDropColors.muted,fontSize:9,marginTop:3},selectedButton:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:12,paddingVertical:9,borderRadius:10,backgroundColor:FateDropColors.violet},selectedButtonText:{color:FateDropColors.text,fontSize:10,fontWeight:'900'},storeFilterCard:{padding:11,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:9},filterHeader:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:8},filterTitle:{color:FateDropColors.text,fontSize:12,fontWeight:'900'},filterMeta:{color:FateDropColors.muted,fontSize:8},storeFilterRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},storeFilterChip:{paddingHorizontal:10,paddingVertical:8,borderRadius:11,backgroundColor:FateDropColors.cardElevated,borderWidth:1,borderColor:'transparent'},storeFilterChipActive:{borderColor:FateDropColors.gold,backgroundColor:`${FateDropColors.gold}12`},storeFilterText:{color:FateDropColors.muted,fontSize:9,fontWeight:'800'},storeFilterTextActive:{color:FateDropColors.goldBright},unclassifiedNote:{color:FateDropColors.coral,fontSize:8,lineHeight:12,marginTop:7},question:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginTop:16,marginBottom:9},actions:{gap:8},actionCard:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},actionIcon:{width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center'},actionCopy:{flex:1},actionTitle:{color:FateDropColors.text,fontSize:15,fontWeight:'900'},actionMeta:{color:FateDropColors.secondary,fontSize:10,lineHeight:15,marginTop:3},scopeCard:{flexDirection:'row',gap:9,padding:13,borderRadius:15,marginTop:12,backgroundColor:`${FateDropColors.cyan}0B`,borderWidth:1,borderColor:`${FateDropColors.cyan}22`},scopeText:{flex:1,color:FateDropColors.secondary,fontSize:9,lineHeight:14},sectionHead:{marginTop:20,marginBottom:8},sectionTitle:{color:FateDropColors.text,fontSize:17,fontWeight:'900'},sectionMeta:{color:FateDropColors.muted,fontSize:9,marginTop:2},storeRow:{flexDirection:'row',alignItems:'center',gap:9,padding:11,borderRadius:14,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:7},storeDot:{width:9,height:9,borderRadius:5},storeCopy:{flex:1},storeName:{color:FateDropColors.text,fontSize:12,fontWeight:'900'},storeMeta:{color:FateDropColors.muted,fontSize:9,marginTop:2},truthCard:{flexDirection:'row',gap:9,padding:13,borderRadius:15,marginTop:16,backgroundColor:`${FateDropColors.gold}0B`,borderWidth:1,borderColor:`${FateDropColors.gold}22`},truthText:{flex:1,color:FateDropColors.secondary,fontSize:9,lineHeight:14}
});
