import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FateDropHeader, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { registerForStockAlerts, unregisterStockAlerts } from '@/lib/notifications';
import { updateRemoteNotificationPreferences } from '@/services/fatedrop-id';

const money=(pence:number|null)=>pence==null?'delivery unknown':`£${(pence/100).toFixed(2)} delivered`;
const ago=(epoch:number)=>{const m=Math.max(0,Math.floor((Date.now()-epoch*1000)/60000));return m<1?'Just now':m<60?`${m}m ago`:m<1440?`${Math.floor(m/60)}h ago`:`${Math.floor(m/1440)}d ago`;};

export default function AlertsScreenV2(){
  const {snapshot,signedIn,refresh,syncing}=useFateDropId();
  const [pushWorking,setPushWorking]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  useFocusEffect(useCallback(()=>{if(signedIn)void refresh();},[refresh,signedIn]));
  const preferences=snapshot?.notificationPreferences;
  const fateFinds=snapshot?.fateFinds||[];
  const fateMatches=snapshot?.fateMatches||[];

  const toggle=async(key:'echo'|'manifested'|'vanished'|'priceChange'|'fateMatch'|'web'|'discord')=>{
    if(!preferences)return;
    setMessage(null);
    try{await updateRemoteNotificationPreferences({[key]:!preferences[key]});await refresh();}catch(cause){setMessage(cause instanceof Error?cause.message:'Preference could not sync.');}
  };
  const togglePush=async()=>{setPushWorking(true);setMessage(null);try{const result=preferences?.push?await unregisterStockAlerts():await registerForStockAlerts();setMessage(result.enabled?'Push enabled on this device.':'Push disabled on this device.');await refresh();}catch(cause){setMessage(cause instanceof Error?cause.message:'Push could not be updated.');}finally{setPushWorking(false);}};

  return <SafeAreaView style={styles.safe}><FateDropBackground/><ScrollView contentContainerStyle={styles.content}>
    <FateDropHeader title="Alerts" rightAction={<Pressable onPress={()=>router.push('/fatefind')} style={styles.headerAction}><Ionicons name="telescope" size={18} color={FateDropColors.violetLight}/></Pressable>}/>
    <AbstractHero eyebrow="Your alerts" title="Only the signals that matter to you." subtitle="Hosted FateFind hunts, FateMatch history and delivery settings live here. Global network activity stays on Home." icon="notifications"/>
    {!signedIn?<View style={styles.empty}><Text style={styles.emptyTitle}>Connect FateDrop ID</Text><Text style={styles.emptyText}>Sign in once to sync hunts, membership and notification history across web and mobile.</Text><Pressable onPress={()=>router.push('/account')} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable></View>:<>
      <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{fateFinds.filter(x=>x.enabled!==false).length}</Text><Text style={styles.statLabel}>Hosted FateFinds</Text></View><View style={styles.stat}><Text style={styles.statValue}>{fateMatches.length}</Text><Text style={styles.statLabel}>FateMatches</Text></View></View>
      <Header eyebrow="ACTIVE HUNTS" title="FateFind" action={()=>router.push('/fatefind')}/>
      <View style={styles.list}>{fateFinds.length?fateFinds.map(find=><Pressable key={find.id} onPress={()=>router.push('/fatefind')} style={styles.card}><View style={styles.icon}><Ionicons name="cloud-done" size={17} color={FateDropColors.violetLight}/></View><View style={styles.copy}><Text style={styles.cardTitle}>{String(find.query||find.queryText||'FateFind')}</Text><Text style={styles.cardDetail}>Evaluated by FateDrop Cloud while your app is closed.</Text></View><StatusBadge label={find.enabled===false?'Paused':'Watching'} color={find.enabled===false?FateDropColors.muted:FateDropColors.mint}/></Pressable>):<Compact title="No hosted hunts yet" text="Create a FateFind and let the network watch it for you."/>}</View>
      <Header eyebrow="PERSONAL HISTORY" title="FateMatch results"/>
      <View style={styles.list}>{fateMatches.length?fateMatches.slice(0,50).map(match=><View key={match.id} style={styles.match}><View style={styles.matchIcon}><Ionicons name="checkmark" size={16} color={FateDropColors.mint}/></View><View style={styles.copy}><Text style={styles.matchLabel}>FATEMATCH</Text><Text style={styles.cardTitle}>{match.title}</Text><Text style={styles.cardDetail}>{match.retailerName} · {money(match.deliveredPricePence)} · {ago(match.matchedAt)}</Text></View></View>):<Compact title="No FateMatches yet" text="A result appears here when an observed offer satisfies one of your hosted FateFinds."/>}</View>
      <Header eyebrow="DELIVERY" title="Notification channels"/>
      <View style={styles.preference}><View style={styles.copy}><Text style={styles.cardTitle}>Push on this device</Text><Text style={styles.cardDetail}>Requires explicit device permission and a signed-in FateDrop ID.</Text></View><Pressable disabled={pushWorking} onPress={()=>void togglePush()}><StatusBadge label={preferences?.push?'On':'Off'} color={preferences?.push?FateDropColors.mint:FateDropColors.muted}/></Pressable></View>
      <View style={styles.prefs}>{(['fateMatch','priceChange','echo','manifested','vanished','web','discord'] as const).map(key=><Pressable key={key} onPress={()=>void toggle(key)} style={styles.pref}><Text style={styles.prefName}>{key.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase())}</Text><Text style={preferences?.[key]?styles.on:styles.off}>{preferences?.[key]?'ON':'OFF'}</Text></Pressable>)}</View>
      {message?<Text style={styles.message}>{message}</Text>:null}<Text style={styles.sync}>{syncing?'Syncing with FateDrop ID…':`Last sync ${snapshot?ago(snapshot.syncedAt):'unavailable'}`}</Text>
    </>}
  </ScrollView></SafeAreaView>;
}
function Header({eyebrow,title,action}:{eyebrow:string;title:string;action?:()=>void}){return <View style={styles.section}><View><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action?<Pressable onPress={action}><Text style={styles.link}>Manage</Text></Pressable>:null}</View>}
function Compact({title,text}:{title:string;text:string}){return <View style={styles.compact}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:FateDropColors.background},content:{paddingHorizontal:20,paddingBottom:120},headerAction:{padding:9,borderRadius:12,backgroundColor:FateDropColors.glass},stats:{flexDirection:'row',gap:10,marginBottom:18},stat:{flex:1,padding:14,borderRadius:17,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},statValue:{color:FateDropColors.text,fontWeight:'900',fontSize:22},statLabel:{color:FateDropColors.muted,fontSize:9,marginTop:4},section:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',marginTop:8,marginBottom:9},eyebrow:{color:FateDropColors.cyan,fontSize:8,fontWeight:'900',letterSpacing:1.1},sectionTitle:{color:FateDropColors.text,fontWeight:'900',fontSize:19,marginTop:3},link:{color:FateDropColors.violetLight,fontSize:11,fontWeight:'900'},list:{gap:9,marginBottom:17},card:{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:17,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},icon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:`${FateDropColors.violetLight}14`},copy:{flex:1},cardTitle:{color:FateDropColors.text,fontWeight:'900',fontSize:12},cardDetail:{color:FateDropColors.muted,fontSize:9,lineHeight:14,marginTop:4},match:{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.mint}35`,backgroundColor:FateDropColors.glass},matchIcon:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:`${FateDropColors.mint}16`},matchLabel:{color:FateDropColors.mint,fontSize:8,fontWeight:'900',letterSpacing:1.2,marginBottom:3},preference:{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:17,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,marginBottom:9},prefs:{gap:7},pref:{flexDirection:'row',justifyContent:'space-between',padding:12,borderRadius:13,backgroundColor:FateDropColors.glass,borderWidth:1,borderColor:FateDropColors.border},prefName:{color:FateDropColors.secondary,fontSize:10,fontWeight:'800'},on:{color:FateDropColors.mint,fontWeight:'900',fontSize:9},off:{color:FateDropColors.muted,fontWeight:'900',fontSize:9},empty:{padding:22,alignItems:'center',borderRadius:20,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},compact:{padding:17,alignItems:'center',borderRadius:17,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},emptyTitle:{color:FateDropColors.text,fontSize:14,fontWeight:'900'},emptyText:{color:FateDropColors.muted,fontSize:10,lineHeight:16,textAlign:'center',marginTop:5},primary:{marginTop:12,paddingVertical:11,paddingHorizontal:18,borderRadius:12,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontWeight:'900'},message:{color:FateDropColors.cyan,fontSize:10,marginTop:12},sync:{color:FateDropColors.muted,fontSize:8,textAlign:'center',marginTop:16}});
