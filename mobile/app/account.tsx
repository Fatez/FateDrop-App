import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FATEDROP_WEB_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { requestFateDropAccountDeletion } from '@/services/account-deletion';

const website = FATEDROP_WEB_URL;
const showExternalMembershipManagement = Platform.OS !== 'ios';

export default function AccountScreen() {
  const { snapshot, signedIn, signIn, signOut, forgetLocalSession, refresh, syncing, error } = useFateDropId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Enter your FateDrop ID email and password.');
      return;
    }
    try {
      await signIn(email.trim(), password);
      setPassword('');
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    }
  };

  const submitDeletion = async () => {
    setDeleting(true);
    try {
      await requestFateDropAccountDeletion();
      await forgetLocalSession();
      Alert.alert(
        'Deletion requested',
        'Your FateDrop account deletion request has been securely recorded. You have been signed out on this device. FateDrop will process the request under the Privacy Policy.',
      );
    } catch (cause) {
      Alert.alert(
        'Deletion request not submitted',
        cause instanceof Error ? cause.message : 'FateDrop could not submit your deletion request. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletion = () => {
    Alert.alert(
      'Delete FateDrop account?',
      'This submits a permanent deletion request for your FateDrop account and associated personal data. Once the deletion is processed, it cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void submitDeletion() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={FateDropColors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>FATEDROP ID</Text>
        <Text style={styles.hero}>One identity. One entitlement.</Text>
        <Text style={styles.lede}>Website, app and connected Discord access use the same account. Premium unlocks only after the backend membership record confirms it.</Text>

        {!signedIn ? (
          <View style={styles.card}>
            <Text style={styles.title}>Sign in</Text>
            <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="Email" placeholderTextColor={FateDropColors.muted} style={styles.input} />
            <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Password" placeholderTextColor={FateDropColors.muted} style={styles.input} />
            {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}
            <Pressable disabled={syncing} onPress={() => void submit()} style={styles.primary}>
              <Text style={styles.primaryText}>{syncing ? 'Connecting…' : 'Sign in to FateDrop ID'}</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(`${website}/account/register`)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Create FateDrop ID on website ↗</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.identity}>
              <View style={styles.avatar}><Text style={styles.avatarText}>FD</Text></View>
              <View style={styles.flex}>
                <Text style={styles.handle}>{snapshot?.user.displayName || snapshot?.user.handle || 'Collector'}</Text>
                <Text style={styles.fateId}>{snapshot?.user.fateId}</Text>
                <Text style={styles.email}>{snapshot?.user.email}</Text>
              </View>
              <View style={styles.pill}><Text style={styles.pillText}>{snapshot?.entitlement.effectiveTier.toUpperCase()}</Text></View>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <View><Text style={styles.label}>MEMBERSHIP</Text><Text style={styles.value}>{snapshot?.entitlement.status || 'unknown'}</Text></View>
                <Text style={snapshot?.entitlement.active ? styles.live : styles.free}>{snapshot?.entitlement.active ? 'ACTIVE' : 'FREE'}</Text>
              </View>
              <Text style={styles.note}>The client cannot promote itself. Stripe/account processing changes the server membership; this screen only consumes the resulting entitlement.</Text>
              <Pressable disabled={syncing} onPress={() => void refresh()} style={styles.secondary}>
                <Text style={styles.secondaryText}>{syncing ? 'Syncing…' : 'Sync membership now'}</Text>
              </Pressable>
              {showExternalMembershipManagement ? (
                <Pressable onPress={() => void Linking.openURL(`${website}/subscriptions`)} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Manage membership on website ↗</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>SERVER-CONFIRMED CAPABILITIES</Text>
              <View style={styles.capabilities}>
                {snapshot?.entitlement.capabilities.map((capability) => (
                  <View key={capability} style={styles.cap}>
                    <Ionicons name="checkmark-circle" size={14} color={FateDropColors.mint} />
                    <Text style={styles.capText}>{capability.replaceAll('_', ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>

            {snapshot?.pendingMigrations.length ? (
              <View style={styles.warning}>
                <Text style={styles.warningTitle}>Sync migration still required</Text>
                <Text style={styles.warningText}>{snapshot.pendingMigrations.join(', ')}</Text>
              </View>
            ) : null}

            <Pressable onPress={() => void signOut()} style={styles.signOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>PRIVACY & ACCOUNT</Text>
          <Text style={styles.note}>Review how FateDrop handles account and personal data.</Text>
          <Pressable onPress={() => void Linking.openURL(`${website}/privacy`)} style={styles.secondary}>
            <Text style={styles.secondaryText}>Privacy Policy ↗</Text>
          </Pressable>
          {signedIn ? (
            <Pressable disabled={deleting} onPress={confirmDeletion} style={styles.danger}>
              <Text style={styles.dangerText}>{deleting ? 'Submitting deletion request…' : 'Delete account'}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { padding: 20, paddingBottom: 80 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10 },
  backText: { color: FateDropColors.text, fontWeight: '800' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 18 },
  hero: { color: FateDropColors.text, fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 8 },
  lede: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  card: { gap: 11, padding: 16, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 },
  title: { color: FateDropColors.text, fontSize: 18, fontWeight: '900' },
  input: { color: FateDropColors.text, backgroundColor: FateDropColors.cardElevated, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border },
  primary: { alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontWeight: '900' },
  secondary: { alignItems: 'center', padding: 12, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border },
  secondaryText: { color: FateDropColors.violetLight, fontWeight: '800', fontSize: 11 },
  error: { color: FateDropColors.coral, fontSize: 11 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 19, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: `${FateDropColors.violet}55`, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violet}22`, borderWidth: 1, borderColor: FateDropColors.violet },
  avatarText: { color: FateDropColors.text, fontWeight: '900' },
  flex: { flex: 1 },
  handle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' },
  fateId: { color: FateDropColors.violetLight, fontSize: 9, fontWeight: '800', marginTop: 3 },
  email: { color: FateDropColors.muted, fontSize: 9, marginTop: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: `${FateDropColors.mint}14` },
  pillText: { color: FateDropColors.mint, fontSize: 9, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  value: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 4 },
  live: { color: FateDropColors.mint, fontWeight: '900', fontSize: 10 },
  free: { color: FateDropColors.muted, fontWeight: '900', fontSize: 10 },
  note: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16 },
  capabilities: { gap: 7, marginTop: 4 },
  cap: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  capText: { color: FateDropColors.secondary, fontSize: 10 },
  warning: { padding: 14, borderRadius: 16, backgroundColor: `${FateDropColors.amber}12`, borderWidth: 1, borderColor: `${FateDropColors.amber}40`, marginBottom: 12 },
  warningTitle: { color: FateDropColors.amber, fontWeight: '900', fontSize: 11 },
  warningText: { color: FateDropColors.secondary, fontSize: 10, marginTop: 4 },
  signOut: { alignItems: 'center', padding: 13 },
  signOutText: { color: FateDropColors.coral, fontWeight: '800' },
  danger: { alignItems: 'center', padding: 12, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.coral}66`, backgroundColor: `${FateDropColors.coral}0D` },
  dangerText: { color: FateDropColors.coral, fontWeight: '900', fontSize: 11 },
});
