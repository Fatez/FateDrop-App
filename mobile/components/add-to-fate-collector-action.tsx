import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { addExactCardToCollector, FateCollectorApiError } from '@/services/fate-collector';

export function AddToFateCollectorAction({ cardIdentityId, setName }: { cardIdentityId: string; setName?: string | null }) {
  const { signedIn } = useFateDropId();
  const [working, setWorking] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState('');

  if (!cardIdentityId) return null;

  const add = async () => {
    if (!signedIn) {
      router.push('/account');
      return;
    }
    setWorking(true);
    setMessage('');
    try {
      await addExactCardToCollector(cardIdentityId);
      setAdded(true);
      setMessage(`Added one copy${setName ? ` to your ${setName} binder` : ' to FateCollector'}.`);
    } catch (error) {
      if (error instanceof FateCollectorApiError && error.status === 401) {
        router.push('/account');
        return;
      }
      setMessage(error instanceof Error ? error.message : 'This card could not be added right now.');
    } finally {
      setWorking(false);
    }
  };

  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={signedIn ? `Add this exact card to ${setName || 'FateCollector'}` : 'Connect FateDrop ID to add this card'} disabled={working} onPress={() => void add()} style={({ pressed }) => [styles.button, added && styles.buttonAdded, pressed && styles.pressed]}>
      {working ? <ActivityIndicator size="small" color={FateDropColors.background} /> : <Ionicons name={added ? 'checkmark-circle' : 'albums-outline'} size={17} color={FateDropColors.background} />}
      <View style={styles.copyWrap}>
        <Text style={styles.title}>{added ? 'ADDED TO COLLECTOR' : signedIn ? 'ADD TO COLLECTOR' : 'CONNECT TO ADD'}</Text>
        <Text style={styles.copy}>{setName ? `1 copy · ${setName} binder · exact variant` : '1 copy · exact canonical identity'}</Text>
      </View>
      {!working ? <Ionicons name={added ? 'checkmark' : 'add'} size={16} color={FateDropColors.background} /> : null}
    </Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 11 },
  button: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: FateDropColors.echo },
  buttonAdded: { opacity: .88 },
  copyWrap: { flex: 1 },
  title: { color: FateDropColors.background, fontSize: 7.8, fontWeight: '900', letterSpacing: .55 },
  copy: { color: 'rgba(3,7,18,.68)', fontSize: 6.3, marginTop: 3 },
  message: { color: FateDropColors.secondary, fontSize: 7, lineHeight: 11, marginTop: 6, paddingHorizontal: 4 },
  pressed: { opacity: .72, transform: [{ scale: .987 }] },
});
