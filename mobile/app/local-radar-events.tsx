import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';
import { areaFromParams, fetchLocalRadar, type RadarEvent } from '@/services/local-radar-intelligence';

type DateWindow = 'all' | '30' | '90';
type RadarRouteParams = Record<string, string | string[] | undefined>;
const adapter = new ExpoLocationAdapter();

function currentTimestamp() {
  return Date.now();
}

export default function LocalRadarEventsScreen() {
  const params = useLocalSearchParams() as RadarRouteParams;
  const initialArea = useMemo(() => areaFromParams(params), [params]);
  const initialRadius = typeof params.radiusMiles === 'string' ? Number(params.radiusMiles) : 25;
  const [area, setArea] = useState<UserArea | undefined>(initialArea);
  const [radius, setRadius] = useState(Number.isFinite(initialRadius) ? initialRadius : 25);
  const [postcode, setPostcode] = useState(initialArea?.postcode || '');
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [referenceTime, setReferenceTime] = useState(0);
  const [dateWindow, setDateWindow] = useState<DateWindow>('90');
  const [eventType, setEventType] = useState('All types');
  const [organiser, setOrganiser] = useState('All organisers');

  const load = useCallback(async (nextArea: UserArea, nextRadius = radius) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLocalRadar(nextArea, nextRadius, 'events');
      setReferenceTime(currentTimestamp());
      setEvents(payload.events || []);
    } catch (reason) {
      setEvents([]);
      setError(reason instanceof Error && reason.message === 'INVALID_POSTCODE' ? 'Enter a valid UK postcode.' : 'Nearby events could not be loaded from Local Radar.');
    } finally {
      setLoading(false);
    }
  }, [radius]);

  useEffect(() => {
    if (area) void Promise.resolve().then(() => load(area, radius));
  }, [area, radius, load]);

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

  const types = useMemo(() => ['All types', ...new Set(events.flatMap(event => event.categories || []))], [events]);
  const organisers = useMemo(() => ['All organisers', ...new Set(events.map(event => event.organiserName).filter((value): value is string => Boolean(value)))], [events]);
  const filtered = useMemo(() => events.filter(event => {
    if (event.startDateTime && referenceTime > 0) {
      const days = (Date.parse(event.startDateTime) - referenceTime) / 86400000;
      if (dateWindow !== 'all' && (days < 0 || days > Number(dateWindow))) return false;
    }
    if (eventType !== 'All types' && !event.categories?.includes(eventType)) return false;
    if (organiser !== 'All organisers' && event.organiserName !== organiser) return false;
    return true;
  }), [dateWindow, eventType, events, organiser, referenceTime]);

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Local Radar</Text></Pressable>
    <AbstractHero eyebrow="Events Radar" title="Find the collector scene nearby." subtitle="Card shows, trade nights, tournaments and community events — the original Local Radar experience, now separated from physical-stock intelligence." icon="calendar"/>
    <View style={styles.locationCard}>
      <Text style={styles.locationTitle}>Search nearby events</Text>
      <Text style={styles.locationCopy}>Use device location for distance filtering or enter a UK postcode instead.</Text>
      <Pressable onPress={() => void handleDeviceLocation()} disabled={loading} style={styles.primary}><Ionicons name="locate" size={17} color={FateDropColors.text}/><Text style={styles.primaryText}>{loading ? 'Checking events…' : 'Use my location'}</Text></Pressable>
      <View style={styles.manual}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.input}/><Pressable onPress={() => void handlePostcodeSearch()} style={styles.setButton}><Text style={styles.primaryText}>Set</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
    {area ? <><Text style={styles.heading}>Radius</Text><View style={styles.filters}>{[5,10,25,50].map(value => <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => setRadius(value)}/>)}</View></> : null}
    <Text style={styles.heading}>Date range</Text><View style={styles.filters}>{(['all','30','90'] as DateWindow[]).map(value => <FilterChip key={value} label={value === 'all' ? 'All dates' : `Next ${value} days`} active={dateWindow === value} onPress={() => setDateWindow(value)}/>)}</View>
    <Text style={styles.heading}>Event type</Text><FlatList horizontal data={types} keyExtractor={item => item} renderItem={({item}) => <FilterChip label={item} active={eventType === item} onPress={() => setEventType(item)}/>} contentContainerStyle={styles.horizontal} showsHorizontalScrollIndicator={false}/>
    <Text style={styles.heading}>Organiser</Text><FlatList horizontal data={organisers} keyExtractor={item => item} renderItem={({item}) => <FilterChip label={item} active={organiser === item} onPress={() => setOrganiser(item)}/>} contentContainerStyle={styles.horizontal} showsHorizontalScrollIndicator={false}/>
    <View style={styles.listHeading}><Text style={styles.heading}>Upcoming activity</Text><StatusBadge label={`${filtered.length} results`} color={FateDropColors.cyan}/></View>
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground/><FlatList
    data={filtered}
    keyExtractor={item => item.id}
    contentContainerStyle={styles.content}
    ListHeaderComponent={header}
    ListEmptyComponent={<Text style={styles.empty}>{area ? 'No events match this location and filter combination.' : 'Choose a location to search nearby events.'}</Text>}
    renderItem={({item}) => <Pressable onPress={() => router.push({ pathname: '/encounters/detail', params: { id: item.id } })} style={styles.card}>
      <View style={styles.icon}><Ionicons name="calendar" size={20} color={FateDropColors.violetLight}/></View>
      <View style={styles.flex}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.startDateTime ? new Date(item.startDateTime).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) : 'Date TBC'} · {item.venueName || item.townCity || 'Venue TBC'}</Text><Text style={styles.meta}>{item.distanceMiles != null ? `${item.distanceMiles.toFixed(1)} miles · ` : ''}{item.postcode || 'Location pending'}</Text></View>
      <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted}/>
    </Pressable>}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:110},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},locationCard:{padding:15,borderRadius:19,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},locationTitle:{color:FateDropColors.text,fontWeight:'900',fontSize:15},locationCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginVertical:7},primary:{flexDirection:'row',justifyContent:'center',gap:7,padding:12,borderRadius:13,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontWeight:'900'},manual:{flexDirection:'row',gap:8,marginTop:9},input:{flex:1,color:FateDropColors.text,padding:11,borderRadius:12,backgroundColor:FateDropColors.cardElevated},setButton:{justifyContent:'center',paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:10,marginTop:8},heading:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginVertical:15},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},horizontal:{gap:8,paddingBottom:4},listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},card:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:9},icon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:`${FateDropColors.violetLight}12`},flex:{flex:1},name:{color:FateDropColors.text,fontWeight:'900',fontSize:14},meta:{color:FateDropColors.muted,fontSize:10,marginTop:4},empty:{color:FateDropColors.muted,textAlign:'center',margin:35}
});
