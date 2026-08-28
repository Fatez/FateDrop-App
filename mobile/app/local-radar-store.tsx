import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  ageLabel,
  areaFromParams,
  expectedStockForShop,
  expectedWindowLabel,
  fetchLocalRadar,
  shopLocalState,
  shopSignal,
  valueLine,
  type RadarShop,
  type RadarStockProduct,
} from '@/services/local-radar-intelligence';

type RadarRouteParams = Record<string, string | string[] | undefined>;

function routeValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value : '';
}

function productState(product: RadarStockProduct) {
  const state = String(product.localState || '').toLowerCase();
  if (state === 'confirmed') return { label: 'CONFIRMED', color: FateDropColors.mint, state: 'confirmed' as const };
  if (state === 'expected') return { label: 'EXPECTED', color: FateDropColors.cyan, state: 'expected' as const };
  return { label: 'UNKNOWN', color: FateDropColors.muted, state: 'unknown' as const };
}

export default function LocalRadarStoreScreen() {
  const params = useLocalSearchParams() as RadarRouteParams;
  const id = routeValue(params.id);
  const source = routeValue(params.source);
  const postcode = routeValue(params.postcode);
  const lat = routeValue(params.lat);
  const lng = routeValue(params.lng);
  const radiusValue = routeValue(params.radiusMiles);
  const radius = radiusValue && Number.isFinite(Number(radiusValue)) ? Number(radiusValue) : 25;
  const area = useMemo(
    () => areaFromParams({ source, postcode, lat, lng }),
    [source, postcode, lat, lng],
  );
  const [shop, setShop] = useState<RadarShop | null>(null);
  const [loading, setLoading] = useState(Boolean(area && id));
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!area || !id) {
      setShop(null);
      setError('This store needs a Local Radar location context.');
      setLoading(false);
      return;
    }

    setShop(null);
    setError('');
    setLoading(true);
    void (async () => {
      try {
        const payload = await fetchLocalRadar(area, radius, 'shops');
        const found = (payload.shops || []).find(item => item.id === id) || null;
        if (!cancelled) {
          setShop(found);
          setError(found ? '' : 'This store is no longer in the current Local Radar result set.');
        }
      } catch {
        if (!cancelled) {
          setShop(null);
          setError('FateDrop could not refresh this store.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [area, id, radius]);

  const state = shop ? shopLocalState(shop) : 'unknown';
  const products = shop?.localStockProducts || [];
  const expectedStock = shop ? expectedStockForShop(shop) : null;
  const stateColor = state === 'confirmed' ? FateDropColors.mint : state === 'expected' ? FateDropColors.cyan : FateDropColors.muted;

  return <SafeAreaView style={styles.safe}><FateDropBackground/><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Local Stores</Text></Pressable>
    {loading ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright}/><Text style={styles.loadingText}>Refreshing store information…</Text></View> : null}
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
    {shop ? <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>LOCAL RADAR · PHYSICAL STORE</Text>
        <Text style={styles.title}>{shop.name}</Text>
        <Text style={styles.address}>{shop.address || shop.postcode || 'Location pending'}{shop.distanceMiles != null ? ` · ${shop.distanceMiles.toFixed(1)} miles` : ''}</Text>
        <View style={styles.badges}>
          <StatusBadge label={shopSignal(shop)} color={stateColor}/>
          <StatusBadge label="PHYSICAL STORE" color={FateDropColors.violetLight}/>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelEyebrow}>WHAT FATEDROP CURRENTLY KNOWS</Text>
        <Text style={styles.panelTitle}>{state === 'confirmed' ? 'Stock has been confirmed at this exact store.' : state === 'expected' ? 'FateDrop has credible expected-stock information for this store.' : 'This is a known local Pokémon retailer. Current stock is unknown.'}</Text>
        <Text style={styles.panelCopy}>{state === 'confirmed' ? 'Confirmed is only shown from genuine exact-store physical availability evidence.' : state === 'expected' ? 'Expected information is advisory and can change before the stock reaches the shelf.' : 'FateDrop does not infer physical stock from an online product page or retailer-wide availability.'}</Text>
      </View>

      {state === 'expected' && expectedStock ? <View style={styles.expectedHero}>
        <Text style={styles.expectedEyebrow}>EXPECTED STOCK</Text>
        <Text style={styles.expectedProduct}>{expectedStock.title}</Text>
        <Text style={styles.expectedDate}>{expectedStock.label || 'Expected date not yet confirmed'}</Text>
        {expectedStock.sourceLabel ? <Text style={styles.expectedSource}>Source: {expectedStock.sourceLabel}</Text> : null}
        <Text style={styles.expectedDisclaimer}>{expectedStock.disclaimer}</Text>
      </View> : null}

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Stock information</Text><Text style={styles.sectionCopy}>Only information FateDrop can associate with this store is shown here.</Text></View>
      {products.length === 0 ? <View style={styles.empty}><Ionicons name="radio-outline" size={22} color={FateDropColors.muted}/><Text style={styles.emptyTitle}>Current availability unknown</Text><Text style={styles.emptyCopy}>The store can still appear because FateDrop knows it is a physical Pokémon retailer. No stock claim is being made.</Text></View> : products.map((product, index) => {
        const productStatus = productState(product);
        const expected = expectedWindowLabel(product);
        const sourceLabel = product.sourceLabel || null;
        return <View key={`${product.productIdentityId || product.title || 'product'}:${index}`} style={styles.productCard}>
          <Text style={[styles.productSignal, { color: productStatus.color }]}>{productStatus.label}</Text>
          <Text style={styles.productTitle}>{product.title || 'Pokémon stock'}</Text>
          {productStatus.state === 'confirmed' ? <Text style={styles.productMeta}>{ageLabel(product.freshnessAgeMinutes)}</Text> : null}
          {productStatus.state === 'expected' ? <Text style={styles.expectedDate}>{expected || 'Expected date not yet confirmed'}</Text> : null}
          {sourceLabel ? <Text style={styles.productMeta}>Source: {sourceLabel}</Text> : null}
          {product.value?.priceKnown ? <Text style={styles.value}>{valueLine(product.value)}</Text> : null}
          {productStatus.state === 'expected' ? <Text style={styles.advisory}>{shop.localAvailability?.disclaimer || expectedStock?.disclaimer}</Text> : null}
          {(product.contradictionCount || 0) > 0 ? <Text style={styles.contradiction}>Recent evidence conflicts, so FateDrop is treating this information cautiously.</Text> : null}
        </View>;
      })}

      <View style={styles.disclaimer}><Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright}/><Text style={styles.disclaimerText}>Expected stock information is indicative only and is not guaranteed. Availability, delivery timing and quantities may vary by store. We recommend checking with the retailer before travelling.</Text></View>
      {shop.retailerId ? <Pressable style={styles.retailerButton} onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: shop.retailerId! } })}><Text style={styles.retailerButtonText}>View retailer profile</Text><Ionicons name="chevron-forward" size={17} color={FateDropColors.text}/></Pressable> : null}
    </> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:8,marginBottom:6},backText:{color:FateDropColors.text,fontWeight:'800'},loading:{alignItems:'center',gap:10,padding:30},loadingText:{color:FateDropColors.secondary,fontSize:11},errorCard:{padding:14,borderRadius:14,backgroundColor:`${FateDropColors.coral}12`,borderWidth:1,borderColor:`${FateDropColors.coral}35`},error:{color:FateDropColors.coral,fontSize:11},hero:{padding:19,borderRadius:22,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},eyebrow:{color:FateDropColors.goldBright,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:28,fontWeight:'700',marginTop:6},address:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:6},badges:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:13},panel:{padding:16,borderRadius:18,backgroundColor:FateDropColors.cardElevated,marginTop:12,borderWidth:1,borderColor:FateDropColors.borderSoft},panelEyebrow:{color:FateDropColors.violetLight,fontSize:9,fontWeight:'900',letterSpacing:1.1},panelTitle:{color:FateDropColors.text,fontSize:16,fontWeight:'900',lineHeight:22,marginTop:5},panelCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:7},expectedHero:{padding:16,borderRadius:18,backgroundColor:`${FateDropColors.cyan}10`,borderWidth:1,borderColor:`${FateDropColors.cyan}35`,marginTop:12},expectedEyebrow:{color:FateDropColors.cyan,fontSize:9,fontWeight:'900',letterSpacing:1},expectedProduct:{color:FateDropColors.text,fontSize:16,fontWeight:'900',marginTop:5},expectedDate:{color:FateDropColors.cyan,fontSize:12,fontWeight:'900',marginTop:5},expectedSource:{color:FateDropColors.muted,fontSize:9,marginTop:6},expectedDisclaimer:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:9},sectionHead:{marginTop:24,marginBottom:10},sectionTitle:{color:FateDropColors.text,fontSize:19,fontWeight:'900'},sectionCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:16,marginTop:4},empty:{padding:20,borderRadius:17,alignItems:'center',backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},emptyTitle:{color:FateDropColors.text,fontWeight:'900',marginTop:8},emptyCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,textAlign:'center',marginTop:5},productCard:{padding:16,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:10},productSignal:{fontSize:9,fontWeight:'900',letterSpacing:.9},productTitle:{color:FateDropColors.text,fontSize:15,fontWeight:'900',marginTop:5},productMeta:{color:FateDropColors.muted,fontSize:10,marginTop:5,lineHeight:14},advisory:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:8},value:{color:FateDropColors.goldBright,fontSize:10,fontWeight:'800',marginTop:5},contradiction:{color:FateDropColors.coral,fontSize:9,lineHeight:14,marginTop:9},disclaimer:{flexDirection:'row',gap:10,padding:14,borderRadius:16,backgroundColor:`${FateDropColors.gold}0D`,borderWidth:1,borderColor:`${FateDropColors.gold}25`,marginTop:8},disclaimerText:{flex:1,color:FateDropColors.secondary,fontSize:10,lineHeight:16},retailerButton:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:14,borderRadius:15,backgroundColor:FateDropColors.violet,marginTop:12},retailerButtonText:{color:FateDropColors.text,fontWeight:'900'}
});