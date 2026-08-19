import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { saveRemoteFateFind } from '@/services/fatedrop-id';

const website = (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || 'https://fate-drop.com').replace(/\/$/, '');
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const toPence = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;

export default function FateFindScreenV2() {
  const params = useLocalSearchParams<{ query?: string | string[]; maxDelivered?: string | string[]; maxItem?: string | string[] }>();
  const { snapshot, signedIn, can, refresh, syncing } = useFateDropId();
  const [query, setQuery] = useState('');
  const [maxItem, setMaxItem] = useState('');
  const [maxDelivered, setMaxDelivered] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = first(params.query); const item = first(params.maxItem); const delivered = first(params.maxDelivered);
    if (q) setQuery(q); if (item) setMaxItem(item); if (delivered) setMaxDelivered(delivered);
  }, [params.maxDelivered, params.maxItem, params.query]);

  const premium = can('advanced_fate_match');

  const save = async () => {
    setStatus(null); setError(null);
    if (!query.trim()) return setError('Tell FateDrop what product to hunt.');
    if (!signedIn) return setError('Sign in to FateDrop ID first.');
    if (!premium) return setError('Hosted FateFind monitoring is a Premium capability.');
    try {
      await saveRemoteFateFind({
        query: query.trim(),
        maxItemPricePence: toPence(maxItem),
        maxTruePricePence: toPence(maxDelivered),
        stockRequirement: 'in_stock',
        scope: 'online',
        notificationPreferences: { website: true, app: true, discord: snapshot?.notificationPreferences.discord === true },
      });
      await refresh();
      setStatus('FateFind saved. FateDrop Cloud can evaluate this hunt even when the app is closed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FateFind could not be saved.');
    }
  };

  return <SafeAreaView style={styles.safe}>
    <FateDropBackground />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
      <AbstractHero eyebrow="FateFind" title="Tell FateDrop what to find." subtitle="Create a hosted hunt using product and True Price rules. When an observed offer satisfies it, the result becomes a FateMatch." icon="telescope" />

      <View style={styles.identity}>
        <View style={{ flex: 1 }}><Text style={styles.identityLabel}>FATEDROP ID</Text><Text style={styles.identityValue}>{signedIn ? `${snapshot?.user.fateId} · ${snapshot?.entitlement.effectiveTier.toUpperCase()}` : 'Not connected'}</Text><Text style={styles.identitySub}>{signedIn ? (premium ? 'Hosted FateFind capability confirmed by backend.' : 'Free account connected; hosted monitoring remains locked.') : 'Sign in so your hunts can run outside this device.'}</Text></View>
        <Pressable onPress={() => router.push('/account')}><Text style={styles.identityAction}>{signedIn ? 'Manage' : 'Sign in'}</Text></Pressable>
      </View>

      {!premium && signedIn ? <View style={styles.premium}><Ionicons name="sparkles" color={FateDropColors.violetLight} size={20} /><View style={{ flex: 1 }}><Text style={styles.premiumTitle}>Hosted FateFind is Premium</Text><Text style={styles.premiumText}>The app does not unlock this itself. Upgrade on the website; confirmed membership then syncs back here.</Text></View><Pressable onPress={() => void Linking.openURL(`${website}/subscriptions`)}><Text style={styles.upgrade}>View plans ↗</Text></Pressable></View> : null}

      <View style={styles.form}>
        <Text style={styles.label}>PRODUCT HUNT</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="e.g. Destined Rivals ETB" placeholderTextColor={FateDropColors.muted} style={styles.input} />
        <View style={styles.row}>
          <TextInput value={maxItem} onChangeText={setMaxItem} keyboardType="decimal-pad" placeholder="Max item £" placeholderTextColor={FateDropColors.muted} style={styles.input} />
          <TextInput value={maxDelivered} onChangeText={setMaxDelivered} keyboardType="decimal-pad" placeholder="Max delivered £" placeholderTextColor={FateDropColors.muted} style={styles.input} />
        </View>
        <Text style={styles.helper}>Delivery must be known before FateDrop can treat a True Price ceiling as satisfied. Unknown postage never counts as free.</Text>
        <Pressable disabled={syncing || !premium} onPress={() => void save()} style={[styles.save, (!premium || syncing) && styles.disabled]}><Text style={styles.saveText}>{syncing ? 'Syncing…' : 'Save hosted FateFind'}</Text></Pressable>
        {status ? <Text style={styles.success}>{status}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.heading}>Your hosted hunts</Text>
      {snapshot?.fateFinds?.length ? snapshot.fateFinds.map((item) => <View key={item.id} style={styles.card}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{String(item.query || item.queryText || 'FateFind')}</Text><Text style={styles.cardSub}>{item.enabled === false ? 'Paused' : 'Watching in Cloud'}</Text></View><Ionicons name="cloud-done" size={19} color={FateDropColors.mint} /></View>) : <Text style={styles.empty}>{signedIn ? 'No hosted FateFind hunts yet.' : 'Sign in to load your hunts.'}</Text>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 20, paddingBottom: 90 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }, backText: { color: FateDropColors.text, fontWeight: '800' },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 },
  identityLabel: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, identityValue: { color: FateDropColors.text, fontWeight: '900', marginTop: 3 }, identitySub: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, identityAction: { color: FateDropColors.violetLight, fontWeight: '900', fontSize: 11 },
  premium: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: `${FateDropColors.violet}12`, borderWidth: 1, borderColor: `${FateDropColors.violet}38`, marginBottom: 12 }, premiumTitle: { color: FateDropColors.text, fontWeight: '900' }, premiumText: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, upgrade: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '900' },
  form: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border }, label: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, input: { flex: 1, color: FateDropColors.text, backgroundColor: FateDropColors.cardElevated, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border }, row: { flexDirection: 'row', gap: 8 }, helper: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14 }, save: { alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: FateDropColors.violet }, disabled: { opacity: .45 }, saveText: { color: FateDropColors.text, fontWeight: '900' }, success: { color: FateDropColors.mint, fontSize: 10, lineHeight: 15 }, error: { color: FateDropColors.coral, fontSize: 10, lineHeight: 15 },
  heading: { color: FateDropColors.text, fontSize: 18, fontWeight: '900', marginTop: 20, marginBottom: 10 }, card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 8 }, cardTitle: { color: FateDropColors.text, fontWeight: '900' }, cardSub: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 }, empty: { color: FateDropColors.muted, fontSize: 11 },
});
