import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import type { CanonicalMobileAlert } from '@/services/canonical-alerts';
import { globalEchoAccessState } from '@/services/operator-access';
import { listRetractableGlobalEchoes, retractGlobalEcho } from '@/services/operator-global-echo-retraction';

export default function ManualEchoRetractionsScreen() {
  const { snapshot, signedIn, loading, syncing, error } = useFateDropId();
  const operatorAccess = globalEchoAccessState({ snapshot, signedIn, loading, syncing, error });
  const [alerts, setAlerts] = useState<CanonicalMobileAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setMessage('');
    try { setAlerts(await listRetractableGlobalEchoes()); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Global Echo history is unavailable.'); }
  };

  useEffect(() => {
    if (operatorAccess === 'denied') router.replace('/notification-preferences');
    if (operatorAccess === 'authorized') void reload();
  }, [operatorAccess]);

  const confirm = (alert: CanonicalMobileAlert) => {
    const cleanReason = reason.trim();
    if (selectedId !== alert.id || cleanReason.length < 3) {
      setSelectedId(alert.id);
      setReason('');
      setMessage('Add a short reason, then confirm the retraction.');
      return;
    }
    Alert.alert(
      'Retract this Global Echo?',
      'It will disappear from active App/Web Alerts and any queued operator push will be cancelled. The original audit evidence remains intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retract Echo', style: 'destructive', onPress: () => void (async () => {
          setBusy(true); setMessage('');
          try {
            await retractGlobalEcho(alert.id, cleanReason);
            setAlerts((current) => current.filter((item) => item.id !== alert.id));
            setSelectedId(null); setReason('');
            setMessage('Global Echo retracted. Active App/Web views will no longer show it.');
          } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : 'Global Echo could not be retracted.');
          } finally { setBusy(false); }
        })() },
      ],
    );
  };

  if (operatorAccess !== 'authorized') return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Global Echo</Text></Pressable>
    <Text style={styles.eyebrow}>AUTHORISED OPERATOR · RETRACTION</Text>
    <Text style={styles.title}>Remove a mistaken human signal.</Text>
    <Text style={styles.copy}>Only manually created Global Echoes appear here. Retraction is append-only: it hides the active alert and cancels queued operator push without creating Vanished or changing stock truth.</Text>
    <View style={styles.truth}><StatusBadge label="OWNER ONLY · AUDITED" color={FateDropColors.echo}/><Text style={styles.truthCopy}>The original Echo and delivery history remain available for audit. Automated lifecycle evidence cannot be retracted from this control.</Text></View>

    {message ? <Text style={styles.message}>{message}</Text> : null}
    <View style={styles.heading}><Text style={styles.section}>ACTIVE GLOBAL ECHOES</Text><Pressable disabled={busy} onPress={() => void reload()}><Text style={styles.refresh}>REFRESH</Text></Pressable></View>
    {alerts.length ? alerts.map((alert) => <View style={styles.card} key={alert.id}>
      <Text style={styles.cardLabel}>ECHO · ISSUE #{alert.operatorIntelligence?.operatorIssue ?? '—'}</Text>
      <Text style={styles.cardTitle}>{alert.title}</Text>
      <Text style={styles.cardCopy}>{alert.operatorIntelligence?.expectedLabel || alert.message}</Text>
      <Text style={styles.cardTime}>{new Date(alert.detectedAt).toLocaleString('en-GB')}</Text>
      {selectedId === alert.id ? <View style={styles.reasonBox}><Text style={styles.reasonLabel}>RETRACTION REASON</Text><TextInput value={reason} onChangeText={setReason} multiline maxLength={300} placeholder="Incorrect link / wording / sent in error" placeholderTextColor={FateDropColors.muted} style={styles.input}/></View> : null}
      <Pressable disabled={busy} onPress={() => confirm(alert)} style={styles.danger}><Text style={styles.dangerText}>{selectedId === alert.id ? 'CONFIRM RETRACTION' : 'RETRACT ECHO'}</Text><Ionicons name="trash-outline" size={15} color={FateDropColors.vanished}/></Pressable>
      {selectedId === alert.id ? <Pressable disabled={busy} onPress={() => { setSelectedId(null); setReason(''); setMessage(''); }} style={styles.cancel}><Text style={styles.cancelText}>CANCEL</Text></Pressable> : null}
    </View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No active manual Global Echoes.</Text><Text style={styles.emptyCopy}>Nothing currently needs an operator retraction.</Text></View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,marginBottom:12},backText:{color:FateDropColors.text,fontWeight:'800'},eyebrow:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:31,lineHeight:36,fontWeight:'700',marginTop:7},copy:{color:FateDropColors.secondary,fontSize:12,lineHeight:18,marginTop:9},truth:{padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:`${FateDropColors.echo}0D`,marginTop:16,gap:9},truthCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16},message:{color:FateDropColors.cyan,fontSize:10,lineHeight:15,marginTop:14},heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:22},section:{color:FateDropColors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.2},refresh:{color:FateDropColors.cyan,fontSize:8,fontWeight:'900',letterSpacing:.7},card:{padding:15,borderRadius:16,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.cardElevated,marginTop:10},cardLabel:{color:FateDropColors.echo,fontSize:8,fontWeight:'900',letterSpacing:.7},cardTitle:{color:FateDropColors.text,fontSize:15,fontWeight:'900',lineHeight:20,marginTop:6},cardCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,marginTop:5},cardTime:{color:FateDropColors.muted,fontSize:8,marginTop:7},reasonBox:{marginTop:12},reasonLabel:{color:FateDropColors.text,fontSize:9,fontWeight:'900',marginBottom:6},input:{minHeight:74,borderRadius:12,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,color:FateDropColors.text,paddingHorizontal:12,paddingVertical:10,fontSize:11,textAlignVertical:'top'},danger:{minHeight:46,marginTop:13,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:`${FateDropColors.vanished}55`,backgroundColor:`${FateDropColors.vanished}10`},dangerText:{color:FateDropColors.vanished,fontSize:9,fontWeight:'900',letterSpacing:.6},cancel:{minHeight:40,marginTop:7,alignItems:'center',justifyContent:'center'},cancelText:{color:FateDropColors.muted,fontSize:9,fontWeight:'900'},empty:{padding:18,borderRadius:15,borderWidth:1,borderColor:FateDropColors.border,marginTop:10},emptyTitle:{color:FateDropColors.text,fontSize:12,fontWeight:'900'},emptyCopy:{color:FateDropColors.muted,fontSize:9,marginTop:5},
});
