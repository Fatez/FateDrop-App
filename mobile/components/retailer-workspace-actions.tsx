import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FATEDROP_WEB_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';

export function RetailerWorkspaceActions() {
  const opening = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function open(path: '/dashboard/indie' | '/join?type=business') {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      await openBrowserAsync(`${FATEDROP_WEB_URL}${path}`, { presentationStyle: WebBrowserPresentationStyle.PAGE_SHEET });
    } catch {
      setError('The FateDrop website could not be opened. Please try again.');
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }
  return <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void open('/dashboard/indie')} style={[styles.primary, busy && styles.busy]}>
      <Ionicons name="storefront-outline" size={19} color={FateDropColors.background} /><Text style={styles.primaryText}>Open retailer workspace</Text><Ionicons name="open-outline" size={16} color={FateDropColors.background} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void open('/join?type=business')} style={styles.secondary}>
      <Text style={styles.secondaryText}>Apply to connect your business</Text><Ionicons name="open-outline" size={16} color={FateDropColors.goldBright} />
    </Pressable>
    <Text style={styles.note}>Opens fatedrop.co.uk. Sign in there with the FateDrop ID linked to your shop. Close the browser to return here.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 10, marginVertical: 18 },
  primary: { minHeight: 48, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  primaryText: { flex: 1, color: FateDropColors.background, fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 48, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.border },
  secondaryText: { flex: 1, color: FateDropColors.goldBright, fontSize: 13, fontWeight: '700' },
  note: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18 },
  error: { color: FateDropColors.coral, fontSize: 13, lineHeight: 19 },
  busy: { opacity: .65 },
});
