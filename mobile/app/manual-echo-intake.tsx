import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { buildManualGlobalEchoIntake } from '@/services/manual-echo-intake';

function Field({ label, value, onChangeText, placeholder, multiline = false, url = false, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; url?: boolean; maxLength: number }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={FateDropColors.muted} autoCapitalize={url ? 'none' : 'sentences'} autoCorrect={false} keyboardType={url ? 'url' : 'default'} maxLength={maxLength} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function ManualEchoIntakeScreen() {
  const [headline, setHeadline] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');

  const preview = useMemo(() => {
    try {
      return buildManualGlobalEchoIntake({ headline, message: alertMessage, sourceUrl });
    } catch {
      return null;
    }
  }, [alertMessage, headline, sourceUrl]);

  const build = () => buildManualGlobalEchoIntake({ headline, message: alertMessage, sourceUrl });
  const share = async () => {
    setMessage('');
    try {
      const packet = build();
      await Share.share({ title: packet.issueTitle, message: packet.shareText });
      setMessage('Recovery packet prepared. Sharing it does not send the alert.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Echo intake packet could not be prepared.');
    }
  };
  const openIssue = async (packet: ReturnType<typeof buildManualGlobalEchoIntake>) => {
    setMessage('');
    try {
      if (packet.issueUrl.length > 7_500) throw new Error('This packet is too large for a browser issue link. Use SHARE INTAKE PACKET instead.');
      await Linking.openURL(packet.issueUrl);
      setMessage('Final review opened. Submit the pre-filled issue from the authorised Fatez account; Cloud will deduplicate and deliver the Echo.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The authorised Echo issue could not be opened.');
    }
  };
  const confirm = () => {
    setMessage('');
    let packet: ReturnType<typeof buildManualGlobalEchoIntake>;
    try {
      packet = build();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The global Echo could not be prepared.');
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

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Fate Network</Text></Pressable>
    <Text style={styles.eyebrow}>AUTHORISED OPERATOR · GLOBAL ECHO</Text>
    <Text style={styles.title}>Send the network a human signal.</Text>
    <Text style={styles.copy}>Write the time-sensitive information people need and give them the safest link to check. This creates a real Echo alert after your final authorised submission.</Text>

    <View style={styles.truth}><StatusBadge label="REAL ECHO · GLOBAL" color={FateDropColors.echo}/><Text style={styles.truthCopy}>Delivered once to eligible, opted-in Pokémon Echo subscribers. Notification choices and quiet hours remain respected. This cannot create Manifested stock.</Text></View>

    <Text style={styles.section}>ALERT CONTENT</Text>
    <Field label="Headline" value={headline} onChangeText={setHeadline} placeholder="Pokémon Centre movement — be ready" maxLength={220}/>
    <Field label="Short message" value={alertMessage} onChangeText={setAlertMessage} placeholder="Traffic is rising now. Check the link and be prepared" multiline maxLength={120}/>
    <Field label="Link customers should check (HTTPS)" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://…" url maxLength={700}/>

    {preview ? <View style={styles.preview}><Text style={styles.previewTitle}>GLOBAL ECHO PREVIEW</Text><Text style={styles.previewHeadline}>{headline.trim()}</Text><Text style={styles.previewCopy}>{alertMessage.trim()}</Text><Text style={styles.previewLink}>CHECK LINK →</Text></View> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <Pressable onPress={confirm} style={styles.primary}><Text style={styles.primaryText}>REVIEW & SEND GLOBAL ECHO</Text><Ionicons name="notifications-outline" size={16} color={FateDropColors.text}/></Pressable>
    <Pressable onPress={() => void share()} style={styles.secondary}><Text style={styles.secondaryText}>SHARE RECOVERY PACKET</Text><Ionicons name="share-outline" size={16} color={FateDropColors.echo}/></Pressable>
    <Text style={styles.footnote}>The final GitHub review proves the request came from the authorised Fatez account. Cloud then records, deduplicates and distributes the Echo without storing an operator secret in this App.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,marginBottom:12},backText:{color:FateDropColors.text,fontWeight:'800'},eyebrow:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:31,lineHeight:36,fontWeight:'700',marginTop:7},copy:{color:FateDropColors.secondary,fontSize:12,lineHeight:18,marginTop:9},truth:{padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:`${FateDropColors.echo}0D`,marginTop:16,gap:9},truthCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16},section:{color:FateDropColors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.2,marginTop:20,marginBottom:2},field:{marginTop:14},fieldLabel:{color:FateDropColors.text,fontSize:10,fontWeight:'900',marginBottom:6},input:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,color:FateDropColors.text,paddingHorizontal:13,paddingVertical:11,fontSize:11},multiline:{minHeight:86,textAlignVertical:'top'},preview:{padding:14,borderRadius:16,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:FateDropColors.cardElevated,marginTop:18},previewTitle:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:.8},previewHeadline:{color:FateDropColors.text,fontSize:15,fontWeight:'900',lineHeight:20,marginTop:7},previewCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,marginTop:5},previewLink:{color:FateDropColors.cyan,fontSize:9,fontWeight:'900',letterSpacing:.5,marginTop:10},message:{color:FateDropColors.cyan,fontSize:10,lineHeight:15,marginTop:12},primary:{minHeight:50,marginTop:16,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontSize:10,fontWeight:'900',letterSpacing:.6},secondary:{minHeight:48,marginTop:9,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:`${FateDropColors.echo}55`,backgroundColor:`${FateDropColors.echo}0D`},secondaryText:{color:FateDropColors.echo,fontSize:10,fontWeight:'900',letterSpacing:.6},footnote:{color:FateDropColors.muted,fontSize:8,lineHeight:13,textAlign:'center',marginTop:12},
});
