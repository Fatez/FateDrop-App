import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { buildManualGlobalEchoIntake, buildManualGlobalEchoRevisionIntake } from '@/services/manual-echo-intake';
import { globalEchoAccessState } from '@/services/operator-access';

type ComposerMode = 'send' | 'edit';
type EchoPacket = ReturnType<typeof buildManualGlobalEchoIntake> | ReturnType<typeof buildManualGlobalEchoRevisionIntake>;

function Field({ label, value, onChangeText, placeholder, multiline = false, url = false, numeric = false, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; url?: boolean; numeric?: boolean; maxLength: number }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={FateDropColors.muted} autoCapitalize={url ? 'none' : 'sentences'} autoCorrect={false} keyboardType={url ? 'url' : numeric ? 'number-pad' : 'default'} maxLength={maxLength} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function ManualEchoIntakeScreen() {
  const { snapshot, signedIn, loading, syncing, error } = useFateDropId();
  const operatorAccess = globalEchoAccessState({ snapshot, signedIn, loading, syncing, error });
  const [mode, setMode] = useState<ComposerMode>('send');
  const [operatorIssue, setOperatorIssue] = useState('');
  const [retailerName, setRetailerName] = useState('');
  const [headline, setHeadline] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (operatorAccess === 'denied') router.replace('/notification-preferences');
  }, [operatorAccess]);

  const build = (): EchoPacket => mode === 'edit'
    ? buildManualGlobalEchoRevisionIntake({ operatorIssue, retailerName, headline, message: alertMessage, sourceUrl })
    : buildManualGlobalEchoIntake({ headline, message: alertMessage, sourceUrl });

  const preview = useMemo(() => {
    try {
      return build();
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertMessage, headline, mode, operatorIssue, retailerName, sourceUrl]);

  const switchMode = (next: ComposerMode) => {
    setMessage('');
    setMode(next);
  };

  const share = async () => {
    setMessage('');
    try {
      const packet = build();
      await Share.share({ title: packet.issueTitle, message: packet.shareText });
      setMessage(mode === 'edit' ? 'Correction packet prepared. Sharing it does not alter the live Echo.' : 'Recovery packet prepared. Sharing it does not send the alert.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Echo intake packet could not be prepared.');
    }
  };

  const openIssue = async (packet: EchoPacket) => {
    setMessage('');
    try {
      if (packet.issueUrl.length > 7_500) throw new Error('This packet is too large for a browser issue link. Use SHARE INTAKE PACKET instead.');
      await Linking.openURL(packet.issueUrl);
      setMessage(mode === 'edit'
        ? 'Correction review opened. The inspection branch is not merged, so do not rely on production applying this correction yet.'
        : 'Final review opened. Submit the pre-filled issue from the authorised Fatez account; Cloud will deduplicate and deliver the Echo.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The authorised Echo issue could not be opened.');
    }
  };

  const confirm = () => {
    setMessage('');
    let packet: EchoPacket;
    try {
      packet = build();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The global Echo could not be prepared.');
      return;
    }
    if (mode === 'edit') {
      Alert.alert(
        'Review active Echo correction?',
        'This prepares an append-only correction for the same active Echo. It must not create a second signal, change lifecycle truth, or send another push. Nothing is merged or deployed from this inspection branch.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open correction review', onPress: () => void openIssue(packet) },
        ],
      );
      return;
    }
    Alert.alert(
      'Send a real global Echo?',
      'After you submit the final authorised issue, this will notify eligible Pokémon users with Echo alerts enabled. It remains readiness intelligence and never claims confirmed stock.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue to send', onPress: () => void openIssue(packet) },
      ],
    );
  };

  if (operatorAccess !== 'authorized') {
    return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/></SafeAreaView>;
  }

  const editing = mode === 'edit';

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Fate Network</Text></Pressable>
    <Text style={styles.eyebrow}>AUTHORISED OPERATOR · GLOBAL ECHO</Text>
    <Text style={styles.title}>{editing ? 'Correct an active Echo.' : 'Send the network a human signal.'}</Text>
    <Text style={styles.copy}>{editing ? 'Correct the presentation of an existing manual Echo without creating another signal or another push. The original revision remains auditable.' : 'Write the time-sensitive information people need and give them the safest link to check. This creates a real Echo alert after your final authorised submission.'}</Text>

    <View style={styles.modeSwitch}>
      <Pressable onPress={() => switchMode('send')} style={[styles.modeItem, !editing && styles.modeActive]}><Text style={[styles.modeText, !editing && styles.modeTextActive]}>SEND NEW</Text></Pressable>
      <Pressable onPress={() => switchMode('edit')} style={[styles.modeItem, editing && styles.modeActive]}><Text style={[styles.modeText, editing && styles.modeTextActive]}>EDIT ACTIVE</Text></Pressable>
    </View>

    <View style={styles.truth}><StatusBadge label={editing ? 'CORRECTION · NO NEW PUSH' : 'REAL ECHO · GLOBAL'} color={FateDropColors.echo}/><Text style={styles.truthCopy}>{editing ? 'Only approved presentation fields can change. Stage, availability truth, original detection time and expiry remain owned by the original Echo. Delivered iPhone notifications cannot be rewritten.' : 'Delivered once to eligible, opted-in Pokémon Echo subscribers. Notification choices and quiet hours remain respected. This cannot create Manifested stock.'}</Text></View>

    <Text style={styles.section}>{editing ? 'ACTIVE ECHO TO CORRECT' : 'ALERT CONTENT'}</Text>
    {editing ? <>
      <Field label="Original Echo issue #" value={operatorIssue} onChangeText={setOperatorIssue} placeholder="371" numeric maxLength={12}/>
      <Field label="Retailer name" value={retailerName} onChangeText={setRetailerName} placeholder="The Entertainer" maxLength={120}/>
    </> : null}
    <Field label={editing ? 'Corrected headline' : 'Headline'} value={headline} onChangeText={setHeadline} placeholder={editing ? 'Several' : 'Pokémon Centre movement — be ready'} maxLength={220}/>
    <Field label={editing ? 'Corrected short message' : 'Short message'} value={alertMessage} onChangeText={setAlertMessage} placeholder={editing ? 'Coming 16th September' : 'Traffic is rising now. Check the link and be prepared'} multiline maxLength={120}/>
    <Field label={editing ? 'Corrected source link (HTTPS, optional)' : 'Link customers should check (HTTPS)'} value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://…" url maxLength={700}/>

    {preview ? <View style={styles.preview}><Text style={styles.previewTitle}>{editing ? 'ACTIVE ECHO CORRECTION PREVIEW' : 'GLOBAL ECHO PREVIEW'}</Text><Text style={styles.previewHeadline}>{headline.trim()}</Text><Text style={styles.previewRetailer}>{editing ? retailerName.trim() : null}</Text><Text style={styles.previewCopy}>{alertMessage.trim()}</Text><Text style={styles.previewLink}>{editing ? 'SAME ECHO · NO NEW PUSH' : 'CHECK LINK →'}</Text></View> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <Pressable onPress={confirm} style={styles.primary}><Text style={styles.primaryText}>{editing ? 'REVIEW ACTIVE ECHO CORRECTION' : 'REVIEW & SEND GLOBAL ECHO'}</Text><Ionicons name={editing ? 'create-outline' : 'notifications-outline'} size={16} color={FateDropColors.text}/></Pressable>
    <Pressable onPress={() => void share()} style={styles.secondary}><Text style={styles.secondaryText}>{editing ? 'SHARE CORRECTION PACKET' : 'SHARE RECOVERY PACKET'}</Text><Ionicons name="share-outline" size={16} color={FateDropColors.echo}/></Pressable>
    <Text style={styles.footnote}>{editing ? 'Inspection safety: the correction uses a dedicated [FATEDROP ECHO EDIT] operator issue. Current production does not consume that prefix, so this branch cannot alter the live Echo until the matching Cloud work is separately approved, merged and deployed.' : 'The final GitHub review proves the request came from the authorised Fatez account. Cloud then records, deduplicates and distributes the Echo without storing an operator secret in this App.'}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,marginBottom:12},backText:{color:FateDropColors.text,fontWeight:'800'},eyebrow:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:31,lineHeight:36,fontWeight:'700',marginTop:7},copy:{color:FateDropColors.secondary,fontSize:12,lineHeight:18,marginTop:9},modeSwitch:{flexDirection:'row',gap:6,marginTop:16,padding:4,borderRadius:14,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass},modeItem:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:10},modeActive:{backgroundColor:FateDropColors.cardElevated},modeText:{color:FateDropColors.muted,fontSize:9,fontWeight:'900',letterSpacing:.6},modeTextActive:{color:FateDropColors.echo},truth:{padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:`${FateDropColors.echo}0D`,marginTop:16,gap:9},truthCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16},section:{color:FateDropColors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.2,marginTop:20,marginBottom:2},field:{marginTop:14},fieldLabel:{color:FateDropColors.text,fontSize:10,fontWeight:'900',marginBottom:6},input:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,color:FateDropColors.text,paddingHorizontal:13,paddingVertical:11,fontSize:11},multiline:{minHeight:86,textAlignVertical:'top'},preview:{padding:14,borderRadius:16,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:FateDropColors.cardElevated,marginTop:18},previewTitle:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:.8},previewHeadline:{color:FateDropColors.text,fontSize:15,fontWeight:'900',lineHeight:20,marginTop:7},previewRetailer:{color:FateDropColors.cyan,fontSize:10,fontWeight:'800',marginTop:4},previewCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,marginTop:5},previewLink:{color:FateDropColors.cyan,fontSize:9,fontWeight:'900',letterSpacing:.5,marginTop:10},message:{color:FateDropColors.cyan,fontSize:10,lineHeight:15,marginTop:12},primary:{minHeight:50,marginTop:16,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontSize:10,fontWeight:'900',letterSpacing:.6},secondary:{minHeight:48,marginTop:9,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:`${FateDropColors.echo}55`,backgroundColor:`${FateDropColors.echo}0D`},secondaryText:{color:FateDropColors.echo,fontSize:10,fontWeight:'900',letterSpacing:.6},footnote:{color:FateDropColors.muted,fontSize:8,lineHeight:13,textAlign:'center',marginTop:12},
});
