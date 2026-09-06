import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import type { FateCollectorsSnapshot } from '@/services/fate-market';

export function FateCollectorEnhancements({
  data: _data,
  onCollectionChanged: _onCollectionChanged,
  signedIn,
}: {
  data: FateCollectorsSnapshot | null;
  onCollectionChanged: () => Promise<void>;
  signedIn: boolean;
}) {
  useEffect(() => {
    if (!signedIn) return;
    const frame = requestAnimationFrame(() => router.replace('/collections'));
    return () => cancelAnimationFrame(frame);
  }, [signedIn]);

  if (!signedIn) return null;

  return (
    <View style={styles.redirecting}>
      <ActivityIndicator size="small" color={FateDropColors.goldBright} />
      <Text style={styles.copy}>Opening Fate Collections…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  redirecting: { minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 8 },
  copy: { color: FateDropColors.secondary, fontSize: 9 },
});
