import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { listActiveManualOperatorEchoes, type ActiveManualOperatorEcho } from '@/services/fatedrop-id';
import { buildManualGlobalEchoIntake, buildManualGlobalEchoRetraction } from '@/services/manual-echo-intake';
import { globalEchoAccessState, globalEchoRetractionAccessState, operatorEchoConsoleAccessState } from '@/services/operator-access';

type Mode = 'send' | 'retract';
type IssuePacket = { issueTitle: string; issueBody: string; issueUrl: string; shareText: string };

function Field({ label, value, onChangeText, placeholder, multiline = false, url = false, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; url?: boolean; maxLength: number }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={FateDropColors.muted} autoCapitalize={url ? 'none' : 'sentences'} autoCorrect={false} keyboardType={url ? 'url' : 'default'} maxLength={maxLength} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function echoDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
}

export default function ManualEchoIntakeScreen() {
  const { snapshot, signedIn, loading, syncing, error } = useFateDropId();
  const accessInput = { snapshot, signedIn, loading, syncing, error };
  const consoleAccess = operatorEchoConsoleAccessState(accessInput);
  const sendAccess = globalEchoAccessState(accessInput);
  const retractAccess = globalEchoRetractionAccessState(accessInput);
  const [mode, setMode] = useState<Mode>('send');
  const [headline, setHeadline] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [echoes, setEchoes] = useState<ActiveManualOperatorEcho[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (consoleAccess === 'denied') router.replace('/(tabs)/profile');
  }, [consoleAccess]);

  const activeMode: Mode = mode === 'send' && sendAccess !== 'authorized' && retractAccess === 'authorized' ? 'retract' : mode;

  const refreshEchoes = useCallback(async () => {
    if (retractAccess !== 'authorized') return;
    setHistoryLoading(true);
    setMessage('');
    try {
      const next = await listActiveManualOperatorEchoes();
      setEchoes(next);
      if (selectedIssue && !next.some((echo) => echo.operatorIssue === selectedIssue)) setSelectedIssue(null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Active manual Echoes could not be loaded.');
    } finally {
      setHistoryLoading(false);
      setHistoryLoaded(true);
    }
  }, [retractAccess, selectedIssue]);

  useEffect(() => {
    if (activeMode !== 'retract' || retractAccess !== 'authorized' || historyLoaded) return;
    const timer = setTimeout(() => void refreshEchoes(), 0);
    return () => clearTimeout(timer);
  }, [activeMode, historyLoaded, refreshEchoes, retractAccess]);

  const selectedEcho = echoes.find((echo) => echo.operatorIssue === selectedIssue) ?? null;
  const preview = useMemo(() => {
    try {
      return buildManualGlobalEchoIntake({ headline, message: alertMessage, sourceUrl });
    } catch {
      return null;
    }
  }, [alertMessage, headline, sourceUrl]);

  const share = async (packet: IssuePacket) => {
    setMessage('');
    try {
      await Share.share({ title: packet.issueTitle, message: packet.shareText });
      setMessage('Recovery packet prepared. Sharing it does not publish or retract anything.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Operator packet could not be prepared.');
    }
  };

  const openIssue = async (packet: IssuePacket, successMessage: string) => {
    setMessage('');
    try {
      if (packet.issueUrl.length > 7_500) throw new Error('This packet is too large for a browser issue link. Use SHARE RECOVERY PACKET instead.');
      await Linking.openURL(packet.issueUrl);
      setMessage(successMessage);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The authorised operator issue could not be opened.');
    }
  };

  const confirmSend = () => {
    let packet: ReturnType<typeof buildManualGlobalEchoIntake>;
    try {
      packet = buildManualGlobalEchoIntake({ headline, message: alertMessage, sourceUrl });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The global Echo could not be prepared.');
      return;
    }
    Alert.alert(
      'Send a real global Echo?',
      'Submitting the authorised issue will notify eligible Pokémon users with Echo alerts enabled. It remains readiness intelligence and never claims confirmed stock.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue to send', onPress: () => void openIssue(packet, 'Final review opened. Submit the pre-filled issue from the authorised Fatez account; Cloud will audit, deduplicate and deliver the Echo.') }],
    );
  };

  const retractionPacket = () => buildManualGlobalEchoRetraction({ operatorIssue: selectedIssue || 0, headline: selectedEcho?.headline, reason });
  const confirmRetraction = () => {
    let packet: ReturnType<typeof buildManualGlobalEchoRetraction>;
    try {
      packet = retractionPacket();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The Echo retraction could not be prepared.');
      return;
    }
    Alert.alert(
      'Retract this manual Echo?',
      `${selectedEcho?.headline || `Echo #${selectedIssue}`} will leave active alert surfaces. Its original evidence and delivery history remain immutable, and this does not create Vanished.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Retract Echo', style: 'destructive', onPress: () => void openIssue(packet, 'Final retraction review opened. Submit the issue from the authorised Fatez account; Cloud will append the audit and Web will stop pending delivery.') }],
    );
  };

  if (consoleAccess !== 'authorized') return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Profile</Text></Pressable>
    <Text style={styles.eyebrow}>OWNER ONLY · OPERATOR ECHOES</Text>
    <Text style={styles.title}>One private control room.</Text>
    <Text style={styles.copy}>Publish reviewed human intelligence or retract one erroneous manual Echo. Both actions open an authorised GitHub command for final submission; no production secret lives on this device.</Text>

    <View style={styles.modeRow}>
      {sendAccess === 'authorized' ? <Pressable onPress={() => { setMode('send'); setMessage(''); }} style={[styles.mode, activeMode === 'send' && styles.modeActive]}><Ionicons name="radio-outline" size={16} color={activeMode === 'send' ? FateDropColors.text : FateDropColors.echo} /><Text style={[styles.modeText, activeMode === 'send' && styles.modeTextActive]}>SEND</Text></Pressable> : null}
      {retractAccess === 'authorized' ? <Pressable onPress={() => { setMode('retract'); setMessage(''); }} style={[styles.mode, activeMode === 'retract' && styles.modeDanger]}><Ionicons name="return-down-back-outline" size={16} color={activeMode === 'retract' ? FateDropColors.text : FateDropColors.coral} /><Text style={[styles.modeText, activeMode === 'retract' && styles.modeTextActive]}>RETRACT</Text></Pressable> : null}
    </View>

    {activeMode === 'send' ? <>
      <View style={styles.truth}><StatusBadge label="REAL ECHO · GLOBAL" color={FateDropColors.echo} /><Text style={styles.truthCopy}>Delivered once to eligible, opted-in Pokémon Echo subscribers. Notification choices and quiet hours remain respected. This cannot create Manifested stock.</Text></View>
      <Text style={styles.section}>ALERT CONTENT</Text>
      <Field label="Headline" value={headline} onChangeText={setHeadline} placeholder="Pokémon Centre movement — be ready" maxLength={220} />
      <Field label="Short message" value={alertMessage} onChangeText={setAlertMessage} placeholder="Traffic is rising now. Check the link and be prepared" multiline maxLength={120} />
      <Field label="Link customers should check (HTTPS)" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://…" url maxLength={700} />
      {preview ? <View style={styles.preview}><Text style={styles.previewTitle}>GLOBAL ECHO PREVIEW</Text><Text style={styles.previewHeadline}>{headline.trim()}</Text><Text style={styles.previewCopy}>{alertMessage.trim()}</Text><Text style={styles.previewLink}>CHECK LINK →</Text></View> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable onPress={confirmSend} style={styles.primary}><Text style={styles.primaryText}>REVIEW & SEND GLOBAL ECHO</Text><Ionicons name="notifications-outline" size={16} color={FateDropColors.text} /></Pressable>
      {preview ? <Pressable onPress={() => void share(preview)} style={styles.secondary}><Text style={styles.secondaryText}>SHARE RECOVERY PACKET</Text><Ionicons name="share-outline" size={16} color={FateDropColors.echo} /></Pressable> : null}
    </> : <>
      <View style={styles.dangerTruth}><StatusBadge label="AUDITED RETRACTION" color={FateDropColors.coral} /><Text style={styles.truthCopy}>Only an active, manually created readiness Echo can be selected. The original record stays untouched; pending pushes stop and delivered devices receive a plain correction.</Text></View>
      <View style={styles.sectionRow}><Text style={styles.section}>ACTIVE MANUAL ECHOES</Text><Pressable disabled={historyLoading} onPress={() => void refreshEchoes()}><Text style={styles.refresh}>{historyLoading ? 'LOADING…' : 'REFRESH'}</Text></Pressable></View>
      {historyLoading && !echoes.length ? <ActivityIndicator color={FateDropColors.coral} style={styles.loader} /> : null}
      {!historyLoading && !echoes.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No active manual Echoes</Text><Text style={styles.emptyCopy}>Retracted and automated lifecycle signals are deliberately absent from this owner list.</Text></View> : null}
      {echoes.map((echo) => {
        const selected = echo.operatorIssue === selectedIssue;
        return <Pressable key={echo.eventId} onPress={() => setSelectedIssue(echo.operatorIssue)} style={[styles.echoCard, selected && styles.echoSelected]}>
          <View style={styles.echoHead}><Text style={styles.echoIssue}>ISSUE #{echo.operatorIssue}</Text><Text style={styles.echoDate}>{echoDate(echo.createdAt)}</Text></View>
          <Text style={styles.echoTitle}>{echo.headline}</Text>
          <Text style={styles.echoDetail}>{echo.expectedLabel || 'Readiness movement'} · {echo.retailerName}</Text>
          {selected ? <View style={styles.selectedRow}><Ionicons name="checkmark-circle" size={14} color={FateDropColors.coral} /><Text style={styles.selectedText}>SELECTED FOR RETRACTION</Text></View> : null}
        </Pressable>;
      })}
      <Field label="Audit reason" value={reason} onChangeText={setReason} placeholder="Explain exactly why this manual Echo is being retracted" multiline maxLength={500} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable onPress={confirmRetraction} style={styles.danger}><Text style={styles.primaryText}>REVIEW & RETRACT ECHO</Text><Ionicons name="return-down-back-outline" size={16} color={FateDropColors.text} /></Pressable>
      {selectedEcho && reason.trim().length >= 10 ? <Pressable onPress={() => void share(retractionPacket())} style={styles.secondaryDanger}><Text style={styles.secondaryDangerText}>SHARE RECOVERY PACKET</Text><Ionicons name="share-outline" size={16} color={FateDropColors.coral} /></Pressable> : null}
    </>}
    <Text style={styles.footnote}>GitHub proves the request came from the authorised Fatez account. Cloud preserves the event ledger; Web owns delivery cancellation and correction.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,marginBottom:12},backText:{color:FateDropColors.text,fontWeight:'800'},eyebrow:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:31,lineHeight:36,fontWeight:'700',marginTop:7},copy:{color:FateDropColors.secondary,fontSize:12,lineHeight:18,marginTop:9},
  modeRow:{flexDirection:'row',gap:9,marginTop:17},mode:{flex:1,minHeight:44,borderRadius:13,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},modeActive:{borderColor:FateDropColors.echo,backgroundColor:`${FateDropColors.echo}22`},modeDanger:{borderColor:FateDropColors.coral,backgroundColor:`${FateDropColors.coral}22`},modeText:{color:FateDropColors.secondary,fontSize:9,fontWeight:'900',letterSpacing:.8},modeTextActive:{color:FateDropColors.text},
  truth:{padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:`${FateDropColors.echo}0D`,marginTop:16,gap:9},dangerTruth:{padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.coral}45`,backgroundColor:`${FateDropColors.coral}0D`,marginTop:16,gap:9},truthCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16},section:{color:FateDropColors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.2,marginTop:20,marginBottom:2},sectionRow:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},refresh:{color:FateDropColors.cyan,fontSize:8,fontWeight:'900',letterSpacing:.7,paddingVertical:8},
  field:{marginTop:14},fieldLabel:{color:FateDropColors.text,fontSize:10,fontWeight:'900',marginBottom:6},input:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,color:FateDropColors.text,paddingHorizontal:13,paddingVertical:11,fontSize:11},multiline:{minHeight:86,textAlignVertical:'top'},preview:{padding:14,borderRadius:16,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:FateDropColors.cardElevated,marginTop:18},previewTitle:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:.8},previewHeadline:{color:FateDropColors.text,fontSize:15,fontWeight:'900',lineHeight:20,marginTop:7},previewCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,marginTop:5},previewLink:{color:FateDropColors.cyan,fontSize:9,fontWeight:'900',letterSpacing:.5,marginTop:10},
  loader:{marginVertical:24},empty:{padding:18,borderRadius:16,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,marginTop:12},emptyTitle:{color:FateDropColors.text,fontSize:13,fontWeight:'900'},emptyCopy:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:5},echoCard:{padding:14,borderRadius:16,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.cardElevated,marginTop:10},echoSelected:{borderColor:FateDropColors.coral,backgroundColor:`${FateDropColors.coral}0D`},echoHead:{flexDirection:'row',justifyContent:'space-between',gap:8},echoIssue:{color:FateDropColors.cyan,fontSize:8,fontWeight:'900',letterSpacing:.7},echoDate:{color:FateDropColors.muted,fontSize:8},echoTitle:{color:FateDropColors.text,fontSize:14,fontWeight:'900',lineHeight:19,marginTop:7},echoDetail:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:4},selectedRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:9},selectedText:{color:FateDropColors.coral,fontSize:8,fontWeight:'900',letterSpacing:.6},
  message:{color:FateDropColors.cyan,fontSize:10,lineHeight:15,marginTop:12},primary:{minHeight:50,marginTop:16,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:FateDropColors.violet},danger:{minHeight:50,marginTop:16,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:FateDropColors.coral},primaryText:{color:FateDropColors.text,fontSize:10,fontWeight:'900',letterSpacing:.6},secondary:{minHeight:48,marginTop:9,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:`${FateDropColors.echo}55`,backgroundColor:`${FateDropColors.echo}0D`},secondaryText:{color:FateDropColors.echo,fontSize:10,fontWeight:'900',letterSpacing:.6},secondaryDanger:{minHeight:48,marginTop:9,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:`${FateDropColors.coral}55`,backgroundColor:`${FateDropColors.coral}0D`},secondaryDangerText:{color:FateDropColors.coral,fontSize:10,fontWeight:'900',letterSpacing:.6},footnote:{color:FateDropColors.muted,fontSize:8,lineHeight:13,textAlign:'center',marginTop:14},
});
