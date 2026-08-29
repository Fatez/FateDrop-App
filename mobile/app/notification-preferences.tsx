import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { registerForStockAlerts, sendLocalRadarPresentationTest, unregisterStockAlerts } from '@/lib/notifications';
import { updateRemoteNotificationPreferences } from '@/services/fatedrop-id';

type PreferenceKey = 'whisper' | 'echo' | 'manifested' | 'vanished' | 'fateMatch' | 'priceChange' | 'web' | 'discord';

const rows: { key: PreferenceKey; title: string; detail: string }[] = [
  { key: 'whisper', title: 'Whisper', detail: 'Product or catalogue movement before stock is confirmed.' },
  { key: 'echo', title: 'Echo', detail: 'Queue, traffic, security or access-readiness changes.' },
  { key: 'manifested', title: 'Manifested', detail: 'Verified purchasable availability.' },
  { key: 'vanished', title: 'Vanished', detail: 'Previously verified availability is no longer present.' },
  { key: 'fateMatch', title: 'FateMatch', detail: 'A FateMatch hunt has found a qualifying live offer.' },
  { key: 'priceChange', title: 'Price change', detail: 'Relevant movement in observed item pricing.' },
  { key: 'web', title: 'Web inbox', detail: 'Keep eligible alert history available on the FateDrop dashboard.' },
  { key: 'discord', title: 'Discord', detail: 'Allow eligible alerts to use your linked Discord delivery preferences.' },
];

function pushStatusMessage(result: { enabled: boolean; reason?: string }) {
  if (result.enabled) return 'Push notifications enabled on this device.';
  if (result.reason === 'permission-denied') return 'Push is off because notification permission was denied on this device.';
  if (result.reason === 'physical-device-required') return 'Push registration requires a physical device.';
  if (result.reason === 'fatedrop-id-required') return 'Sign in with FateDrop ID before enabling push.';
  if (result.reason === 'eas-project-id-required') return 'Push setup is incomplete: this app build is missing its Expo/EAS project ID.';
  return 'Push notifications disabled on this device.';
}

export default function NotificationPreferencesScreen() {
  const { snapshot, signedIn, refresh, syncing } = useFateDropId();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const preferences = snapshot?.notificationPreferences;

  const toggle = async (key: PreferenceKey) => {
    if (!preferences || working) return;
    setWorking(key);
    setMessage(null);
    try {
      await updateRemoteNotificationPreferences({ [key]: !preferences[key] });
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Preference could not be updated.');
    } finally {
      setWorking(null);
    }
  };

  const togglePush = async () => {
    if (!preferences || working) return;
    setWorking('push');
    setMessage(null);
    try {
      const result = preferences.push ? await unregisterStockAlerts() : await registerForStockAlerts();
      setMessage(pushStatusMessage(result));
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Push preference could not be updated.');
    } finally {
      setWorking(null);
    }
  };

  const testLocalRadar = async () => {
    if (working) return;
    setWorking('test-local-radar');
    setMessage(null);
    try {
      const result = await sendLocalRadarPresentationTest();
      if (result.sent) setMessage('Local Radar TEST alert sent. Tap the banner to inspect the incoming-stock card and map handoff.');
      else if (result.reason === 'permission-denied') setMessage('Local Radar test could not run because iOS notification permission is off.');
      else setMessage('Local Radar test requires a physical device.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Local Radar test could not be sent.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="Notifications" subtitle="DELIVERY PREFERENCES" rightAction={<Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={19} color={FateDropColors.text} /></Pressable>} />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CONTROL DELIVERY · NOT DETECTION</Text>
          <Text style={styles.title}>Choose what reaches you.</Text>
          <Text style={styles.copy}>The Signal Engine can still observe network activity when a delivery preference is off. These settings control your notification surfaces, not the underlying evidence.</Text>
        </View>

        {!signedIn || !preferences ? <View style={styles.empty}><Text style={styles.emptyTitle}>FateDrop ID required</Text><Text style={styles.emptyCopy}>Sign in before changing account-level delivery preferences.</Text><Pressable onPress={() => router.push('/account')} style={styles.primary}><Text style={styles.primaryText}>SIGN IN</Text></Pressable></View> : <>
          <Text style={styles.sectionLabel}>DEVICE</Text>
          <PreferenceRow title="Push on this device" detail="Native device alert permission and FateDrop push registration." enabled={Boolean(preferences.push)} disabled={Boolean(working)} onPress={() => void togglePush()} />
          <Pressable disabled={Boolean(working)} onPress={() => void testLocalRadar()} style={({ pressed }) => [styles.localRadarTestRow, pressed && styles.pressed]}>
            <View style={styles.localRadarTestIcon}><Ionicons name="radio-outline" size={17} color={FateDropColors.cyan} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.localRadarTestTitle}>{working === 'test-local-radar' ? 'Sending Local Radar test…' : 'TEST LOCAL RADAR ALERT'}</Text>
              <Text style={styles.rowDetail}>QA only · fires the real Local Radar notification route and incoming-stock card without creating stock data.</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionLabel}>ALERT TYPES</Text>
          {rows.slice(0, 6).map((row) => <PreferenceRow key={row.key} title={row.title} detail={row.detail} enabled={Boolean(preferences[row.key])} disabled={Boolean(working)} onPress={() => void toggle(row.key)} />)}

          <Text style={styles.sectionLabel}>SURFACES</Text>
          {rows.slice(6).map((row) => <PreferenceRow key={row.key} title={row.title} detail={row.detail} enabled={Boolean(preferences[row.key])} disabled={Boolean(working)} onPress={() => void toggle(row.key)} />)}

          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.sync}>{syncing ? 'Syncing with FateDrop ID…' : 'Preferences are stored against your FateDrop ID.'}</Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceRow({ title, detail, enabled, disabled, onPress }: { title: string; detail: string; enabled: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><View style={[styles.switch, enabled && styles.switchOn]}><View style={[styles.knob, enabled && styles.knobOn]} /></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 80 },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  hero: { padding: 20, marginBottom: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(168,85,247,.22)', backgroundColor: 'rgba(10,11,18,.92)' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: FateDropColors.text, fontSize: 27, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  sectionLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 8, marginBottom: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.9)' },
  localRadarTestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.cyan}55`, backgroundColor: `${FateDropColors.cyan}0D` },
  localRadarTestIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.cyan}55` },
  localRadarTestTitle: { color: FateDropColors.cyan, fontSize: 11, fontWeight: '900', letterSpacing: .5 },
  rowCopy: { flex: 1 },
  rowTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  rowDetail: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 4 },
  switch: { width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: '#252938', justifyContent: 'center' },
  switchOn: { backgroundColor: 'rgba(124,58,237,.72)' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: FateDropColors.muted },
  knobOn: { alignSelf: 'flex-end', backgroundColor: FateDropColors.text },
  empty: { alignItems: 'center', padding: 28, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  emptyTitle: { color: FateDropColors.text, fontSize: 15, fontWeight: '900' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, marginTop: 6, textAlign: 'center' },
  primary: { marginTop: 14, backgroundColor: FateDropColors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  primaryText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900' },
  message: { color: FateDropColors.cyan, fontSize: 9, marginTop: 10 },
  sync: { color: FateDropColors.muted, fontSize: 8, marginTop: 10, marginBottom: 20 },
  pressed: { opacity: 0.75 },
});
