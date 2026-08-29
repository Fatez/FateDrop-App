import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

export function ClosedBetaBoundary({ children }: { children: React.ReactNode }) {
  const { snapshot, loading, syncing, refresh, signOut } = useFateDropId();

  if (loading || !snapshot?.user || snapshot.accessAllowed) return <>{children}</>;

  const revoked = snapshot.betaAccess.status === 'revoked';

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <FateDropBackground />
    <View style={styles.screen}>
      <View style={styles.icon}><Ionicons name={revoked ? 'lock-closed-outline' : 'hourglass-outline'} size={28} color={FateDropColors.goldBright} /></View>
      <Text style={styles.eyebrow}>FATEDROP · CLOSED BETA</Text>
      <Text style={styles.title}>{revoked ? 'Beta access is not active.' : 'Your beta request is pending.'}</Text>
      <Text style={styles.copy}>
        {revoked
          ? 'This FateDrop ID is still valid, but it is not currently approved for the closed beta.'
          : 'Your FateDrop ID has been created, but beta access is approval-only. You will not receive the full App experience until this account is accepted.'}
      </Text>

      <View style={styles.statusCard}>
        <View><Text style={styles.statusLabel}>FATEDROP ID</Text><Text style={styles.statusValue}>{snapshot.user.fateId}</Text></View>
        <View><Text style={styles.statusLabel}>BETA STATUS</Text><Text style={styles.statusValue}>{revoked ? 'REVOKED' : 'PENDING APPROVAL'}</Text></View>
      </View>

      <Text style={styles.truth}>A TestFlight install or paid membership does not bypass this approval gate.</Text>

      <Pressable disabled={syncing} onPress={() => void refresh()} style={({ pressed }) => [styles.primary, (pressed || syncing) && styles.pressed]}>
        {syncing ? <ActivityIndicator size="small" color={FateDropColors.text} /> : <Ionicons name="refresh" size={16} color={FateDropColors.text} />}
        <Text style={styles.primaryText}>{syncing ? 'CHECKING APPROVAL…' : 'CHECK APPROVAL'}</Text>
      </Pressable>
      <Pressable disabled={syncing} onPress={() => void signOut()} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>SIGN OUT</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 24 },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.goldBright}44`, backgroundColor: `${FateDropColors.goldBright}0E`, marginBottom: 18 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: FateDropColors.text, fontFamily: Fonts?.serif, fontSize: 34, lineHeight: 39, fontWeight: '700', marginTop: 8, maxWidth: 520 },
  copy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, marginTop: 14, maxWidth: 560 },
  statusCard: { marginTop: 24, padding: 16, gap: 15, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  statusLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  statusValue: { color: FateDropColors.text, fontSize: 12, fontWeight: '900', marginTop: 5 },
  truth: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, marginTop: 16 },
  primary: { minHeight: 48, marginTop: 28, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.violet },
  primaryText: { color: FateDropColors.text, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  secondary: { minHeight: 44, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  secondaryText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  pressed: { opacity: .78 },
});
