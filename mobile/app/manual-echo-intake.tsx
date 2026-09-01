import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { buildManualEchoIntake, type ManualEchoScope, type ManualEchoSource } from '@/services/manual-echo-intake';

function defaultExpiry() {
  return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={FateDropColors.muted} autoCapitalize="sentences" autoCorrect={false} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function ManualEchoIntakeScreen() {
  const [scope, setScope] = useState<ManualEchoScope>('online_retailer_readiness');
  const [sourceType, setSourceType] = useState<ManualEchoSource>('operator_manual');
  const [retailerId, setRetailerId] = useState('');
  const [retailerName, setRetailerName] = useState('');
  const [signalTitle, setSignalTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [timingLabel, setTimingLabel] = useState('Movement observed now · be ready');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [targetBranches, setTargetBranches] = useState('');
  const [evidenceBasis, setEvidenceBasis] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const preview = useMemo(() => {
    try {
      return buildManualEchoIntake({ scope, sourceType, retailerId, retailerName, signalTitle, sourceUrl, timingLabel, expiresAt, targetBranches, evidenceBasis, note });
    } catch {
      return null;
    }
  }, [scope, sourceType, retailerId, retailerName, signalTitle, sourceUrl, timingLabel, expiresAt, targetBranches, evidenceBasis, note]);

  const build = () => buildManualEchoIntake({ scope, sourceType, retailerId, retailerName, signalTitle, sourceUrl, timingLabel, expiresAt, targetBranches, evidenceBasis, note });
  const share = async () => {
    setMessage('');
    try {
      const packet = build();
      await Share.share({ title: packet.issueTitle, message: packet.shareText });
      setMessage('Echo intake packet prepared. Sharing it does not claim confirmed stock.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Echo intake packet could not be prepared.');
    }
  };
  const openIssue = async () => {
    setMessage('');
    try {
      const packet = build();
      if (packet.issueUrl.length > 7_500) throw new Error('This packet is too large for a browser issue link. Use SHARE INTAKE PACKET instead.');
      await Linking.openURL(packet.issueUrl);
      setMessage('Review the GitHub issue carefully, then submit it from the authorised Fatez account to trigger Echo intake.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The authorised Echo issue could not be opened.');
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text}/><Text style={styles.backText}>Fate Network</Text></Pressable>
    <Text style={styles.eyebrow}>AUTHORISED OPERATOR · MANUAL ECHO</Text>
    <Text style={styles.title}>Turn credible movement into a truthful Echo.</Text>
    <Text style={styles.copy}>Manual intelligence can say “be ready”, but it can never claim Manifested stock. The authorised GitHub issue is the secure trigger; no operator secret is stored in the App.</Text>

    <View style={styles.truth}><StatusBadge label="ECHO ONLY" color={FateDropColors.echo}/><Text style={styles.truthCopy}>Online readiness can alert retailer-wide. Physical intelligence requires exact branch names; its national interrupt remains held until radius targeting is proven.</Text></View>

    <Text style={styles.section}>INTELLIGENCE SCOPE</Text>
    <View style={styles.chips}><FilterChip label="Online readiness" active={scope === 'online_retailer_readiness'} onPress={() => setScope('online_retailer_readiness')}/><FilterChip label="Physical branches" active={scope === 'physical_branch'} onPress={() => setScope('physical_branch')}/></View>
    <Text style={styles.help}>{scope === 'online_retailer_readiness' ? 'Use for Pokémon Centre traffic, queues, access changes, influencer readiness intel or other credible retailer-wide movement.' : 'Use for named stores that may receive stock. Influencer/manual evidence becomes Echo · Reported; first-party allocation becomes Echo · Expected.'}</Text>

    <Text style={styles.section}>SOURCE CLASS</Text>
    <View style={styles.chips}><FilterChip label="Influencer / manual" active={sourceType === 'operator_manual'} onPress={() => setSourceType('operator_manual')}/><FilterChip label="Official retailer" active={sourceType === 'official_retailer_page'} onPress={() => setSourceType('official_retailer_page')}/></View>

    <Field label="Retailer name" value={retailerName} onChangeText={setRetailerName} placeholder="Pokémon Centre UK"/>
    <Field label={scope === 'physical_branch' ? 'Canonical FateDrop retailer ID' : 'Retailer ID (optional)'} value={retailerId} onChangeText={setRetailerId} placeholder={scope === 'physical_branch' ? 'entertainer-uk' : 'pokemon-centre-uk'}/>
    <Field label="Movement / product" value={signalTitle} onChangeText={setSignalTitle} placeholder="Traffic and queue movement observed"/>
    <Field label="Source URL (HTTPS)" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://…"/>
    <Field label="Timing label" value={timingLabel} onChangeText={setTimingLabel} placeholder="Movement observed now · be ready"/>
    <Field label="Evidence expires (ISO)" value={expiresAt} onChangeText={setExpiresAt} placeholder="2026-09-03T12:00:00.000Z"/>
    {scope === 'physical_branch' ? <Field label="Exact branch names · one per line" value={targetBranches} onChangeText={setTargetBranches} placeholder={'The Entertainer Watford\nThe Entertainer Bluewater'} multiline/> : null}
    <Field label="What did you receive or observe?" value={evidenceBasis} onChangeText={setEvidenceBasis} placeholder="Influencer report, queue behaviour, retailer wording, screenshots or corroboration…" multiline/>
    <Field label="Operator note (optional)" value={note} onChangeText={setNote} placeholder="Why this is useful and what customers should do." multiline/>

    {preview ? <View style={styles.preview}><Text style={styles.previewTitle}>{preview.stage}{preview.physicalEvidenceState ? ` · ${preview.physicalEvidenceState.toUpperCase()}` : ' · READINESS'}</Text><Text style={styles.previewCopy}>Ready to prepare an authorised intake issue. This remains non-Manifested and availabilityVerified=false.</Text></View> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <Pressable onPress={() => void openIssue()} style={styles.primary}><Text style={styles.primaryText}>OPEN AUTHORISED ECHO ISSUE</Text><Ionicons name="open-outline" size={16} color={FateDropColors.text}/></Pressable>
    <Pressable onPress={() => void share()} style={styles.secondary}><Text style={styles.secondaryText}>SHARE INTAKE PACKET</Text><Ionicons name="share-outline" size={16} color={FateDropColors.echo}/></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:FateDropColors.background},content:{padding:20,paddingBottom:120},back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,marginBottom:12},backText:{color:FateDropColors.text,fontWeight:'800'},eyebrow:{color:FateDropColors.echo,fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{color:FateDropColors.text,fontFamily:Fonts?.serif,fontSize:31,lineHeight:36,fontWeight:'700',marginTop:7},copy:{color:FateDropColors.secondary,fontSize:12,lineHeight:18,marginTop:9},truth:{padding:14,borderRadius:17,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:`${FateDropColors.echo}0D`,marginTop:16,gap:9},truthCopy:{color:FateDropColors.secondary,fontSize:10,lineHeight:16},section:{color:FateDropColors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.2,marginTop:20,marginBottom:8},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},help:{color:FateDropColors.secondary,fontSize:10,lineHeight:16,marginTop:8},field:{marginTop:14},fieldLabel:{color:FateDropColors.text,fontSize:10,fontWeight:'900',marginBottom:6},input:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:FateDropColors.border,backgroundColor:FateDropColors.glass,color:FateDropColors.text,paddingHorizontal:13,paddingVertical:11,fontSize:11},multiline:{minHeight:96,textAlignVertical:'top'},preview:{padding:14,borderRadius:16,borderWidth:1,borderColor:`${FateDropColors.echo}38`,backgroundColor:FateDropColors.cardElevated,marginTop:18},previewTitle:{color:FateDropColors.echo,fontSize:10,fontWeight:'900',letterSpacing:.8},previewCopy:{color:FateDropColors.secondary,fontSize:9,lineHeight:14,marginTop:5},message:{color:FateDropColors.cyan,fontSize:10,lineHeight:15,marginTop:12},primary:{minHeight:50,marginTop:16,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:FateDropColors.violet},primaryText:{color:FateDropColors.text,fontSize:10,fontWeight:'900',letterSpacing:.6},secondary:{minHeight:48,marginTop:9,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:`${FateDropColors.echo}55`,backgroundColor:`${FateDropColors.echo}0D`},secondaryText:{color:FateDropColors.echo,fontSize:10,fontWeight:'900',letterSpacing:.6},
});
