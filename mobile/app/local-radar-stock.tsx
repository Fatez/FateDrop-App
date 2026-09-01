import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { filterShopsByCategory, retailerCategory, type LocalRadarRetailerCategory } from '@/lib/local-radar-map';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';
import {
  ageLabel,
  areaFromParams,
  areaParams,
  expectedStockForShop,
  fetchLocalRadar,
  prioritizeRadarShops,
  shopLocalState,
  shopPhysicalEvidenceState,
  shopSignal,
  valueLine,
  type RadarShop,
} from '@/services/local-radar-intelligence';

const adapter = new ExpoLocationAdapter();
type RadarRouteParams = Record<string, string | string[] | undefined>;

function stockStatus(shop: RadarShop) {
  const state = shopPhysicalEvidenceState(shop);
  if (state === 'verified') return { label: 'ECHO · IN-STORE CONFIRMED', color: FateDropColors.mint };
  if (state === 'expected') return { label: 'EXPECTED STOCK · NOT GUARANTEED', color: FateDropColors.cyan };
  if (state === 'reported') return { label: 'REPORTED MOVEMENT · CHECK FIRST', color: FateDropColors.echo };
  if (state === 'expired') return { label: 'NO LONGER CONFIRMED', color: FateDropColors.muted };
  return { label: 'AVAILABILITY UNKNOWN', color: FateDropColors.muted };
}

function storeFilterFromParam(value: string | string[] | undefined): LocalRadarRetailerCategory {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === 'supermarket' || candidate === 'large' || candidate === 'independent' || candidate === 'unclassified') return candidate;
  return 'all';
}

function storeTypeLabel(shop: RadarShop) {
  const category = retailerCategory(shop);
  if (category === 'supermarket') return 'Supermarket';
  if (category === 'large') return 'Large retailer';
  if (category === 'independent') return 'Independent';
  return 'Unclassified';
}

export default function LocalRadarStockScreen() {
  const params = useLocalSearchParams() as RadarRouteParams;
  const initialArea = useMemo(() => areaFromParams(params), [params]);
  const initialRadius = typeof params.radiusMiles === 'string' ? Number(params.radiusMiles) : 25;
  const [area, setArea] = useState<UserArea | undefined>(initialArea);
  const [radius, setRadius] = useState(Number.isFinite(initialRadius) ? initialRadius : 25);
  const [postcode, setPostcode] = useState(initialArea?.postcode || '');
  const [shops, setShops] = useState<RadarShop[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [storeFilter, setStoreFilter] = useState<LocalRadarRetailerCategory>(() => storeFilterFromParam(params.storeType));
  const [filter, setFilter] = useState<'all' | 'verified' | 'expected' | 'reported'>('all');

  const load = useCallback(async (nextArea: UserArea, nextRadius = radius) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchLocalRadar(nextArea, nextRadius, 'shops');
      setShops(payload.shops || []);
    } catch (reason) {
      setShops([]);
      setError(reason instanceof Error && reason.message === 'INVALID_POSTCODE' ? 'Enter a valid UK postcode.' : 'Local Radar could not reach the FateDrop store network.');
    } finally {
      setLoading(false);
    }
  }, [radius]);

  useEffect(() => {
    if (area) void load(area, radius);
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

  const categoryCounts = useMemo(() => {
    const counts = { all: shops.length, supermarket: 0, large: 0, independent: 0, unclassified: 0 };
    for (const shop of shops) counts[retailerCategory(shop)] += 1;
    return counts;
  }, [shops]);
  const categoryFiltered = useMemo(() => filterShopsByCategory(shops, storeFilter), [shops, storeFilter]);
  const filtered = useMemo(() => prioritizeRadarShops(categoryFiltered.filter(shop => {
    const state = shopPhysicalEvidenceState(shop);
    if (filter === 'verified') return state === 'verified';
    if (filter === 'expected') return state === 'expected';
    if (filter === 'reported') return state === 'reported';
    return true;
  })), [categoryFiltered, filter]);

  const confirmed = useMemo(() => categoryFiltered.filter(shop => shopPhysicalEvidenceState(shop) === 'verified').length, [categoryFiltered]);
  const expected = useMemo(() => categoryFiltered.filter(shop => shopPhysicalEvidenceState(shop) === 'expected').length, [categoryFiltered]);
  const reported = useMemo(() => categoryFiltered.filter(shop => shopPhysicalEvidenceState(shop) === 'reported').length, [categoryFiltered]);

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Local Radar</Text></Pressable>
    <AbstractHero eyebrow="Local Stores" title="Know which trip may be worth making." subtitle="Nearby branch locations with seller evidence labelled honestly, Expected arrival information and exact-branch Confirmed stock — never inferred from generic online availability." icon="storefront"/>
    <View style={styles.locationCard}>
      <Text style={styles.locationTitle}>Search around you</Text>
      <Text style={styles.locationCopy}>Use device location or a UK postcode. A pin proves only the location evidence shown; Pokémon participation and stock stay separate, and stock remains Unknown unless FateDrop has exact-branch evidence.</Text>
      <Pressable onPress={() => void handleDeviceLocation()} disabled={loading} style={styles.primary}><Ionicons name="locate" size={17} color={FateDropColors.text}/><Text style={styles.primaryText}>{loading ? 'Checking Radar…' : 'Use my location'}</Text></Pressable>
      <View style={styles.manual}><TextInput value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholder="UK postcode" placeholderTextColor={FateDropColors.muted} style={styles.input}/><Pressable onPress={() => void handlePostcodeSearch()} style={styles.setButton}><Text style={styles.primaryText}>Set</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
    {area ? <View style={styles.summary}><StatusBadge label={`${confirmed} in-store`} color={FateDropColors.mint}/><StatusBadge label={`${expected} expected`} color={FateDropColors.cyan}/>{reported ? <StatusBadge label={`${reported} reported`} color={FateDropColors.echo}/> : null}<StatusBadge label={`${categoryFiltered.length} nearby`} color={FateDropColors.violetLight}/></View> : null}
    {area ? <><Text style={styles.heading}>Radius</Text><View style={styles.filters}>{[5,10,25,50].map(value => <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => setRadius(value)}/>)}</View></> : null}
    <Text style={styles.heading}>Store type</Text><View style={styles.filters}>
      <FilterChip label={`All · ${categoryCounts.all}`} active={storeFilter === 'all'} onPress={() => setStoreFilter('all')}/>
      <FilterChip label={`Supermarkets · ${categoryCounts.supermarket}`} active={storeFilter === 'supermarket'} onPress={() => setStoreFilter('supermarket')}/>
      <FilterChip label={`Large retailers · ${categoryCounts.large}`} active={storeFilter === 'large'} onPress={() => setStoreFilter('large')}/>
      <FilterChip label={`Independents · ${categoryCounts.independent}`} active={storeFilter === 'independent'} onPress={() => setStoreFilter('independent')}/>
      {categoryCounts.unclassified ? <FilterChip label={`Unclassified · ${categoryCounts.unclassified}`} active={storeFilter === 'unclassified'} onPress={() => setStoreFilter('unclassified')}/> : null}
    </View>
    <Text style={styles.heading}>Physical Echo</Text><View style={styles.filters}><FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')}/><FilterChip label="In-store" active={filter === 'verified'} onPress={() => setFilter('verified')}/><FilterChip label="Expected" active={filter === 'expected'} onPress={() => setFilter('expected')}/><FilterChip label="Reported" active={filter === 'reported'} onPress={() => setFilter('reported')}/></View>
    <View style={styles.listHeading}><Text style={styles.heading}>Nearby stores</Text><StatusBadge label={`${filtered.length} results`} color={FateDropColors.cyan}/></View>
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground/><FlatList
    data={filtered}
    keyExtractor={item => item.id}
    contentContainerStyle={styles.content}
    ListHeaderComponent={header}
    ListEmptyComponent={<Text style={styles.empty}>{area ? 'No nearby stores match this view yet.' : 'Choose a location to search local stores.'}</Text>}
    renderItem={({item}) => {
      const product = item.localStockProducts?.[0];
      const status = stockStatus(item);
      const expectedStock = expectedStockForShop(item);
      const state = shopLocalState(item);
      const evidenceState = shopPhysicalEvidenceState(item);
      return <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/local-radar-store', params: { id: item.id, ...areaParams(area, radius) } })}
      >
        <View style={[styles.icon, { borderColor: status.color }]}><Ionicons name="storefront" size={20} color={status.color}/></View>
        <View style={styles.flex}>
          <Text style={[styles.signal, { color: status.color }]}>{shopSignal(item)} · {storeTypeLabel(item)}</Text>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{status.label}</Text>
          {(evidenceState === 'expected' || evidenceState === 'reported') && expectedStock ? <><Text style={styles.product}>{evidenceState === 'reported' ? 'Reported movement' : 'Expected stock'}: {expectedStock.title}</Text>{expectedStock.label ? <Text style={styles.expected}>{expectedStock.label}</Text> : null}</> : null}
          {state === 'confirmed' && product ? <><Text style={styles.product}>{product.title || 'Pokémon stock'}</Text><Text style={styles.meta}>{ageLabel(product.freshnessAgeMinutes)}</Text></> : null}
          {product?.value?.priceKnown ? <Text style={styles.value}>{valueLine(product.value)}</Text> : null}
          <Text style={styles.meta}>{item.distanceMiles != null ? `${item.distanceMiles.toFixed(1)} miles · ` : ''}{item.address || item.postcode || 'Location pending'}</Text>
          {(evidenceState === 'expected' || evidenceState === 'reported') && expectedStock?.disclaimer ? <Text style={styles.advisory}>{expectedStock.disclaimer}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted}/>
      </Pressable>;
    }}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:110},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},locationCard:{padding:15,borderRadius:19,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},locationTitle:{color:FateDropColors.text,fontWeight:'900',fontSize:15},locationCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginVertical:7},primary:{flexDirection:'row',justifyContent:'center',gap:7,padding:12,borderRadius:13,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontWeight:'900'},manual:{flexDirection:'row',gap:8,marginTop:9},input:{flex:1,color:FateDropColors.text,padding:11,borderRadius:12,backgroundColor:FateDropColors.cardElevated},setButton:{justifyContent:'center',paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.cardElevated},error:{color:FateDropColors.coral,fontSize:10,marginTop:8},summary:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12},heading:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginVertical:15},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},card:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:9},icon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:FateDropColors.cardElevated,borderWidth:1},flex:{flex:1},signal:{fontSize:9,fontWeight:'900',letterSpacing:.75},name:{color:FateDropColors.text,fontWeight:'900',fontSize:14,marginTop:2},meta:{color:FateDropColors.muted,fontSize:10,marginTop:4,lineHeight:14},product:{color:FateDropColors.text,fontSize:11,fontWeight:'800',marginTop:5},expected:{color:FateDropColors.cyan,fontSize:10,fontWeight:'900',marginTop:4},value:{color:FateDropColors.goldBright,fontSize:10,fontWeight:'800',marginTop:4},advisory:{color:FateDropColors.secondary,fontSize:9,lineHeight:13,marginTop:6},empty:{color:FateDropColors.muted,textAlign:'center',margin:35}
});
