import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';
import { areaParams, fetchLocalRadar, shopSignal, type RadarResponse, type RadarShop } from '@/services/local-radar-intelligence';

const adapter = new ExpoLocationAdapter();
const UK_REGION: Region = { latitude: 52.7, longitude: -1.5, latitudeDelta: 8.2, longitudeDelta: 7.6 };

function markerColor(shop: RadarShop) {
  const signal = shopSignal(shop);
  if (signal === 'LOCAL MANIFESTED') return FateDropColors.mint;
  if (signal === 'LOCAL ECHO') return FateDropColors.cyan;
  if (signal === 'LOCAL WHISPER') return FateDropColors.violetLight;
  if (signal === 'LOCAL VANISHED') return FateDropColors.coral;
  return FateDropColors.goldBright;
}

function regionFor(area: UserArea | undefined, shops: RadarShop[]): Region {
  if (area?.latitude !== undefined && area.longitude !== undefined) {
    return { latitude: area.latitude, longitude: area.longitude, latitudeDelta: 0.28, longitudeDelta: 0.28 };
  }
  const mapped = shops.filter(shop => typeof shop.latitude === 'number' && typeof shop.longitude === 'number');
  if (mapped.length) {
    const latitude = mapped.reduce((sum, shop) => sum + Number(shop.latitude), 0) / mapped.length;
    const longitude = mapped.reduce((sum, shop) => sum + Number(shop.longitude), 0) / mapped.length;
    return { latitude, longitude, latitudeDelta: 0.32, longitudeDelta: 0.32 };
  }
  return UK_REGION;
}

export default function LocalRadarScreen() {
  const { height } = useWindowDimensions();
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState(25);
  const [shops, setShops] = useState<RadarShop[]>([]);
  const [counts, setCounts] = useState<RadarResponse['counts']>({});
  const [selected, setSelected] = useState<RadarShop | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState<Region>(UK_REGION);

  const load = useCallback(async (nextArea: UserArea, nextRadius = radius) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLocalRadar(nextArea, nextRadius, 'shops');
      const nextShops = payload.shops || [];
      setShops(nextShops);
      setCounts(payload.counts || {});
      setRegion(regionFor(nextArea, nextShops));
      setSelected(current => current ? nextShops.find(shop => shop.id === current.id) || null : null);
    } catch (reason) {
      setShops([]);
      setCounts({});
      setSelected(null);
      setError(reason instanceof Error && reason.message === 'INVALID_POSTCODE' ? 'Enter a valid UK postcode.' : 'Local Radar could not reach the physical-store network.');
    } finally {
      setLoading(false);
    }
  }, [radius]);

  useEffect(() => { if (area) void load(area, radius); }, [area, radius, load]);

  const handleDeviceLocation = async () => {
    setLoading(true);
    setError('');
    try { setArea(await adapter.requestCurrentArea()); }
    catch (reason) {
      setLoading(false);
      setError(reason instanceof Error && reason.message === 'LOCATION_DENIED' ? 'Location permission was denied. Enter a postcode instead.' : 'Location could not be determined.');
    }
  };

  const handlePostcodeSearch = async () => {
    setError('');
    try { setArea(await adapter.fromPostcode(postcode)); }
    catch { setError('Enter a valid UK postcode.'); }
  };

  const mappedShops = useMemo(() => shops.filter(shop => typeof shop.latitude === 'number' && typeof shop.longitude === 'number'), [shops]);
  const nearest = useMemo(() => [...shops].sort((a,b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)).slice(0, 5), [shops]);
  const confirmed = (counts?.localInStockBranches || 0) + (counts?.localLowStockBranches || 0);
  const incoming = counts?.incomingWatchBranches || 0;
  const navParams = areaParams(area, radius);
  const mapHeight = Math.max(350, Math.min(520, height * 0.52));

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/></Pressable>
      <View style={styles.titleWrap}><Text style={styles.eyebrow}>FATE NETWORK · LOCAL RADAR</Text><Text style={styles.title}>What is happening around you?</Text></View>
    </View>

    <View style={styles.searchCard}>
      <Pressable onPress={() => void handleDeviceLocation()} disabled={loading} style={styles.locate}><Ionicons name="locate" size={16} color={FateDropColors.text}/><Text style={styles.locateText}>{loading ? 'Scanning…' : 'Use my location'}</Text></Pressable>
      <View style={styles.manual}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.input}/><Pressable onPress={() => void handlePostcodeSearch()} style={styles.setButton}><Text style={styles.locateText}>Set</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {area ? <View style={styles.radiusRow}>{[5,10,25,50].map(value => <Pressable key={value} onPress={() => setRadius(value)} style={[styles.radiusChip, radius === value && styles.radiusChipActive]}><Text style={[styles.radiusText, radius === value && styles.radiusTextActive]}>{value} mi</Text></Pressable>)}</View> : null}
    </View>

    <View style={[styles.mapShell, { height: mapHeight }]}>
      <MapView style={StyleSheet.absoluteFill} region={region} onRegionChangeComplete={setRegion} showsUserLocation={area?.source === 'DEVICE'} showsMyLocationButton={false}>
        {mappedShops.map(shop => <Marker key={shop.id} coordinate={{ latitude: Number(shop.latitude), longitude: Number(shop.longitude) }} pinColor={markerColor(shop)} title={shop.name} description={shopSignal(shop)} onPress={() => setSelected(shop)}/>)}
      </MapView>
      <View style={styles.mapLegend}><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.mint}]}/><Text style={styles.legendText}>Physical</Text></View><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.cyan}]}/><Text style={styles.legendText}>Preparing</Text></View><View style={styles.legendItem}><View style={[styles.dot,{backgroundColor:FateDropColors.goldBright}]}/><Text style={styles.legendText}>Nearby</Text></View></View>
      {area ? <View style={styles.mapStats}><StatusBadge label={`${shops.length} stores`} color={FateDropColors.violetLight}/><StatusBadge label={`${confirmed} physical`} color={FateDropColors.mint}/><StatusBadge label={`${incoming} preparing`} color={FateDropColors.cyan}/></View> : null}
      {!area ? <View style={styles.mapPrompt}><Ionicons name="navigate-circle-outline" size={36} color={FateDropColors.goldBright}/><Text style={styles.mapPromptTitle}>Search your area</Text><Text style={styles.mapPromptCopy}>Nearby Pokémon-selling stores will appear here as real map pins.</Text></View> : null}
      {selected ? <View style={styles.selectedCard}>
        <View style={styles.selectedCopy}><Text style={[styles.selectedSignal,{color:markerColor(selected)}]}>{shopSignal(selected)}</Text><Text style={styles.selectedName}>{selected.name}</Text><Text style={styles.selectedMeta}>{selected.distanceMiles != null ? `${selected.distanceMiles.toFixed(1)} miles · ` : ''}{selected.address || selected.postcode || 'Location pending'}</Text></View>
        <Pressable onPress={() => router.push({ pathname:'/local-radar-store', params:{ id:selected.id, ...navParams } })} style={styles.selectedButton}><Text style={styles.selectedButtonText}>Open</Text><Ionicons name="chevron-forward" size={15} color={FateDropColors.text}/></Pressable>
      </View> : null}
    </View>

    <Text style={styles.question}>What would you like Local Radar to show?</Text>
    <View style={styles.actions}>
      <Pressable onPress={() => router.push({ pathname:'/local-radar-stock', params:navParams })} style={styles.actionCard}><View style={[styles.actionIcon,{backgroundColor:`${FateDropColors.mint}15`}]}><Ionicons name="storefront-outline" size={25} color={FateDropColors.mint}/></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Physical In-Store Stock</Text><Text style={styles.actionMeta}>Nearby branches, early preparation, confirmed physical stock, expected arrival windows and value intelligence.</Text></View><Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright}/></Pressable>
      <Pressable onPress={() => router.push({ pathname:'/local-radar-events', params:navParams })} style={styles.actionCard}><View style={[styles.actionIcon,{backgroundColor:`${FateDropColors.violetLight}15`}]}><Ionicons name="calendar-outline" size={25} color={FateDropColors.violetLight}/></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Events</Text><Text style={styles.actionMeta}>Card shows, trade nights, tournaments and collector activity around you.</Text></View><Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright}/></Pressable>
    </View>

    {area ? <><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Nearest stores</Text><Text style={styles.sectionMeta}>Tap a branch for its intelligence rundown</Text></View>{nearest.map(shop => <Pressable key={shop.id} onPress={() => router.push({ pathname:'/local-radar-store', params:{ id:shop.id, ...navParams } })} style={styles.storeRow}><View style={[styles.storeDot,{backgroundColor:markerColor(shop)}]}/><View style={styles.storeCopy}><Text style={styles.storeName}>{shop.name}</Text><Text style={styles.storeMeta}>{shopSignal(shop)} · {shop.distanceMiles != null ? `${shop.distanceMiles.toFixed(1)} miles` : shop.postcode || 'distance pending'}</Text></View><Ionicons name="chevron-forward" size={16} color={FateDropColors.muted}/></Pressable>)}</> : null}

    <View style={styles.truthCard}><Ionicons name="shield-checkmark-outline" size={19} color={FateDropColors.goldBright}/><Text style={styles.truthText}>A store pin means the branch is nearby — not that stock is guaranteed. Physical availability and expected arrival dates only appear when FateDrop has location-level evidence. Online stock remains separate.</Text></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:16,paddingBottom:120},topRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},back:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},titleWrap:{flex:1},eyebrow:{color:FateDropColors.goldBright,fontSize:8,fontWeight:'900',letterSpacing:1.1},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:22,fontWeight:'700',marginTop:2},searchCard:{padding:11,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:10},locate:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,padding:10,borderRadius:11,backgroundColor:FateDropColors.violet},locateText:{color:FateDropColors.text,fontWeight:'900',fontSize:11},manual:{flexDirection:'row',gap:7,marginTop:7},input:{flex:1,color:FateDropColors.text,paddingHorizontal:11,paddingVertical:9,borderRadius:10,backgroundColor:FateDropColors.cardElevated,fontSize:11},setButton:{justifyContent:'center',paddingHorizontal:16,borderRadius:10,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:9,marginTop:7},radiusRow:{flexDirection:'row',gap:6,marginTop:8},radiusChip:{flex:1,alignItems:'center',paddingVertical:7,borderRadius:9,backgroundColor:FateDropColors.cardElevated,borderWidth:1,borderColor:'transparent'},radiusChipActive:{borderColor:FateDropColors.gold},radiusText:{color:FateDropColors.muted,fontSize:9,fontWeight:'800'},radiusTextActive:{color:FateDropColors.goldBright},mapShell:{overflow:'hidden',borderRadius:22,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.cardElevated},mapLegend:{position:'absolute',top:10,left:10,flexDirection:'row',gap:7,paddingHorizontal:9,paddingVertical:7,borderRadius:12,backgroundColor:'rgba(8,14,20,.88)'},legendItem:{flexDirection:'row',alignItems:'center',gap:4},dot:{width:7,height:7,borderRadius:4},legendText:{color:FateDropColors.text,fontSize:8,fontWeight:'800'},mapStats:{position:'absolute',top:44,left:10,right:10,flexDirection:'row',flexWrap:'wrap',gap:5},mapPrompt:{position:'absolute',top:'35%',left:30,right:30,alignItems:'center',padding:18,borderRadius:17,backgroundColor:'rgba(8,14,20,.90)'},mapPromptTitle:{color:FateDropColors.text,fontSize:16,fontWeight:'900',marginTop:5},mapPromptCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:15,textAlign:'center',marginTop:3},selectedCard:{position:'absolute',left:10,right:10,bottom:10,flexDirection:'row',alignItems:'center',gap:10,padding:11,borderRadius:15,backgroundColor:'rgba(8,14,20,.95)',borderWidth:1,borderColor:FateDropColors.border},selectedCopy:{flex:1},selectedSignal:{fontSize:8,fontWeight:'900',letterSpacing:.7},selectedName:{color:FateDropColors.text,fontSize:13,fontWeight:'900',marginTop:2},selectedMeta:{color:FateDropColors.muted,fontSize:9,marginTop:3},selectedButton:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:12,paddingVertical:9,borderRadius:10,backgroundColor:FateDropColors.violet},selectedButtonText:{color:FateDropColors.text,fontSize:10,fontWeight:'900'},question:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginTop:18,marginBottom:9},actions:{gap:8},actionCard:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},actionIcon:{width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center'},actionCopy:{flex:1},actionTitle:{color:FateDropColors.text,fontSize:15,fontWeight:'900'},actionMeta:{color:FateDropColors.secondary,fontSize:10,lineHeight:15,marginTop:3},sectionHead:{marginTop:20,marginBottom:8},sectionTitle:{color:FateDropColors.text,fontSize:17,fontWeight:'900'},sectionMeta:{color:FateDropColors.muted,fontSize:9,marginTop:2},storeRow:{flexDirection:'row',alignItems:'center',gap:9,padding:11,borderRadius:14,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:7},storeDot:{width:10,height:10,borderRadius:5},storeCopy:{flex:1},storeName:{color:FateDropColors.text,fontSize:12,fontWeight:'900'},storeMeta:{color:FateDropColors.muted,fontSize:9,marginTop:3},truthCard:{flexDirection:'row',gap:9,padding:13,borderRadius:15,backgroundColor:`${FateDropColors.gold}0D`,borderWidth:1,borderColor:`${FateDropColors.gold}25`,marginTop:16},truthText:{flex:1,color:FateDropColors.secondary,fontSize:9,lineHeight:14}
});
