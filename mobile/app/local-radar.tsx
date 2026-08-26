import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';

type RadarPoint = {
  id: string;
  itemType?: 'shop' | 'event';
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceMiles?: number | null;
  retailerId?: string | null;
  localStockStatus?: string | null;
  localStockEvidence?: { lifecycleState?: string | null; verifiedBranchStock?: boolean | null } | null;
  startDateTime?: string | null;
  venueName?: string | null;
};

type RadarResponse = {
  success?: boolean;
  error?: string;
  shops?: RadarPoint[];
  events?: RadarPoint[];
  counts?: {
    shops?: number;
    events?: number;
    localInStockBranches?: number;
    localLowStockBranches?: number;
    incomingWatchBranches?: number;
  };
};

const locationAdapter = new ExpoLocationAdapter();

function hasCoords(point: RadarPoint) {
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude)
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude);
}

function shopMarkerLabel(shop: RadarPoint) {
  const lifecycle = String(shop.localStockEvidence?.lifecycleState || '').toLowerCase();
  if (shop.localStockEvidence?.verifiedBranchStock && lifecycle === 'manifested') return 'Verified physical stock';
  if (lifecycle === 'echo') return 'Preparation detected';
  if (lifecycle === 'whisper' || shop.localStockStatus === 'incoming_watch') return 'Incoming watch';
  return 'Nearby Pokémon retailer';
}

export default function LocalRadarScreen() {
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [shops, setShops] = useState<RadarPoint[]>([]);
  const [events, setEvents] = useState<RadarPoint[]>([]);
  const [counts, setCounts] = useState<RadarResponse['counts']>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextArea: UserArea) => {
    setLoading(true);
    setError('');
    try {
      const params = ['types=shops%2Cevents', 'radiusMiles=25'];
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
      setEvents(payload.events || []);
      setCounts(payload.counts || {});
    } catch {
      setShops([]);
      setEvents([]);
      setCounts({});
      setError('Local Radar could not load nearby intelligence. Try your postcode or location again.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const markers = useMemo(() => [...shops, ...events].filter(hasCoords), [shops, events]);
  const firstMarker = markers[0];
  const mapCenter = area?.source === 'DEVICE' && area.latitude !== undefined && area.longitude !== undefined
    ? { latitude: area.latitude, longitude: area.longitude }
    : firstMarker && hasCoords(firstMarker)
      ? { latitude: firstMarker.latitude as number, longitude: firstMarker.longitude as number }
      : { latitude: 52.5, longitude: -1.5 };
  const confirmed = (counts?.localInStockBranches || 0) + (counts?.localLowStockBranches || 0);

  return <SafeAreaView style={styles.safe}>
    <FateDropBackground />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>LOCAL RADAR</Text>
      <Text style={styles.title}>What is happening near you?</Text>
      <Text style={styles.subtitle}>Find physical Pokémon stock before it disappears, or discover nearby card shows, events and vendors.</Text>

      <View style={styles.locationCard}>
        <Text style={styles.locationTitle}>Set your area</Text>
        <Text style={styles.locationText}>Use your device location or a postcode. FateDrop uses it only to calculate nearby Local Radar results.</Text>
        <Pressable onPress={() => void handleDeviceLocation()} disabled={loading} style={styles.primaryButton}>
          <Ionicons name="locate" size={18} color={FateDropColors.text}/><Text style={styles.primaryButtonText}>{loading ? 'Scanning…' : 'Use my location'}</Text>
        </Pressable>
        <View style={styles.postcodeRow}>
          <TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.postcodeInput}/>
          <Pressable onPress={() => void handlePostcodeScan()} style={styles.postcodeButton}><Text style={styles.postcodeButtonText}>Scan</Text></Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.mapShell}>
        <MapView
          style={styles.map}
          region={{ ...mapCenter, latitudeDelta: 0.35, longitudeDelta: 0.35 }}
          showsUserLocation={area?.source === 'DEVICE'}
          showsMyLocationButton={false}
        >
          {shops.filter(hasCoords).map(shop => <Marker
            key={`shop:${shop.id}`}
            coordinate={{ latitude: shop.latitude as number, longitude: shop.longitude as number }}
            title={shop.name}
            description={shopMarkerLabel(shop)}
            pinColor={shop.localStockEvidence?.verifiedBranchStock ? FateDropColors.mint : FateDropColors.cyan}
            onCalloutPress={() => router.push('/local-radar-stock')}
          />)}
          {events.filter(hasCoords).map(event => <Marker
            key={`event:${event.id}`}
            coordinate={{ latitude: event.latitude as number, longitude: event.longitude as number }}
            title={event.name}
            description={event.startDateTime ? new Date(event.startDateTime).toLocaleDateString('en-GB') : event.venueName || 'Nearby event'}
            pinColor={FateDropColors.violetLight}
            onCalloutPress={() => router.push({ pathname: '/encounters/detail', params: { id: event.id } })}
          />)}
        </MapView>
        {!area ? <View style={styles.mapOverlay}><Ionicons name="navigate-circle" size={32} color={FateDropColors.cyan}/><Text style={styles.mapOverlayTitle}>Your Local Radar map</Text><Text style={styles.mapOverlayText}>Choose a location to reveal nearby stores, physical-stock intelligence and events.</Text></View> : null}
      </View>

      {area ? <View style={styles.stats}>
        <StatusBadge label={`${shops.length} stores`} color={FateDropColors.cyan}/>
        <StatusBadge label={`${confirmed} stock confirmed`} color={FateDropColors.mint}/>
        <StatusBadge label={`${counts?.incomingWatchBranches || 0} incoming watches`} color={FateDropColors.cyan}/>
        <StatusBadge label={`${events.length} events`} color={FateDropColors.violetLight}/>
      </View> : null}

      <Text style={styles.chooseTitle}>Which radar do you need?</Text>
      <Pressable onPress={() => router.push('/local-radar-stock')} style={styles.toolCard}>
        <View style={styles.toolIcon}><Ionicons name="storefront" size={24} color={FateDropColors.mint}/></View>
        <View style={styles.toolCopy}><Text style={styles.toolTitle}>Physical In-Store Stock</Text><Text style={styles.toolText}>Map nearby Pokémon retailers, see verified branch stock, preparation signals and incoming-stock intelligence with confidence and freshness.</Text></View>
        <Ionicons name="chevron-forward" size={20} color={FateDropColors.muted}/>
      </Pressable>

      <Pressable onPress={() => router.push('/encounters')} style={styles.toolCard}>
        <View style={styles.toolIcon}><Ionicons name="calendar" size={24} color={FateDropColors.violetLight}/></View>
        <View style={styles.toolCopy}><Text style={styles.toolTitle}>Events & Card Shows</Text><Text style={styles.toolText}>Find physical card shows, trade nights, tournaments, vendors, dates, venues and entry information near you.</Text></View>
        <Ionicons name="chevron-forward" size={20} color={FateDropColors.muted}/>
      </Pressable>

      <View style={styles.truthCard}>
        <Ionicons name="shield-checkmark" size={18} color={FateDropColors.cyan}/>
        <Text style={styles.truthText}>FateDrop separates verified physical stock from preparation and unconfirmed local intelligence. Expected stock is never presented as guaranteed branch stock.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},
  content:{paddingHorizontal:18,paddingBottom:70},
  back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},
  eyebrow:{color:FateDropColors.cyan,fontSize:11,fontWeight:'900',letterSpacing:1.6,marginTop:8},
  title:{color:FateDropColors.text,fontSize:31,fontWeight:'900',lineHeight:36,marginTop:5},
  subtitle:{color:FateDropColors.secondary,fontSize:13,lineHeight:20,marginTop:9,marginBottom:16},
  locationCard:{padding:15,borderRadius:20,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},
  locationTitle:{color:FateDropColors.text,fontSize:16,fontWeight:'900'},locationText:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:5,marginBottom:10},
  primaryButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:12,borderRadius:13,backgroundColor:FateDropColors.violet},primaryButtonText:{color:FateDropColors.text,fontWeight:'900'},
  postcodeRow:{flexDirection:'row',gap:8,marginTop:9},postcodeInput:{flex:1,color:FateDropColors.text,padding:11,borderRadius:12,backgroundColor:FateDropColors.cardElevated},postcodeButton:{justifyContent:'center',paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.cardElevated},postcodeButtonText:{color:FateDropColors.text,fontWeight:'900'},
  error:{color:FateDropColors.coral,fontSize:10,marginTop:8},
  mapShell:{height:410,borderRadius:24,overflow:'hidden',marginTop:16,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.cardElevated},map:{...StyleSheet.absoluteFillObject},
  mapOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',padding:35,backgroundColor:'rgba(8,8,18,0.86)'},mapOverlayTitle:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginTop:8},mapOverlayText:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,textAlign:'center',marginTop:5},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12},
  chooseTitle:{color:FateDropColors.text,fontSize:20,fontWeight:'900',marginTop:24,marginBottom:10},
  toolCard:{flexDirection:'row',alignItems:'center',gap:12,padding:15,borderRadius:20,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:10},toolIcon:{width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.cardElevated},toolCopy:{flex:1},toolTitle:{color:FateDropColors.text,fontSize:15,fontWeight:'900'},toolText:{color:FateDropColors.muted,fontSize:10,lineHeight:15,marginTop:4},
  truthCard:{flexDirection:'row',gap:10,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:4},truthText:{flex:1,color:FateDropColors.secondary,fontSize:10,lineHeight:16}
});
