import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, ProductCard, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useCatalogue } from '@/hooks/use-catalogue';
import { openTrackedRetailerLink } from '@/services/outbound-links';
import { fetchRetailerDirectory, type NetworkRetailer } from '@/services/retailer-directory';

function verificationLabel(retailer: NetworkRetailer) {
  return String(retailer.verification || '').toLowerCase() === 'verified' ? 'Verified retailer' : 'Verification not established';
}

function presenceLabel(retailer: NetworkRetailer) {
  if (retailer.online && retailer.physicalStores === true) return 'Online + physical stores';
  if (retailer.physicalStores === true) return 'Physical stores';
  if (retailer.online && retailer.physicalStores === false) return 'Online retailer';
  if (retailer.online) return 'Online · physical status unknown';
  return 'Retail presence unknown';
}

function physicalDetail(retailer: NetworkRetailer) {
  if (retailer.physicalStores !== true) return retailer.physicalStores === false ? 'No physical-store presence reported by FateDrop Cloud.' : 'Physical-store presence has not been established.';
  if (retailer.physicalLocations && retailer.physicalLocations > 0) {
    return `${retailer.physicalLocations} physical location${retailer.physicalLocations === 1 ? '' : 's'} currently known to FateDrop. Branch stock is separate and remains unknown unless Local Radar has exact-branch evidence.`;
  }
  return 'Physical-store presence is known. Branch stock is separate and remains unknown unless Local Radar has exact-branch evidence.';
}

function monitoringLabel(retailer: NetworkRetailer) {
  if (!retailer.monitoring.configured) return 'No active retailer monitor reported.';
  if (retailer.monitoring.healthy && !retailer.monitoring.stale) return 'Monitor healthy';
  if (retailer.monitoring.stale) return 'Monitor stale';
  return 'Monitor needs attention';
}

export default function RetailerStorefront() {
  const params = useLocalSearchParams<{ id?: string; q?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const productQuery = typeof params.q === 'string' ? params.q.trim() : '';
  const [retailer, setRetailer] = useState<NetworkRetailer | null>(null);
  const [loadingRetailer, setLoadingRetailer] = useState(Boolean(id));
  const [retailerError, setRetailerError] = useState('');
  const catalogue = useCatalogue({ retailerId: id || undefined, query: productQuery || undefined, inStockOnly: true, limit: 50 });

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoadingRetailer(false);
      setRetailerError('Retailer could not be found.');
      return;
    }

    void (async () => {
      setLoadingRetailer(true);
      setRetailerError('');
      try {
        const result = await fetchRetailerDirectory();
        const found = result.retailers.find((item) => item.id === id) || null;
        if (!cancelled) {
          setRetailer(found);
          setRetailerError(found ? '' : 'This retailer is not present in the current FateDrop retailer directory.');
        }
      } catch (cause) {
        if (!cancelled) {
          setRetailer(null);
          setRetailerError(cause instanceof Error ? cause.message : 'Retailer directory is unavailable.');
        }
      } finally {
        if (!cancelled) setLoadingRetailer(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  const header = <>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Retailers</Text></Pressable>
    {loadingRetailer ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.violetLight}/><Text style={styles.loadingText}>Loading retailer profile…</Text></View> : null}
    {retailerError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber}/><Text style={styles.errorText}>{retailerError}</Text></View> : null}
    {retailer ? <>
      <AbstractHero
        eyebrow={String(retailer.retailerClass || 'retailer').replaceAll('_', ' ')}
        title={retailer.name}
        subtitle="Retailer information shown here comes from FateDrop's shared retailer directory. Missing details stay unknown."
        icon="storefront"
      />
      <View style={styles.actions}>
        {retailer.websiteUrl ? <Pressable onPress={() => void openTrackedRetailerLink({ destinationUrl: retailer.websiteUrl!, retailerId: retailer.id, placement: 'retailer-storefront-profile' })} style={styles.primary}><Text style={styles.primaryText}>Visit retailer</Text><Ionicons name="open-outline" size={15} color={FateDropColors.text}/></Pressable> : null}
        {retailer.physicalStores === true ? <Pressable onPress={() => router.push('/local-radar')} style={styles.secondary}><Text style={styles.secondaryText}>Local Radar</Text><Ionicons name="navigate-outline" size={15} color={FateDropColors.text}/></Pressable> : null}
      </View>
      <View style={styles.badges}>
        <StatusBadge label={presenceLabel(retailer)} color={FateDropColors.cyan}/>
        <StatusBadge label={verificationLabel(retailer)} color={String(retailer.verification || '').toLowerCase() === 'verified' ? FateDropColors.mint : FateDropColors.muted}/>
      </View>
      <View style={styles.information}>
        <Info label="Retailer type" value={String(retailer.retailerClass || 'Unknown').replaceAll('_', ' ')}/>
        <Info label="TCGs" value={retailer.tcgs.length ? retailer.tcgs.map((tcg) => tcg.toUpperCase()).join(' · ') : 'Not supplied by FateDrop Cloud'}/>
        <Info label="Physical presence" value={physicalDetail(retailer)}/>
        <Info label="Monitoring" value={monitoringLabel(retailer)}/>
      </View>
      <View style={styles.truthNote}><Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright}/><Text style={styles.truthText}>Online retailer availability never proves stock at a physical branch. Open Local Radar for physical-store intelligence; Confirmed only appears from exact-branch evidence.</Text></View>
      {productQuery ? <View style={styles.searchContext}><Ionicons name="search" size={15} color={FateDropColors.cyan}/><Text style={styles.searchContextText}>Showing this storefront's current in-stock matches for “{productQuery}”.</Text></View> : null}
      <Text style={styles.sectionTitle}>{productQuery ? `Matching online stock · ${catalogue.total.toLocaleString()}` : `Available online now · ${catalogue.total.toLocaleString()}`}</Text>
    </> : null}
  </>;

  return <SafeAreaView style={styles.safe}><FateDropBackground/><FlatList
    data={retailer ? catalogue.offers.filter((item) => item.stockStatus === 'IN_STOCK' && !item.preorder) : []}
    keyExtractor={(item) => item.id}
    onEndReached={() => void catalogue.loadMore()}
    contentContainerStyle={styles.content}
    ItemSeparatorComponent={() => <View style={{height:10}}/>}
    ListHeaderComponent={header}
    renderItem={({item}) => retailer ? <ProductCard
      title={item.title}
      retailer={retailer.name}
      price={item.priceGbp === undefined ? 'Price unavailable' : `£${item.priceGbp.toFixed(2)}`}
      stockLabel="In stock"
      stockTone="mint"
      fateLabel={item.pulseLabels?.[0]?.replaceAll('_',' ')}
      imageSource={item.imageUrl ? {uri:item.imageUrl} : undefined}
      productUrl={item.productUrl}
      onOpenProduct={item.productUrl ? () => void openTrackedRetailerLink({ destinationUrl:item.productUrl!, retailerId:retailer.id, offerId:item.id, placement:'retailer-storefront' }) : undefined}
    /> : null}
    ListEmptyComponent={retailer && !loadingRetailer ? <Text style={styles.emptyCopy}>{catalogue.loading ? 'Loading current offers…' : catalogue.error || (productQuery ? 'This retailer has no currently verified in-stock offer matching this search.' : 'No currently verified in-stock online offers are connected to this retailer.')}</Text> : null}
  /></SafeAreaView>;
}

function Info({label,value}:{label:string;value:string}) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},
  content:{paddingHorizontal:20,paddingBottom:100},
  back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12},
  backText:{color:FateDropColors.text,fontWeight:'800'},
  loading:{flexDirection:'row',alignItems:'center',gap:9,padding:14,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:12},
  loadingText:{color:FateDropColors.secondary,fontSize:11},
  error:{flexDirection:'row',alignItems:'center',gap:9,padding:14,borderRadius:16,backgroundColor:`${FateDropColors.amber}0D`,borderWidth:1,borderColor:`${FateDropColors.amber}35`,marginBottom:12},
  errorText:{flex:1,color:FateDropColors.secondary,fontSize:11,lineHeight:16},
  actions:{flexDirection:'row',gap:9,marginBottom:13},
  primary:{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:7,padding:13,borderRadius:15,backgroundColor:FateDropColors.violet},
  primaryText:{color:FateDropColors.text,fontWeight:'900'},
  secondary:{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:7,padding:13,borderRadius:15,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},
  secondaryText:{color:FateDropColors.text,fontWeight:'800'},
  badges:{flexDirection:'row',flexWrap:'wrap',gap:7},
  information:{padding:15,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:13},
  infoRow:{marginBottom:11},
  infoLabel:{color:FateDropColors.cyan,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  infoValue:{color:FateDropColors.secondary,fontSize:11,lineHeight:17,marginTop:4,textTransform:'capitalize'},
  truthNote:{flexDirection:'row',gap:10,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:13},
  truthText:{flex:1,color:FateDropColors.secondary,fontSize:10,lineHeight:16},
  searchContext:{flexDirection:'row',alignItems:'center',gap:8,padding:12,borderRadius:15,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginTop:13},
  searchContextText:{flex:1,color:FateDropColors.secondary,fontSize:10,lineHeight:15},
  sectionTitle:{color:FateDropColors.text,fontSize:18,fontWeight:'900',marginVertical:16},
  emptyCopy:{color:FateDropColors.muted,textAlign:'center',margin:25},
});