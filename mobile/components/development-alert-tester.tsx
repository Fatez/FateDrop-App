import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import {
  scheduleDevelopmentSignalNotification,
  type DevelopmentSignalNotification,
} from '@/lib/notifications';

const SIGNALS: { signal: DevelopmentSignalNotification; label: string }[] = [
  { signal: 'echo', label: 'Echo' },
  { signal: 'manifested', label: 'Manifested' },
  { signal: 'vanished', label: 'Vanished' },
  { signal: 'fatematch', label: 'FateMatch' },
  { signal: 'major', label: 'Major' },
];

export function DevelopmentAlertTester({
  onPreview,
}: {
  onPreview: (signal: DevelopmentSignalNotification) => void;
}) {
  const [selected, setSelected] = useState<DevelopmentSignalNotification>('echo');
  const [status, setStatus] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  if (!__DEV__) return null;

  const preview = (signal: DevelopmentSignalNotification) => {
    setSelected(signal);
    setStatus(null);
    onPreview(signal);
  };

  const schedule = async () => {
    setScheduling(true);
    setStatus(null);
    try {
      const result = await scheduleDevelopmentSignalNotification(selected, 5);
      if (result.scheduled) {
        setStatus(`${selected.toUpperCase()} notification scheduled for 5 seconds.`);
      } else {
        setStatus(`Notification unavailable: ${result.reason}.`);
      }
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Notification test failed.');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <View style={styles.icon}>
          <Ionicons name="flask" size={16} color={FateDropColors.cyan} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
          <Text style={styles.title}>Test Companion + notification</Text>
          <Text style={styles.copy}>Preview a signal immediately, then schedule the same iPhone notification five seconds later.</Text>
        </View>
      </View>

      <View style={styles.signalWrap}>
        {SIGNALS.map(({ signal, label }) => {
          const active = signal === selected;
          return (
            <Pressable
              key={signal}
              onPress={() => preview(signal)}
              style={[styles.signalButton, active && styles.signalButtonActive]}
            >
              <Text style={[styles.signalText, active && styles.signalTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable disabled={scheduling} onPress={() => void schedule()} style={styles.notificationButton}>
        <Ionicons name="notifications" size={15} color={FateDropColors.text} />
        <Text style={styles.notificationText}>
          {scheduling ? 'SCHEDULING…' : `SEND ${selected.toUpperCase()} NOTIFICATION · 5S`}
        </Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.note}>Keep FateDrop open to test the foreground banner. Repeat, then background the app before the five seconds expire to test normal iOS delivery.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    marginBottom: 18,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${FateDropColors.cyan}42`,
    backgroundColor: `${FateDropColors.cyan}08`,
  },
  headingRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${FateDropColors.cyan}14`,
  },
  headingCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: FateDropColors.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  copy: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  signalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  signalButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    backgroundColor: FateDropColors.glass,
  },
  signalButtonActive: { borderColor: FateDropColors.violetLight, backgroundColor: `${FateDropColors.violet}22` },
  signalText: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900' },
  signalTextActive: { color: FateDropColors.violetLight },
  notificationButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FateDropColors.violet,
  },
  notificationText: { color: FateDropColors.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  status: { color: FateDropColors.cyan, fontSize: 9, lineHeight: 14, marginTop: 9 },
  note: { color: FateDropColors.muted, fontSize: 8, lineHeight: 13, marginTop: 9 },
});
