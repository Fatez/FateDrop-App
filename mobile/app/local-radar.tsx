import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';

type DateWindow = 'all' | '30' | '90';

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
  value?: RadarValue | null;
};

type RadarShop = {
  id: string;
  name: string;
  itemType?: 'shop';
  retailerId?: string | null;
  address?: string | null;
  postcode?: string | null;
  distanceMiles?: number | null;
  networkStatus?: string | null;
  localStockStatus?: string | null;
  localStockEvidence?: {
    lifecycleState?: string | null;
    confidence?: number | null;
    freshnessAgeMinutes?: number | null;
    verifiedBranchStock?: boolean | null;
  } | null;
  localStockProducts?: RadarStockProduct[] | null;
};

type RadarEvent = {
  id: string;
  name: string;
  itemType?: 'event';
  startDateTime?: string;
  venueName?: string;
  townCity?: string;
  postcode?: string;
  categories?: string[];
  organiserName?: string;
  distanceMiles?: number | null;
};

type RadarResponse = {
  success?: boolean;
  error?: string;
  locationResolution?: { status?: string; postcode?: string | null; reason?: string | null } | null;
  shops?: RadarShop[];
  events?: RadarEvent[];
  counts?: {
    shops?: number;
    events?: number;
    localInStockBranches?: number;
    localLowStockBranches?: number;
    incomingWatchBranches?: number;
  };
};

type RadarListItem = (RadarEvent & { kind: 'EVENT'; categories: string[]; organiserName: string }) | (RadarShop & { kind: 'SHOP'; categories: string[]; organiserName: string });

const adapter = new ExpoLocationAdapter();

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

function valueLine(value?: RadarValue | null) {
  if (!value) return 'Price unknown · RRP unknown';
  const price = value.priceKnown ? money(value.itemPricePence) : null;
  const rrp = value.rrp?.known ? money(value.rrp.pence) : null;
  const delta = value.itemVsRrp?.deltaPercent;
  const parts = [price || 'Price unknown', rrp ? `RRP ${rrp}` : 'RRP unknown'];
  if (typeof delta === 'number' && Number.isFinite(delta)) {
    parts.push(Math.abs(delta) < 0.05 ? '0.0% · AT RRP' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% ${delta > 0 ? 'ABOVE' : 'BELOW'} RRP`);
  }
  return parts.join(' · ');
}

function shopCategory(shop: RadarShop) {
  if (shop.localStockEvidence?.verifiedBranchStock && ['in_stock', 'low_stock'].includes(String(shop.localStockStatus))) return 'Verified stock';
  if (shop.localStockStatus === 'incoming_watch') return 'Preparing';
  return 'Nearby shop';
}

function shopSignal(shop: RadarShop) {
  const lifecycle = String(shop.localStockEvidence?.lifecycleState || '').toLowerCase();
  if (shop.localStockEvidence?.verifiedBranchStock && lifecycle === 'manifested') return 'LOCAL MANIFESTED';
  if (lifecycle === 'echo') return 'LOCAL ECHO';
  if (lifecycle === 'whisper') return 'LOCAL WHISPER';
  if (lifecycle === 'vanished') return 'LOCAL VANISHED';
  return shop.networkStatus === 'live_connected' ? 'LIVE CONNECTED' : 'LOCAL DISCOVERY';
}

export default function LocalRadarScreen() {
  const [shops, setShops] = useState<RadarShop[]>([]);
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [counts, setCounts] = useState<RadarResponse['counts']>({});
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [error, setError] = useState('');
  const [radius, setRadius] = useState(25);
  const [dateWindow, setDateWindow] = useState<DateWindow>('90');
  const [eventType, setEventType] = useState('All types');
  const [organiser, setOrganiser] = useState('All organisers');
  const [locating, setLocating] = useState(false);

  const loadRadar = useCallback(async (nextArea: UserArea) => {
    setError('');
    setLocating(true);
    try {
      const params: string[] = [`types=shops%2Cevents`, `radiusMiles=${radius}`];
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
      if (payload.locationResolution?.status === 'invalid' || payload.locationResolution?.status === 'not_found') {
        throw new Error(payload.locationResolution.reason || 'INVALID_POSTCODE');
      }
      setShops(payload.shops || []);
      setEvents(payload.events || []);
      setCounts(payload.counts || {});
    } catch (reason) {
      setShops([]);
      setEvents([]);
      setCounts({});
      setError(reason instanceof Error && reason.message === 'INVALID_POSTCODE' ? 'Enter a valid UK postcode.' : 'Local Radar could not reach the FateDrop physical-stock network.');
    } finally {
      setLocating(false);
    }
  }, [radius]);

  useEffect(() => {
    if (area) void loadRadar(area);
  }, [area, loadRadar]);

  const device = async () => {
    setError('');
    setLocating(true);
    try {
      setArea(await adapter.requestCurrentArea());
    } catch (reason) {
      setLocating(false);
      setError(reason instanceof Error && reason.message === 'LOCATION_DENIED' ? 'Location permission was denied. Enter a postcode instead.' : 'Location could not be determined.');
    }
  };

  const manual = async () => {
    setError('');
    try {
      setArea(await adapter.fromPostcode(postcode));
    } catch {
      setError('Enter a valid UK postcode.');
    }
  };

  const allItems = useMemo<RadarListItem[]>(() => [
    ...events.map(event => ({ ...event, kind: 'EVENT' as const, categories: event.categories || ['Event'], organiserName: event.organiserName || 'Event organiser' })),
    ...shops.map(shop => ({ ...shop, kind: 'SHOP' as const, categories: [shopCategory(shop)], organiserName: shop.name })),
  ], [events, shops]);
  const types = useMemo(() => ['All types', ...new Set(allItems.flatMap(item => item.categories))], [allItems]);
  const organisers = useMemo(() => ['All organisers', ...new Set(allItems.map(item => item.organiserName))], [allItems]);
  const filtered = useMemo(() => allItems.filter(item => {
    if (item.kind === 'EVENT' && item.startDateTime) {
      const start = Date.parse(item.startDateTime);
      const days = (start - Date.now()) / 86400000;
      if (dateWindow !== 'all' && (days < 0 || days > Number(dateWindow))) return false;
    }
    if (eventType !== 'All types' && !item.categories.includes(eventType)) return false;
    if (organiser !== 'All organisers' && item.organiserName !== organiser) return false;
    return true;
  }), [allItems, dateWindow, eventType, organiser]);

  const confirmed = (counts?.localInStockBranches || 0) + (counts?.localLowStockBranches || 0);
  const incoming = counts?.incomingWatchBranches || 0;
  const areaLabel = area?.source === 'DEVICE' ? 'Device radius enabled' : area?.postcode ? `Postcode ${area.postcode}` : null;

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Back</Text></Pressable>
    <AbstractHero eyebrow="Local Radar" title="Know whether it is worth the trip." subtitle="Physical stock intelligence for nearby branches: preparation, verified availability, freshness, value and distance." icon="navigate"/>
    <View style={styles.permission}>
      <Text style={styles.permissionTitle}>Location is optional</Text>
      <Text style={styles.permissionText}>Foreground location is requested only after tapping below. A postcode can be used instead. FateDrop sends only the chosen area to Local Radar and stale physical stock expires rather than remaining labelled current.</Text>
      <Pressable onPress={() => void device()} disabled={locating} style={styles.locate}><Ionicons name="locate" size={17} color={FateDropColors.text}/><Text style={styles.locateText}>{locating ? 'Checking Local Radar…' : 'Use my location'}</Text></Pressable>
      <View style={styles.manual}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.input}/><Pressable onPress={() => void manual()} style={styles.go}><Text style={styles.locateText}>Set</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {areaLabel ? <StatusBadge label={areaLabel} color={FateDropColors.mint}/> : null}
    </View>
    {area ? <View style={styles.summary}><StatusBadge label={`${confirmed} physical`} color={FateDropColors.mint}/><StatusBadge label={`${incoming} preparing`} color={FateDropColors.cyan}/><StatusBadge label={`${shops.length} shops`} color={FateDropColors.violetLight}/></View> : null}
    {area ? <><Text style={styles.heading}>Radius</Text><View style={styles.filters}>{[5,10,25,50].map(value => <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => setRadius(value)}/>)}</View></> : null}
    <Text style={styles.heading}>Date range</Text><View style={styles.filters}>{(['all','30','90'] as DateWindow[]).map(value => <FilterChip key={value} label={value === 'all' ? 'All dates' : `Next ${value} days`} active={dateWindow === value} onPress={() => setDateWindow(value)}/>)}</View>
    <Text style={styles.heading}>Type</Text><FlatList horizontal data={types} keyExtractor={item => item} renderItem={({item}) => <FilterChip label={item} active={eventType === item} onPress={() => setEventType(item)}/>} contentContainerStyle={styles.horizontal} showsHorizontalScrollIndicator={false}/>
    <Text style={styles.heading}>Store / organiser</Text><FlatList horizontal data={organisers} keyExtractor={item => item} renderItem={({item}) => <FilterChip label={item} active={organiser === item} onPress={() => setOrganiser(item)}/>} contentContainerStyle={styles.horizontal} showsHorizontalScrollIndicator={false}/>
    <View style={styles.listHeading}><Text style={styles.heading}>Nearby intelligence</Text><StatusBadge label={`${filtered.length} results`} color={FateDropColors.cyan}/></View>
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground/><FlatList
    data={filtered}
    keyExtractor={item => `${item.kind}:${item.id}`}
    contentContainerStyle={styles.content}
    ListHeaderComponent={header}
    ListEmptyComponent={<Text style={styles.empty}>{area ? 'No verified stock, preparation evidence, shops or events match this area and filter combination.' : 'Use your location or enter a postcode to query Local Radar.'}</Text>}
    renderItem={({item}) => {
      if (item.kind === 'SHOP') {
        const product = item.localStockProducts?.[0];
        const signal = shopSignal(item);
        const manifested = signal === 'LOCAL MANIFESTED';
        const preparing = signal === 'LOCAL ECHO' || signal === 'LOCAL WHISPER';
        const meta = manifested ? 'Physical stock confirmed' : preparing ? 'Preparation detected · NOT YET CONFIRMED' : 'No verified branch stock currently';
        return <Pressable onPress={item.retailerId ? () => router.push({ pathname: '/retailers/[id]', params: { id: item.retailerId! } }) : undefined} style={styles.card}>
          <View style={styles.eventIcon}><Ionicons name="storefront" size={20} color={manifested ? FateDropColors.mint : preparing ? FateDropColors.cyan : FateDropColors.violetLight}/></View>
          <View style={{flex:1}}>
            <Text style={[styles.signal, manifested ? styles.manifested : preparing ? styles.echo : undefined]}>{signal}</Text>
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventMeta}>{product?.title || meta}</Text>
            {product ? <Text style={styles.eventMeta}>{meta} · {ageLabel(product.freshnessAgeMinutes)} · Confidence {confidenceLabel(product.confidence)}</Text> : null}
            {product ? <Text style={styles.value}>{valueLine(product.value)}</Text> : null}
            <Text style={styles.eventMeta}>{item.distanceMiles !== null && item.distanceMiles !== undefined ? `${item.distanceMiles.toFixed(1)} miles · ` : ''}{item.address || item.postcode || 'Location pending'}</Text>
            {(product?.contradictionCount || 0) > 0 ? <Text style={styles.contradiction}>{product?.contradictionCount} recent contradiction{product?.contradictionCount === 1 ? '' : 's'} reflected in confidence</Text> : null}
          </View>
          {item.retailerId ? <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted}/> : null}
        </Pressable>;
      }
      return <Pressable onPress={() => router.push({pathname:'/encounters/detail',params:{id:item.id}})} style={styles.card}>
        <View style={styles.eventIcon}><Ionicons name="calendar" size={20} color={FateDropColors.violetLight}/></View>
        <View style={{flex:1}}><Text style={styles.eventName}>{item.name}</Text><Text style={styles.eventMeta}>{item.startDateTime ? new Date(item.startDateTime).toLocaleDateString('en-GB') : 'Date TBC'} · {item.venueName || item.townCity || 'Venue TBC'}</Text><Text style={styles.eventMeta}>{item.distanceMiles !== null && item.distanceMiles !== undefined ? `${item.distanceMiles.toFixed(1)} miles · ` : ''}{item.postcode || 'Location pending'}</Text></View>
        <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted}/>
      </Pressable>;
    }}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:80},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},permission:{padding:15,borderRadius:19,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},permissionTitle:{color:FateDropColors.text,fontWeight:'900'},permissionText:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginVertical:7},locate:{flexDirection:'row',justifyContent:'center',gap:7,padding:12,borderRadius:13,backgroundColor:FateDropColors.violet},locateText:{color:FateDropColors.text,fontWeight:'900'},manual:{flexDirection:'row',gap:8,marginTop:9},input:{flex:1,color:FateDropColors.text,padding:11,borderRadius:12,backgroundColor:FateDropColors.cardElevated},go:{justifyContent:'center',paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:10,marginTop:8},summary:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},heading:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginVertical:15},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},horizontal:{gap:8,paddingBottom:4},listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},card:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:9},eventIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:`${FateDropColors.violetLight}12`},signal:{color:FateDropColors.muted,fontSize:9,fontWeight:'900',letterSpacing:.7,marginBottom:3},manifested:{color:FateDropColors.mint},echo:{color:FateDropColors.cyan},eventName:{color:FateDropColors.text,fontWeight:'900'},eventMeta:{color:FateDropColors.muted,fontSize:10,marginTop:4,lineHeight:15},value:{color:FateDropColors.secondary,fontSize:10,fontWeight:'800',marginTop:5},contradiction:{color:FateDropColors.coral,fontSize:9,marginTop:4},empty:{color:FateDropColors.muted,textAlign:'center',margin:35,lineHeight:18}
});
