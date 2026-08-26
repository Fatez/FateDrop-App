import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';
import {
  ageLabel,
  areaFromParams,
  areaParams,
  confidenceLabel,
  fetchLocalRadar,
  shopSignal,
  valueLine,
  type RadarResponse,
  type RadarShop,
} from '@/services/local-radar-intelligence';

const adapter = new ExpoLocationAdapter();

function stockStatus(shop: RadarShop) {
  const signal = shopSignal(shop);
  if (signal === 'LOCAL MANIFESTED') return { label: 'PHYSICAL STOCK CONFIRMED', color: FateDropColors.mint };
  if (signal === 'LOCAL ECHO') return { label: 'PREPARATION DETECTED · NOT YET CONFIRMED', color: FateDropColors.cyan };
  if (signal === 'LOCAL WHISPER') return { label: 'EARLY LOCAL MOVEMENT · NOT YET CONFIRMED', color: FateDropColors.violetLight };
  if (signal === 'LOCAL VANISHED') return { label: 'PREVIOUS AVAILABILITY DISAPPEARED', color: FateDropColors.coral };
  return { label: 'NO VERIFIED BRANCH STOCK CURRENTLY', color: FateDropColors.muted };
}

export default function LocalRadarStockScreen() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const initialArea = useMemo(() => areaFromParams(params), [params]);
  const initialRadius = typeof params.radiusMiles === 'string' ? Number(params.radiusMiles) : 25;
  const [area, setArea] = useState<UserArea | undefined>(initialArea);
  const [radius, setRadius] = useState(Number.isFinite(initialRadius) ? initialRadius : 25);
  const [postcode, setPostcode] = useState(initialArea?.postcode || '');
  const [shops, setShops] = useState<RadarShop[]>([]);
  const [counts, setCounts] = useState<RadarResponse['counts']>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'physical' | 'preparing'>('all');

  const load = useCallback(async (nextArea: UserArea, nextRadius = radius) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLocalRadar(nextArea, nextRadius, 'shops');
      setShops(payload.shops || []);
      setCounts(payload.counts || {});
    } catch (reason) {
      setShops([]);
      setCounts({});
      setError(reason instanceof Error && reason.message === 'INVALID_POSTCODE' ? 'Enter a valid UK postcode.' : 'Physical Local Radar could not reach the FateDrop branch-intelligence network.');
    } finally {
      setLoading(false);
    }
  }, [radius]);

  useEffect(() => {
    if (area) void load(area, radius);
  }, [area, radius, load]);

  const useDevice = async () => {
    setLoading(true);
    setError('');
    try { setArea(await adapter.requestCurrentArea()); }
    catch (reason) {
      setLoading(false);
      setError(reason instanceof Error && reason.message === 'LOCATION_DENIED' ? 'Location permission was denied. Enter a postcode instead.' : 'Location could not be determined.');
    }
  };

  const usePostcode = async () => {
    setError('');
    try { setArea(await adapter.fromPostcode(postcode)); }
    catch { setError('Enter a valid UK postcode.'); }
  };

  const filtered = useMemo(() => shops.filter(shop => {
    const signal = shopSignal(shop);
    if (filter === 'physical') return signal === 'LOCAL MANIFESTED';
    if (filter === 'preparing') return signal === 'LOCAL ECHO' || signal === 'LOCAL WHISPER';
    return true;
  }), [filter, shops]);

  const confirmed = (counts?.localInStockBranches || 0) + (counts?.localLowStockBranches || 0);
  const incoming = counts?.incomingWatchBranches || 0;

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Local Radar</Text></Pressable>
    <AbstractHero eyebrow="Physical In-Store Stock" title="Know which trip may be worth making." subtitle="Nearby Pokémon-selling branches, preparation signals and verified physical availability — never inferred from generic online stock." icon="storefront"/>
    <View style={styles.locationCard}>
      <Text style={styles.locationTitle}>Search around you</Text>
      <Text style={styles.locationCopy}>Use device location or a UK postcode. FateDrop only promotes branch stock when the evidence is branch-level and fresh.</Text>
      <Pressable onPress={() => void useDevice()} disabled={loading} style={styles.primary}><Ionicons name="locate" size={17} color={FateDropColors.text}/><Text style={styles.primaryText}>{loading ? 'Checking Radar…' : 'Use my location'}</Text></Pressable>
      <View style={styles.manual}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.input}/><Pressable onPress={() => void usePostcode()} style={styles.setButton}><Text style={styles.primaryText}>Set</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
    {area ? <View style={styles.summary}><StatusBadge label={`${confirmed} confirmed`} color={FateDropColors.mint}/><StatusBadge label={`${incoming} preparing`} color={FateDropColors.cyan}/><StatusBadge label={`${shops.length} nearby`} color={FateDropColors.violetLight}/></View> : null}
    {area ? <><Text style={styles.heading}>Radius</Text><View style={styles.filters}>{[5,10,25,50].map(value => <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => setRadius(value)}/>)}</View></> : null}
    <Text style={styles.heading}>Show</Text><View style={styles.filters}><FilterChip label="All nearby" active={filter === 'all'} onPress={() => setFilter('all')}/><FilterChip label="Confirmed physical" active={filter === 'physical'} onPress={() => setFilter('physical')}/><FilterChip label="Preparing" active={filter === 'preparing'} onPress={() => setFilter('preparing')}/></View>
    <View style={styles.listHeading}><Text style={styles.heading}>Nearby branches</Text><StatusBadge label={`${filtered.length} results`} color={FateDropColors.cyan}/></View>
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground/><FlatList
    data={filtered}
    keyExtractor={item => item.id}
    contentContainerStyle={styles.content}
    ListHeaderComponent={header}
    ListEmptyComponent={<Text style={styles.empty}>{area ? 'No nearby branch intelligence matches this view yet.' : 'Choose a location to search physical stores.'}</Text>}
    renderItem={({item}) => {
      const product = item.localStockProducts?.[0];
      const status = stockStatus(item);
      const signal = shopSignal(item);
      return <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/local-radar-store', params: { id: item.id, ...areaParams(area, radius) } })}
      >
        <View style={[styles.icon, { borderColor: status.color }]}><Ionicons name="storefront" size={20} color={status.color}/></View>
        <View style={styles.flex}>
          <Text style={[styles.signal, { color: status.color }]}>{signal}</Text>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{status.label}</Text>
          {product ? <Text style={styles.product}>{product.title || 'Tracked Pokémon product'}</Text> : null}
          {product ? <Text style={styles.meta}>{ageLabel(product.freshnessAgeMinutes)} · Confidence {confidenceLabel(product.confidence)}</Text> : null}
          {product ? <Text style={styles.value}>{valueLine(product.value)}</Text> : null}
          <Text style={styles.meta}>{item.distanceMiles != null ? `${item.distanceMiles.toFixed(1)} miles · ` : ''}{item.address || item.postcode || 'Location pending'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted}/>
      </Pressable>;
    }}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:110},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},locationCard:{padding:15,borderRadius:19,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},locationTitle:{color:FateDropColors.text,fontWeight:'900',fontSize:15},locationCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginVertical:7},primary:{flexDirection:'row',justifyContent:'center',gap:7,padding:12,borderRadius:13,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontWeight:'900'},manual:{flexDirection:'row',gap:8,marginTop:9},input:{flex:1,color:FateDropColors.text,padding:11,borderRadius:12,backgroundColor:FateDropColors.cardElevated},setButton:{justifyContent:'center',paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:10,marginTop:8},summary:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12},heading:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginVertical:15},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},card:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:9},icon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.cardElevated,borderWidth:1},flex:{flex:1},signal:{fontSize:9,fontWeight:'900',letterSpacing:.75},name:{color:FateDropColors.text,fontWeight:'900',fontSize:14,marginTop:2},meta:{color:FateDropColors.muted,fontSize:10,marginTop:4,lineHeight:14},product:{color:FateDropColors.text,fontSize:11,fontWeight:'800',marginTop:5},value:{color:FateDropColors.goldBright,fontSize:10,fontWeight:'800',marginTop:4},empty:{color:FateDropColors.muted,textAlign:'center',margin:35}
});
