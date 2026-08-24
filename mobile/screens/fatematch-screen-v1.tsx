import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { saveRemoteFateMatch } from '@/services/fatedrop-id';

const website = (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || 'https://fate-drop.com').replace(/\/$/, '');
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const toPence = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;
const companions = ['koru', 'fenn', 'aeris', 'nyxen', 'solix'] as const;
type CompanionId = typeof companions[number];

export default function FateMatchScreenV1() {
  const params = useLocalSearchParams<{ query?: string | string[]; productId?: string | string[]; maxDelivered?: string | string[]; maxItem?: string | string[] }>();
  const { snapshot, signedIn, can, refresh, syncing } = useFateDropId();
  const [query, setQuery] = useState('');
  const [maxItem, setMaxItem] = useState('');
  const [maxDelivered, setMaxDelivered] = useState('');
  const [maxPercent, setMaxPercent] = useState('');
  const [companion, setCompanion] = useState<CompanionId>('koru');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = first(params.query); const item = first(params.maxItem); const delivered = first(params.maxDelivered);
    if (q) setQuery(q); if (item) setMaxItem(item); if (delivered) setMaxDelivered(delivered);
  }, [params.maxDelivered, params.maxItem, params.query]);

  const premium = can('advanced_fate_match');
  const productIdentityId = first(params.productId)?.trim() || null;

  const save = async () => {
    setStatus(null); setError(null);
    if (!query.trim() && !productIdentityId) return setError('Choose the product you want FateDrop to watch.');
    if (!signedIn) return setError('Sign in to FateDrop ID first.');
    if (!premium) return setError('Hosted FateMatch monitoring is a Premium capability.');
    try {
      await saveRemoteFateMatch({
        query: query.trim(),
        productIdentityId,
        maxItemPricePence: toPence(maxItem),
        maxTruePricePence: toPence(maxDelivered),
        maxPercentAboveRrp: maxPercent.trim() && Number.isFinite(Number(maxPercent)) ? Number(maxPercent) : null,
        stockRequirement: 'in_stock',
        scope: 'online',
        notificationPreferences: { website: true, app: true, discord: snapshot?.notificationPreferences.discord === true, companionId: companion },
      });
      await refresh();
      setStatus(`${companion.charAt(0).toUpperCase() + companion.slice(1)} is watching it. FateDrop will raise FATEMATCH — LIVE NOW when a qualifying offer goes live.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FateMatch could not be saved.');
    }
  };

  return <SafeAreaView style={styles.safe}>
    <FateDropBackground />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
      <AbstractHero eyebrow="FateMatch" title="Let your companion watch it." subtitle="The simple option is: let me know when this is in stock. Add price or RRP rules only if you want them. When the shared Cloud conditions are met, FateDrop alerts you and sends you straight to buy." icon="notifications" />

      <View style={styles.identity}>
        <View style={{ flex: 1 }}><Text style={styles.identityLabel}>FATEDROP ID</Text><Text style={styles.identityValue}>{signedIn ? `${snapshot?.user.fateId} · ${snapshot?.entitlement.effectiveTier.toUpperCase()}` : 'Not connected'}</Text><Text style={styles.identitySub}>{signedIn ? (premium ? 'Cloud monitoring can continue while the app is closed.' : 'Free account connected; hosted monitoring remains locked.') : 'Sign in so your companion can keep watching outside this device.'}</Text></View>
        <Pressable onPress={() => router.push('/account')}><Text style={styles.identityAction}>{signedIn ? 'Manage' : 'Sign in'}</Text></Pressable>
      </View>

      {!premium && signedIn ? <View style={styles.premium}><Ionicons name="sparkles" color={FateDropColors.violetLight} size={20} /><View style={{ flex: 1 }}><Text style={styles.premiumTitle}>FateMatch monitoring is Premium</Text><Text style={styles.premiumText}>Membership is confirmed by the backend and shared across FateDrop.</Text></View><Pressable onPress={() => void Linking.openURL(`${website}/subscriptions`)}><Text style={styles.upgrade}>View plans ↗</Text></Pressable></View> : null}

      <View style={styles.form}>
        <Text style={styles.label}>WHAT SHOULD WE WATCH?</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="e.g. Destined Rivals booster packs" placeholderTextColor={FateDropColors.muted} style={styles.input} />

        <Text style={styles.label}>WHO IS HUNTING IT?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.companions}>
          {companions.map((id) => <Pressable key={id} onPress={() => setCompanion(id)} style={[styles.companion, companion === id && styles.companionActive]}><Text style={[styles.companionText, companion === id && styles.companionTextActive]}>{id.toUpperCase()}</Text></Pressable>)}
        </ScrollView>

        <Text style={styles.helper}><Text style={styles.helperStrong}>Default:</Text> no price rules means “let me know when this is in stock.”</Text>
        <View style={styles.row}>
          <TextInput value={maxItem} onChangeText={setMaxItem} keyboardType="decimal-pad" placeholder="Max item £ (optional)" placeholderTextColor={FateDropColors.muted} style={styles.input} />
          <TextInput value={maxDelivered} onChangeText={setMaxDelivered} keyboardType="decimal-pad" placeholder="Max True Price £" placeholderTextColor={FateDropColors.muted} style={styles.input} />
        </View>
        <TextInput value={maxPercent} onChangeText={setMaxPercent} keyboardType="decimal-pad" placeholder="Max % above RRP (optional, e.g. 5)" placeholderTextColor={FateDropColors.muted} style={styles.input} />
        <Text style={styles.helper}>RRP rules use the same canonical RRP/reference as FateFind. Unknown delivery never becomes £0.</Text>

        <Pressable disabled={syncing || !premium} onPress={() => void save()} style={[styles.save, (!premium || syncing) && styles.disabled]}><Text style={styles.saveText}>{syncing ? 'Syncing…' : 'START FATEMATCH WATCH →'}</Text></Pressable>
        {status ? <Text style={styles.success}>{status}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.heading}>Your FateMatch watches</Text>
      {snapshot?.fateFinds?.length ? snapshot.fateFinds.map((item) => <View key={item.id} style={styles.card}><View style={styles.cardIcon}><Ionicons name="eye-outline" size={17} color={FateDropColors.violetLight} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{String(item.query || item.queryText || 'Monitored product')}</Text><Text style={styles.cardSub}>{item.enabled === false ? 'Paused' : 'Your companion is watching in Cloud'}</Text></View><View style={styles.cloud}><View style={styles.cloudDot} /><Text style={styles.cloudText}>{item.enabled === false ? 'PAUSED' : 'WATCHING'}</Text></View></View>) : <Text style={styles.empty}>{signedIn ? 'No FateMatch watches yet.' : 'Sign in to load your watches.'}</Text>}

      {snapshot?.fateMatches?.length ? <><Text style={styles.heading}>Recent FateMatches</Text>{snapshot.fateMatches.slice(0, 5).map((match) => <View key={match.id} style={[styles.card, styles.liveCard]}><View style={{ flex: 1 }}><Text style={styles.liveLabel}>FATEMATCH — LIVE NOW</Text><Text style={styles.cardTitle}>{match.title}</Text><Text style={styles.cardSub}>{match.retailerName} · {match.percentAboveRrp == null ? 'RRP comparison unavailable' : `${Math.abs(match.percentAboveRrp).toFixed(1)}% ${match.percentAboveRrp <= 0 ? 'below/at' : 'above'} RRP`}</Text></View><Ionicons name="flash" size={18} color={FateDropColors.mint} /></View>)}</> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 20, paddingBottom: 90 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }, backText: { color: FateDropColors.text, fontWeight: '800' },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 12 },
  identityLabel: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, identityValue: { color: FateDropColors.text, fontWeight: '900', marginTop: 3 }, identitySub: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, identityAction: { color: FateDropColors.violetLight, fontWeight: '900', fontSize: 11 },
  premium: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: `${FateDropColors.violet}12`, borderWidth: 1, borderColor: `${FateDropColors.violet}38`, marginBottom: 12 }, premiumTitle: { color: FateDropColors.text, fontWeight: '900' }, premiumText: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, upgrade: { color: FateDropColors.violetLight, fontSize: 10, fontWeight: '900' },
  form: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border }, label: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 }, input: { flex: 1, color: FateDropColors.text, backgroundColor: FateDropColors.cardElevated, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border }, row: { flexDirection: 'row', gap: 8 }, helper: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14 }, helperStrong: { color: FateDropColors.text, fontWeight: '900' },
  companions: { gap: 7, paddingRight: 6 }, companion: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated }, companionActive: { borderColor: `${FateDropColors.violetLight}70`, backgroundColor: `${FateDropColors.violet}18` }, companionText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '900' }, companionTextActive: { color: FateDropColors.violetLight },
  save: { alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: FateDropColors.violet }, disabled: { opacity: .45 }, saveText: { color: FateDropColors.text, fontWeight: '900', fontSize: 9 }, success: { color: FateDropColors.mint, fontSize: 10, lineHeight: 15 }, error: { color: FateDropColors.coral, fontSize: 10, lineHeight: 15 },
  heading: { color: FateDropColors.text, fontSize: 18, fontWeight: '900', marginTop: 20, marginBottom: 10 }, card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 8 }, cardIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}10` }, cardTitle: { color: FateDropColors.text, fontWeight: '900' }, cardSub: { color: FateDropColors.muted, fontSize: 9, marginTop: 3 }, cloud: { alignItems: 'center', gap: 4 }, cloudDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint }, cloudText: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900' }, empty: { color: FateDropColors.muted, fontSize: 11 },
  liveCard: { borderColor: `${FateDropColors.mint}36` }, liveLabel: { color: FateDropColors.mint, fontSize: 7, fontWeight: '900', letterSpacing: .8, marginBottom: 3 },
});
