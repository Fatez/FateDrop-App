import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AbstractHero, FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { isFeatureEnabled, type FeatureFlag } from '@/constants/features';
import { FateDropColors } from '@/constants/theme';

interface MonitorHealth{retailer:string;status:string;inStockCount?:number;productCount?:number;lastSuccessAt?:string;lastFailureAt?:string;startedAt?:string;}
interface Destination{title:string;subtitle:string;icon:keyof typeof Ionicons.glyphMap;path:Href;color:string;feature?:FeatureFlag;}
const destinations:Destination[]=[
  {title:'Basket Breaker',subtitle:'Optimise the whole list including delivery',icon:'git-branch',path:'/basket-breaker',color:FateDropColors.mint,feature:'basketBreaker'},
  {title:'FateBounty',subtitle:'Structured collector stock requests',icon:'locate',path:'/fatebounty',color:FateDropColors.violetLight,feature:'fateBounty'},
  {title:'Demand Signal',subtitle:'Privacy-protected retailer demand trends',icon:'pulse',path:'/demand-signal',color:FateDropColors.cyan,feature:'demandSignal'},
  {title:'Wishlist',subtitle:'Saved offers, products and searches',icon:'bookmark',path:'/(tabs)/watchlist',color:FateDropColors.violetLight},
  {title:'True Price',subtitle:'Compare known delivered costs',icon:'pricetags',path:'/true-price',color:FateDropColors.cyan},
  {title:'FateFind',subtitle:'Create intelligent saved searches',icon:'telescope',path:'/fatefind',color:FateDropColors.violetLight},
  {title:'Local Radar',subtitle:'Nearby shops, shows and trade nights',icon:'navigate',path:'/local-radar',color:FateDropColors.blue,feature:'localRadar'},
  {title:'Event Vendor Demo',subtitle:'Search stalls and temporary show stock',icon:'albums',path:'/event-vendors',color:FateDropColors.coral,feature:'eventVendorMode'},
  {title:'Reserve & Collect Demo',subtitle:'Pending retailer-controlled reservations',icon:'bag-check',path:'/reserve-demo',color:FateDropColors.amber,feature:'reserveAndCollect'},
  {title:'Retailer Dashboard',subtitle:'Analytics, CSV import and plans',icon:'analytics',path:'/retailer-dashboard',color:FateDropColors.mint,feature:'retailerAnalytics'},
  {title:'FateScore',subtitle:'How retailer trust is measured',icon:'shield-checkmark',path:'/fatescore',color:FateDropColors.cyan,feature:'fateScore'},
  {title:'Fate Encounters',subtitle:'Shows, tournaments and trade nights',icon:'calendar',path:'/encounters',color:FateDropColors.amber},
  {title:'Retailer partners',subtitle:'Join the independent network',icon:'storefront',path:'/retailer-partners',color:FateDropColors.mint},
];
const checked=(monitor:MonitorHealth)=>{const value=monitor.lastSuccessAt||monitor.lastFailureAt||monitor.startedAt;return value?new Date(value).toLocaleString():'Never checked'};

export default function MoreScreen(){
  const [health,setHealth]=useState<MonitorHealth[]>([]);
  useFocusEffect(useCallback(()=>{void fetch(`${API_BASE_URL}/api/monitor-health`).then(response=>response.json()).then(data=>setHealth(Object.values(data.retailers||{}) as MonitorHealth[])).catch(console.error)},[]));
  const test=()=>Notifications.scheduleNotificationAsync({content:{title:"It's Fate — your product's live",body:'Test product · FateDrop Test Store · £49.99',sound:'default'},trigger:null});
  const visible=destinations.filter(item=>!item.feature||isFeatureEnabled(item.feature));
  return <SafeAreaView style={styles.safe}><FateDropBackground/><ScrollView contentContainerStyle={styles.content}><FateDropHeader title="More"/><AbstractHero eyebrow="Control centre" title="Your FateDrop network." subtitle="Price comparison, intelligent searches, events and retailer monitoring in one place." icon="options"/><View style={styles.destinations}>{visible.map(item=><Pressable key={item.title} onPress={()=>router.push(item.path)} style={styles.destination}><View style={[styles.icon,{backgroundColor:`${item.color}14`}]}><Ionicons name={item.icon} size={20} color={item.color}/></View><View style={{flex:1}}><Text style={styles.title}>{item.title}</Text><Text style={styles.subtitle}>{item.subtitle}</Text></View><Ionicons name="chevron-forward" size={17} color={FateDropColors.muted}/></Pressable>)}</View><Text style={styles.heading}>Retailer health</Text><View style={styles.health}>{health.map(monitor=><View key={monitor.retailer} style={styles.row}><View style={[styles.dot,{backgroundColor:monitor.status==='healthy'?FateDropColors.mint:FateDropColors.coral}]}/><View style={{flex:1}}><Text style={styles.title}>{monitor.retailer}</Text><Text style={styles.subtitle}>{Number(monitor.inStockCount||0).toLocaleString()} available · {Number(monitor.productCount||0).toLocaleString()} products</Text><Text style={styles.checked}>{checked(monitor)} · {monitor.status}</Text></View></View>)}</View><Pressable onPress={()=>void test()} style={styles.test}><Ionicons name="notifications" size={19} color={FateDropColors.text}/><Text style={styles.testText}>Send test stock alert</Text></Pressable></ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:120},destinations:{gap:9},destination:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:17,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},icon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center'},title:{color:FateDropColors.text,fontWeight:'900',fontSize:14},subtitle:{color:FateDropColors.muted,fontSize:10,marginTop:4},heading:{color:FateDropColors.text,fontSize:19,fontWeight:'900',marginVertical:17},health:{gap:8},row:{flexDirection:'row',alignItems:'center',gap:11,padding:13,borderRadius:16,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},dot:{width:8,height:8,borderRadius:4},checked:{color:FateDropColors.secondary,fontSize:9,marginTop:4,textTransform:'capitalize'},test:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9,padding:14,borderRadius:15,backgroundColor:FateDropColors.violet,marginTop:15},testText:{color:FateDropColors.text,fontWeight:'900'}});
