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
  confidenceLabel,
  expectedWindowLabel,
  fetchLocalRadar,
  shopSignal,
  valueLine,
  type RadarShop,
  type RadarStockProduct,
} from '@/services/local-radar-intelligence';

function productState(product: RadarStockProduct) {
  const lifecycle = String(product.lifecycleState || '').toLowerCase();
  if (lifecycle === 'manifested') return { label: 'PHYSICAL STOCK CONFIRMED', color: FateDropColors.mint };
  if (lifecycle === 'echo') return { label: 'PREPARATION DETECTED', color: FateDropColors.cyan };
  if (lifecycle === 'whisper') return { label: 'EARLY LOCAL MOVEMENT', color: FateDropColors.violetLight };
  if (lifecycle === 'vanished') return { label: 'AVAILABILITY DISAPPEARED', color: FateDropColors.coral };
  return { label: 'LOCAL EVIDENCE', color: FateDropColors.muted };
}

export default function LocalRadarStoreScreen() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const id = typeof params.id === 'string' ? params.id : '';
  const area = useMemo(() => areaFromParams(params), [params]);
  const radius = typeof params.radiusMiles === 'string' && Number.isFinite(Number(params.radiusMiles)) ? Number(params.radiusMiles) : 25;
  const [shop, setShop] = useState<RadarShop | null>(null);
  const [loading, setLoading] = useState(Boolean(area && id));
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!area || !id) {
      setError('This branch needs a Local Radar location context.');
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const payload = await fetchLocalRadar(area, radius, 'shops');
        const found = (payload.shops || []).find(item => item.id === id) || null;
        if (!cancelled) {
          setShop(found);
          setError(found ? '' : 'This branch is no longer in the current Local Radar result set.');
        }
      } catch {
        if (!cancelled) setError('FateDrop could not refresh this branch intelligence.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [area, id, radius]);

  const signal = shop ? shopSignal(shop) : '';
  const products = shop?.localStockProducts || [];
  const branchConfirmed = signal === 'LOCAL MANIFESTED';
  const branchPreparing = signal === 'LOCAL ECHO' || signal === 'LOCAL WHISPER';

  return <SafeAreaView style={styles.safe}><FateDropBackground/><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Physical Stock Radar</Text></Pressable>
    {loading ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright}/><Text style={styles.loadingText}>Refreshing exact branch intelligence…</Text></View> : null}
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
    {shop ? <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>LOCAL RADAR · PHYSICAL BRANCH</Text>
        <Text style={styles.title}>{shop.name}</Text>
        <Text style={styles.address}>{shop.address || shop.postcode || 'Location pending'}{shop.distanceMiles != null ? ` · ${shop.distanceMiles.toFixed(1)} miles` : ''}</Text>
        <View style={styles.badges}>
          <StatusBadge label={signal} color={branchConfirmed ? FateDropColors.mint : branchPreparing ? FateDropColors.cyan : FateDropColors.violetLight}/>
          <StatusBadge label={shop.localStockEvidence?.verifiedBranchStock ? 'BRANCH VERIFIED' : 'NO VERIFIED STOCK'} color={shop.localStockEvidence?.verifiedBranchStock ? FateDropColors.mint : FateDropColors.muted}/>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelEyebrow}>WHAT FATEDROP CURRENTLY KNOWS</Text>
        <Text style={styles.panelTitle}>{branchConfirmed ? 'Physical stock has been verified at this branch.' : branchPreparing ? 'There is credible preparation evidence for this branch.' : 'There is no current verified branch-level stock signal.'}</Text>
        <Text style={styles.panelCopy}>Online retailer availability is kept separate. This branch only receives physical-stock status when the evidence resolves to this location and is still fresh.</Text>
        {shop.localStockEvidence ? <View style={styles.factRow}><Text style={styles.fact}>Confidence {confidenceLabel(shop.localStockEvidence.confidence)}</Text><Text style={styles.fact}>{ageLabel(shop.localStockEvidence.freshnessAgeMinutes)}</Text></View> : null}
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Upcoming & current stock intelligence</Text><Text style={styles.sectionCopy}>Products FateDrop can currently associate with this exact branch.</Text></View>
      {products.length === 0 ? <View style={styles.empty}><Ionicons name="radio-outline" size={22} color={FateDropColors.muted}/><Text style={styles.emptyTitle}>No product-level branch signal yet</Text><Text style={styles.emptyCopy}>The store can still appear on the map as a nearby Pokémon retailer. FateDrop will populate this section when the Cloud engine resolves credible branch evidence.</Text></View> : products.map((product, index) => {
        const state = productState(product);
        const expected = expectedWindowLabel(product);
        const lifecycle = String(product.lifecycleState || '').toLowerCase();
        const awaitingWindow = (lifecycle === 'echo' || lifecycle === 'whisper') && !expected;
        return <View key={`${product.productIdentityId || product.title || 'product'}:${index}`} style={styles.productCard}>
          <Text style={[styles.productSignal, { color: state.color }]}>{state.label}</Text>
          <Text style={styles.productTitle}>{product.title || 'Tracked Pokémon product'}</Text>
          <Text style={styles.productMeta}>{ageLabel(product.freshnessAgeMinutes)} · Confidence {confidenceLabel(product.confidence)}</Text>
          <Text style={styles.value}>{valueLine(product.value)}</Text>
          <View style={styles.expectedBox}>
            <Text style={styles.expectedLabel}>EXPECTED PHYSICAL ARRIVAL</Text>
            <Text style={styles.expectedValue}>{expected || (lifecycle === 'manifested' ? 'Observed in branch now' : awaitingWindow ? 'No confirmed arrival window yet' : 'No arrival window currently available')}</Text>
            {product.expectedStockWindow?.confidence != null ? <Text style={styles.expectedMeta}>Arrival confidence {confidenceLabel(product.expectedStockWindow.confidence)}</Text> : null}
            {product.expectedStockWindow?.evidenceBasis?.length ? <Text style={styles.expectedMeta}>Basis: {product.expectedStockWindow.evidenceBasis.join(' · ')}</Text> : null}
          </View>
          {(product.contradictionCount || 0) > 0 ? <Text style={styles.contradiction}>{product.contradictionCount} recent contradiction{product.contradictionCount === 1 ? '' : 's'} are reducing confidence.</Text> : null}
        </View>;
      })}

      <View style={styles.disclaimer}><Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright}/><Text style={styles.disclaimerText}>Local Radar is evidence-led, not a guarantee. Arrival dates are only shown when Cloud supplies an evidence-backed branch window. FateDrop will not convert generic retailer chatter or online stock into a store-specific promise.</Text></View>
      {shop.retailerId ? <Pressable style={styles.retailerButton} onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: shop.retailerId! } })}><Text style={styles.retailerButtonText}>View retailer profile</Text><Ionicons name="chevron-forward" size={17} color={FateDropColors.text}/></Pressable> : null}
    </> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:8,marginBottom:6},backText:{color:FateDropColors.text,fontWeight:'800'},loading:{alignItems:'center',gap:10,padding:30},loadingText:{color:FateDropColors.secondary,fontSize:11},errorCard:{padding:14,borderRadius:14,backgroundColor:`${FateDropColors.coral}12`,borderWidth:1,borderColor:`${FateDropColors.coral}35`},error:{color:FateDropColors.coral,fontSize:11},hero:{padding:19,borderRadius:22,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},eyebrow:{color:FateDropColors.goldBright,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:28,fontWeight:'700',marginTop:6},address:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:6},badges:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:13},panel:{padding:16,borderRadius:18,backgroundColor:FateDropColors.cardElevated,marginTop:12,borderWidth:1,borderColor:FateDropColors.borderSoft},panelEyebrow:{color:FateDropColors.violetLight,fontSize:9,fontWeight:'900',letterSpacing:1.1},panelTitle:{color:FateDropColors.text,fontSize:16,fontWeight:'900',lineHeight:22,marginTop:5},panelCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:7},factRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},fact:{color:FateDropColors.muted,fontSize:10,fontWeight:'800'},sectionHead:{marginTop:24,marginBottom:10},sectionTitle:{color:FateDropColors.text,fontSize:19,fontWeight:'900'},sectionCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:16,marginTop:4},empty:{padding:20,borderRadius:17,alignItems:'center',backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},emptyTitle:{color:FateDropColors.text,fontWeight:'900',marginTop:8},emptyCopy:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,textAlign:'center',marginTop:5},productCard:{padding:16,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:10},productSignal:{fontSize:9,fontWeight:'900',letterSpacing:.9},productTitle:{color:FateDropColors.text,fontSize:15,fontWeight:'900',marginTop:5},productMeta:{color:FateDropColors.muted,fontSize:10,marginTop:5},value:{color:FateDropColors.goldBright,fontSize:10,fontWeight:'800',marginTop:5},expectedBox:{padding:12,borderRadius:13,backgroundColor:FateDropColors.cardElevated,marginTop:12},expectedLabel:{color:FateDropColors.violetLight,fontSize:8,fontWeight:'900',letterSpacing:1},expectedValue:{color:FateDropColors.text,fontSize:13,fontWeight:'900',marginTop:4},expectedMeta:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:4},contradiction:{color:FateDropColors.coral,fontSize:9,lineHeight:14,marginTop:9},disclaimer:{flexDirection:'row',gap:10,padding:14,borderRadius:16,backgroundColor:`${FateDropColors.gold}0D`,borderWidth:1,borderColor:`${FateDropColors.gold}25`,marginTop:8},disclaimerText:{flex:1,color:FateDropColors.secondary,fontSize:10,lineHeight:16},retailerButton:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:14,borderRadius:15,backgroundColor:FateDropColors.violet,marginTop:12},retailerButtonText:{color:FateDropColors.text,fontWeight:'900'}
});
