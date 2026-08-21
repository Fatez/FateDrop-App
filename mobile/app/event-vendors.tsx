import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AbstractHero, FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { isSafeExternalUrl } from '@/lib/encounters';
import { loadEncounterVendors } from '@/services/encounters';
import type { EncounterInventoryItem, EncounterVendor } from '@/types/encounter';

const money=(pence?:number|null)=>pence==null?'Price TBC':`£${(pence/100).toFixed(2)}`;

export default function EventVendorsScreen(){
  const params=useLocalSearchParams<{eventId?:string}>(),eventId=Array.isArray(params.eventId)?params.eventId[0]:params.eventId,[query,setQuery]=useState(''),[vendors,setVendors]=useState<EncounterVendor[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(!eventId){setError('No encounter selected.');setLoading(false);return()=>{active=false};}setLoading(true);setError('');void loadEncounterVendors(eventId).then(data=>{if(active)setVendors(data)}).catch(()=>{if(active)setError('Confirmed event vendors could not be loaded.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[eventId]);
  const needle=query.trim().toLowerCase();
  const visibleVendors=useMemo(()=>vendors.filter(vendor=>{
    if(!needle)return true;
    const inventory=(vendor.inventory||[]).map(item=>item.title).join(' ');
    return `${vendor.name} ${vendor.stallLabel||''} ${vendor.zoneLabel||''} ${(vendor.supportedTcgs||[]).join(' ')} ${inventory}`.toLowerCase().includes(needle);
  }),[needle,vendors]);
  const inventoryCount=useMemo(()=>vendors.reduce((sum,vendor)=>sum+(vendor.inventoryCount??vendor.inventory?.length??0),0),[vendors]);
  const header=<><Pressable onPress={()=>router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Back</Text></Pressable><AbstractHero eyebrow="Event Vendor Mode" title="Find who is at the show." subtitle="Confirmed participating vendors, stall locations and evidence-backed event inventory for this encounter." icon="search"/><View style={styles.truth}><StatusBadge label="Evidence only" color={FateDropColors.mint}/><Text style={styles.truthText}>A confirmed vendor or table location is not a stock claim. Product availability appears only when a vendor or FateDrop event-inventory source explicitly reports it, and that evidence expires.</Text></View><View style={styles.search}><Ionicons name="search" size={18} color={FateDropColors.muted}/><TextInput value={query} onChangeText={setQuery} placeholder="Search vendor, table or event stock" placeholderTextColor={FateDropColors.muted} style={styles.input}/></View>{vendors.length?<Text style={styles.vendorCount}>{vendors.length} confirmed/listed vendor{vendors.length===1?'':'s'} · {inventoryCount} active inventory item{inventoryCount===1?'':'s'}</Text>:null}</>;
  const empty=loading?<ActivityIndicator color={FateDropColors.violetLight} style={styles.state}/>:<Text style={styles.state}>{error||(vendors.length?'No vendors match this search.':'No confirmed vendor list has been published for this encounter yet.')}</Text>;
  return <SafeAreaView style={styles.safe}><FateDropBackground/><FlatList data={visibleVendors} keyExtractor={vendor=>vendor.id} contentContainerStyle={styles.content} ListHeaderComponent={header} ListEmptyComponent={empty} renderItem={({item})=><VendorCard vendor={item}/>} /></SafeAreaView>;
}

function VendorCard({vendor}:{vendor:EncounterVendor}){
  const inventory=vendor.inventory||[];
  const location=[vendor.zoneLabel,vendor.stallLabel].filter(Boolean).join(' · ')||'Table / stall TBC';
  const openVendor=()=>{if(vendor.retailerId){router.push({pathname:'/retailers/[id]',params:{id:vendor.retailerId}});return;}if(vendor.websiteUrl&&isSafeExternalUrl(vendor.websiteUrl))void Linking.openURL(vendor.websiteUrl);};
  return <View style={styles.card}>
    <View style={styles.cardTop}><View style={styles.copy}><Text style={styles.title}>{vendor.name}</Text><Text style={styles.vendor}>{location}</Text></View>{vendor.stallLabel?<StatusBadge label={`Table ${vendor.stallLabel}`} color={FateDropColors.violetLight}/>:null}</View>
    <View style={styles.meta}>{vendor.verificationStatus==='fatedrop_verified'?<StatusBadge label="FateDrop verified" color={FateDropColors.mint}/>:null}{vendor.verificationStatus==='source_verified'?<StatusBadge label="Source verified" color={FateDropColors.cyan}/>:null}{(vendor.supportedTcgs||[]).slice(0,3).map(tcg=><StatusBadge key={tcg} label={tcg} color={FateDropColors.blue}/>)}</View>
    {inventory.length?<View style={styles.inventoryBlock}>{inventory.map(item=><InventoryRow key={item.id} item={item}/>)}</View>:<View style={styles.noStock}><Ionicons name="storefront-outline" size={15} color={FateDropColors.cyan}/><Text style={styles.noStockText}>Confirmed vendor location only — no event stock has been reported by this vendor.</Text></View>}
    {vendor.retailerId||vendor.websiteUrl?<Pressable onPress={openVendor} style={styles.primary}><Text style={styles.primaryText}>{vendor.retailerId?'Vendor profile':'Vendor website'}</Text><Ionicons name="chevron-forward" size={14} color={FateDropColors.text}/></Pressable>:null}
  </View>;
}

function InventoryRow({item}:{item:EncounterInventoryItem}){
  const evidence=item.evidenceScope==='fatedrop_event_inventory'?'FateDrop event inventory':'Vendor reported';
  return <View style={styles.inventoryRow}><View style={styles.inventoryTop}><Text style={styles.inventoryTitle}>{item.title}</Text><Text style={styles.price}>{money(item.pricePence)}</Text></View><View style={styles.meta}><StatusBadge label={item.availability.replaceAll('_',' ')} color={item.availability==='sold_out'?FateDropColors.coral:FateDropColors.mint}/><StatusBadge label={evidence} color={FateDropColors.cyan}/>{item.quantity!=null?<StatusBadge label={`Qty ${item.quantity}`} color={FateDropColors.amber}/>:null}</View><Text style={styles.observed}>Observed {new Date(item.observedAt).toLocaleString('en-GB')}{item.expiresAt?` · expires ${new Date(item.expiresAt).toLocaleString('en-GB')}`:''}</Text></View>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:80},back:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:12},backText:{color:FateDropColors.text,fontWeight:'800'},truth:{padding:12,borderRadius:15,backgroundColor:`${FateDropColors.mint}08`,borderWidth:1,borderColor:`${FateDropColors.mint}30`,marginBottom:12},truthText:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,marginTop:7},search:{flexDirection:'row',alignItems:'center',gap:9,padding:12,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:10},input:{flex:1,color:FateDropColors.text},vendorCount:{color:FateDropColors.muted,fontSize:10,marginBottom:14},state:{color:FateDropColors.muted,textAlign:'center',margin:35},card:{padding:15,borderRadius:18,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border,marginBottom:9},cardTop:{flexDirection:'row',alignItems:'flex-start',gap:10},copy:{flex:1},title:{color:FateDropColors.text,fontWeight:'900',fontSize:16},vendor:{color:FateDropColors.secondary,fontSize:10,marginTop:5},meta:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:9},inventoryBlock:{marginTop:13,gap:8},inventoryRow:{padding:12,borderRadius:14,backgroundColor:`${FateDropColors.violetLight}0A`,borderWidth:1,borderColor:`${FateDropColors.violetLight}20`},inventoryTop:{flexDirection:'row',gap:10,alignItems:'flex-start'},inventoryTitle:{flex:1,color:FateDropColors.text,fontWeight:'800',fontSize:12},price:{color:FateDropColors.mint,fontWeight:'900',fontSize:14},observed:{color:FateDropColors.muted,fontSize:9,lineHeight:14,marginTop:9},noStock:{flexDirection:'row',gap:9,alignItems:'flex-start',padding:11,borderRadius:13,backgroundColor:`${FateDropColors.cyan}07`,borderWidth:1,borderColor:`${FateDropColors.cyan}20`,marginTop:12},noStockText:{flex:1,color:FateDropColors.muted,fontSize:9,lineHeight:14},primary:{marginTop:12,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',padding:10,borderRadius:12,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontWeight:'800',fontSize:10}});
