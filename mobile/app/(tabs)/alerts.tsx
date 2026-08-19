import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AbstractHero, ActivityItem, FateDropBackground, FateDropHeader, FilterChip, IconButton, StatCard, StatusBadge, type StatusTone } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';

const presentation: Record<string,{label:string;tone:StatusTone;icon:'flash'|'sparkles'|'close-circle'|'information-circle'}> = {
  ECHO:{label:'Fate Echo',tone:'violet',icon:'flash'}, MANIFESTED:{label:'Manifested',tone:'mint',icon:'sparkles'},
  WHISPER:{label:'Whisper',tone:'blue',icon:'sparkles'}, VANISHED:{label:'Vanished',tone:'red',icon:'close-circle'},
  UNKNOWN:{label:'Unknown',tone:'neutral',icon:'information-circle'},
};
const ago=(value?:string)=>{if(!value)return '';const minutes=Math.floor((Date.now()-new Date(value).getTime())/60000);return minutes<1?'Just now':minutes<60?`${minutes}m ago`:minutes<1440?`${Math.floor(minutes/60)}h ago`:`${Math.floor(minutes/1440)}d ago`};

export default function AlertsScreen(){
  const [events,setEvents]=useState<any[]>([]), [filter,setFilter]=useState<'all'|'live'|'vanished'>('all');
  useEffect(()=>{fetch(`${API_BASE_URL}/api/events`).then(r=>r.json()).then(d=>setEvents(Array.isArray(d.events)?d.events:[])).catch(e=>console.error('Failed to load FateDrop events:',e))},[]);
  const shown=events.filter(event=>filter==='all'||(filter==='live'?['ECHO','MANIFESTED'].includes(event.fateStage):event.fateStage==='VANISHED'));
  const critical=events.filter(event=>event.priority==='CRITICAL').length;
  return <SafeAreaView style={styles.safeArea} edges={['top','bottom']}><FateDropBackground/><ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <FateDropHeader title="Alerts" rightAction={<IconButton icon="notifications" badge={critical||undefined} active/>}/>
    <AbstractHero eyebrow="Signal feed" title="Every movement leaves an echo." subtitle="Follow restocks, new listings and vanished products across the connected market." icon="pulse"/>
    <View style={styles.stats}><StatCard icon="flash" value={critical.toString()} label="Critical" color={FateDropColors.coral}/><StatCard icon="radio" value={events.length.toString()} label="Signals" color={FateDropColors.cyan}/></View>
    <View style={styles.filters}><FilterChip label="All signals" active={filter==='all'} onPress={()=>setFilter('all')}/><FilterChip label="Live stock" active={filter==='live'} onPress={()=>setFilter('live')}/><FilterChip label="Vanished" active={filter==='vanished'} onPress={()=>setFilter('vanished')}/></View>
    <View style={styles.summaryRow}><Text style={styles.summaryText}>{shown.length} verified events</Text><StatusBadge label="Live feed" color={FateDropColors.mint}/></View>
    <View style={styles.activityList}>{shown.length?shown.map(event=>{const view=presentation[event.fateStage]||presentation.UNKNOWN;return <ActivityItem key={event.id} icon={view.icon} type={view.label} title={event.product?.title||event.title||'Catalogue event'} detail={event.message||event.type} retailer={event.retailer||'Pokémon Center UK'} time={ago(event.detectedAt)} tone={view.tone} unread={event.priority==='CRITICAL'} compact/>}):<View style={styles.empty}><Text style={styles.emptyTitle}>The signal is quiet</Text><Text style={styles.emptyText}>New market movement will appear here automatically.</Text></View>}</View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:FateDropColors.background},screen:{flex:1,backgroundColor:'transparent',zIndex:1},content:{paddingHorizontal:20,paddingTop:0,paddingBottom:120},stats:{flexDirection:'row',gap:10,marginBottom:14},filters:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},summaryRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},summaryText:{color:FateDropColors.text,fontSize:15,fontWeight:'800'},activityList:{zIndex:2},empty:{padding:28,alignItems:'center',borderRadius:22,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},emptyTitle:{color:FateDropColors.text,fontSize:17,fontWeight:'800'},emptyText:{color:FateDropColors.muted,fontSize:12,lineHeight:18,textAlign:'center',marginTop:6}});
