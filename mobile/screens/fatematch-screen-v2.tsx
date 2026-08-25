import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { saveRemoteFateFind } from '@/services/fatedrop-id';

const website = (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || 'https://fate-drop.com').replace(/\/$/, '');
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const toPence = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;
const toPercent = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;

type RrpPreset = '0' | '5' | '10' | 'custom';

export default function FateMatchScreenV2() {
  const params = useLocalSearchParams<{ query?: string | string[]; maxDelivered?: string | string[]; maxItem?: string | string[]; maxAboveRrp?: string | string[] }>();
  const { snapshot, signedIn, can, refresh, syncing } = useFateDropId();
  const [query, setQuery] = useState('');
  const [maxItem, setMaxItem] = useState('');
  const [maxDelivered, setMaxDelivered] = useState('');
  const [rrpPreset, setRrpPreset] = useState<RrpPreset>('0');
  const [customPercent, setCustomPercent] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = first(params.query);
    const item = first(params.maxItem);
    const delivered = first(params.maxDelivered);
    const maxAbove = first(params.maxAboveRrp);
    if (q) setQuery(q);
    if (item) setMaxItem(item);
    if (delivered) setMaxDelivered(delivered);
    if (maxAbove) {
      if (['0', '5', '10'].includes(maxAbove)) setRrpPreset(maxAbove as RrpPreset);
      else {
        setRrpPreset('custom');
        setCustomPercent(maxAbove);
      }
    }
  }, [params.maxAboveRrp, params.maxDelivered, params.maxItem, params.query]);

  const premium = can('advanced_fate_match');
  const maxPercentAboveRrp = rrpPreset === 'custom' ? toPercent(customPercent) : Number(rrpPreset);

  const activeHunts = useMemo(() => (snapshot?.fateFinds ?? []).filter((item) => item.enabled !== false), [snapshot?.fateFinds]);
  const recentMatches = useMemo(() => [...(snapshot?.fateMatches ?? [])].sort((a, b) => b.matchedAt - a.matchedAt).slice(0, 6), [snapshot?.fateMatches]);

  const save = async () => {
    setStatus(null);
    setError(null);
    if (!query.trim()) return setError('Tell FateDrop which product to watch.');
    if (!signedIn) return setError('Sign in to FateDrop ID first.');
    if (!premium) return setError('Hosted FateMatch monitoring is a Premium capability.');
    if (maxPercentAboveRrp == null) return setError('Enter a valid maximum percentage above RRP.');

    try {
      await saveRemoteFateFind({
        query: query.trim(),
        maxPercentAboveRrp,
        maxItemPricePence: toPence(maxItem),
        maxTruePricePence: toPence(maxDelivered),
        stockRequirement: 'in_stock',
        scope: 'online',
        notificationPreferences: {
          website: true,
          app: true,
          discord: snapshot?.notificationPreferences.discord === true,
        },
      });
      await refresh();
      setStatus('FateMatch is watching in FateDrop Cloud. You do not need to keep the app open.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FateMatch could not be saved.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={FateDropColors.ivory} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <FateDropHeader title="FateMatch" subtitle="HUNT · WATCH · MATCH" />

        <View style={styles.hero}>
          <View style={styles.heroOrnament} />
          <Text style={styles.eyebrow}>WAIT FOR THE RIGHT MOMENT</Text>
          <Text style={styles.heroTitle}>Set the deal you will actually accept.</Text>
          <Text style={styles.heroCopy}>FateDrop watches live stock and price evidence until an offer satisfies your rules. When it qualifies, the hunt becomes FATEMATCH — LIVE NOW.</Text>
        </View>

        <View style={styles.identity}>
          <View style={styles.flex}>
            <Text style={styles.identityLabel}>FATEDROP ID</Text>
            <Text style={styles.identityValue}>{signedIn ? `${snapshot?.user.fateId} · ${snapshot?.entitlement.effectiveTier.toUpperCase()}` : 'Not connected'}</Text>
            <Text style={styles.identitySub}>{signedIn ? (premium ? 'Cloud monitoring capability confirmed.' : 'Account connected; hosted monitoring remains locked.') : 'Sign in so the hunt can run outside this device.'}</Text>
          </View>
          <Pressable onPress={() => router.push('/account')}>
            <Text style={styles.identityAction}>{signedIn ? 'MANAGE' : 'SIGN IN'}</Text>
          </Pressable>
        </View>

        {!premium && signedIn ? (
          <View style={styles.premium}>
            <Ionicons name="sparkles-outline" color={FateDropColors.goldBright} size={20} />
            <View style={styles.flex}>
              <Text style={styles.premiumTitle}>Hosted FateMatch is Premium</Text>
              <Text style={styles.premiumText}>Membership truth comes from the backend. Upgrade on the website and the capability syncs back to the app.</Text>
            </View>
            <Pressable onPress={() => void Linking.openURL(`${website}/subscriptions`)}>
              <Text style={styles.upgrade}>PLANS ↗</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.formEyebrow}>PRODUCT</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. Destined Rivals ETB"
            placeholderTextColor={FateDropColors.muted}
            style={styles.input}
          />

          <Text style={styles.formEyebrow}>MAX ABOVE RRP</Text>
          <View style={styles.presetRow}>
            {(['0', '5', '10', 'custom'] as RrpPreset[]).map((value) => {
              const active = rrpPreset === value;
              return (
                <Pressable key={value} onPress={() => setRrpPreset(value)} style={[styles.preset, active && styles.presetActive]}>
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>{value === 'custom' ? 'CUSTOM' : `${value}%`}</Text>
                </Pressable>
              );
            })}
          </View>

          {rrpPreset === 'custom' ? (
            <TextInput
              value={customPercent}
              onChangeText={setCustomPercent}
              keyboardType="decimal-pad"
              placeholder="Custom % above RRP"
              placeholderTextColor={FateDropColors.muted}
              style={styles.input}
            />
          ) : null}

          <Text style={styles.ruleExplainer}>
            {maxPercentAboveRrp === 0
              ? '0% means below RRP and at RRP qualify; anything above RRP is blocked.'
              : maxPercentAboveRrp == null
                ? 'Enter the highest premium above RRP you are willing to accept.'
                : `Up to +${maxPercentAboveRrp}% above RRP may qualify. Anything higher is blocked.`}
          </Text>

          <View style={styles.row}>
            <TextInput
              value={maxItem}
              onChangeText={setMaxItem}
              keyboardType="decimal-pad"
              placeholder="Max item £"
              placeholderTextColor={FateDropColors.muted}
              style={styles.input}
            />
            <TextInput
              value={maxDelivered}
              onChangeText={setMaxDelivered}
              keyboardType="decimal-pad"
              placeholder="Max True Price £"
              placeholderTextColor={FateDropColors.muted}
              style={styles.input}
            />
          </View>

          <Text style={styles.helper}>RRP percentage is calculated against item price. True Price stays separate and only includes delivery when FateDrop actually knows it. Unknown postage never becomes £0.</Text>

          <Pressable disabled={syncing || !premium} onPress={() => void save()} style={[styles.save, (!premium || syncing) && styles.disabled]}>
            <Ionicons name="radio-outline" size={17} color={FateDropColors.ink} />
            <Text style={styles.saveText}>{syncing ? 'Syncing…' : 'START FATEMATCH'}</Text>
          </Pressable>

          {status ? <Text style={styles.success}>{status}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>WATCHING NOW</Text>
            <Text style={styles.sectionTitle}>Active hunts</Text>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { view: 'matches' } })}>
            <Text style={styles.sectionAction}>OPEN ALERTS →</Text>
          </Pressable>
        </View>

        {activeHunts.length ? activeHunts.map((item) => {
          const queryText = String(item.query || item.queryText || 'FateMatch');
          const percent = typeof item.maxPercentAboveRrp === 'number' ? item.maxPercentAboveRrp : null;
          return (
            <View key={item.id} style={styles.huntCard}>
              <View style={styles.huntIcon}><Ionicons name="radio" size={18} color={FateDropColors.goldBright} /></View>
              <View style={styles.flex}>
                <Text style={styles.huntTitle}>{queryText}</Text>
                <Text style={styles.huntMeta}>Watching in Cloud{percent != null ? ` · max +${percent}% vs RRP` : ''}</Text>
              </View>
              <View style={styles.liveDot} />
            </View>
          );
        }) : <Text style={styles.empty}>{signedIn ? 'No active FateMatch hunts yet.' : 'Sign in to load your hunts.'}</Text>}

        {recentMatches.length ? (
          <>
            <Text style={styles.sectionEyebrow}>RECENT MATCHES</Text>
            {recentMatches.map((match) => (
              <Pressable key={match.id} onPress={() => match.url ? void Linking.openURL(match.url) : undefined} style={styles.matchCard}>
                <View style={styles.flex}>
                  <Text style={styles.matchLive}>FATEMATCH — LIVE NOW</Text>
                  <Text style={styles.matchTitle}>{match.title}</Text>
                  <Text style={styles.matchMeta}>{match.retailerName} · {match.stockStatus}</Text>
                  <Text style={styles.matchPrice}>
                    {match.itemPricePence != null ? `£${(match.itemPricePence / 100).toFixed(2)}` : 'Price unavailable'}
                    {match.percentAboveRrp != null ? ` · ${match.percentAboveRrp > 0 ? '+' : ''}${match.percentAboveRrp.toFixed(1)}% vs RRP` : ''}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={17} color={FateDropColors.manifested} />
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 110 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 },
  backText: { color: FateDropColors.ivory, fontWeight: '800' },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  heroOrnament: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -65, top: -90, borderWidth: 1, borderColor: `${FateDropColors.gold}28` },
  eyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 28, lineHeight: 31, fontWeight: '700', marginTop: 7, maxWidth: 330 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft, marginBottom: 12 },
  identityLabel: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  identityValue: { color: FateDropColors.ivory, fontWeight: '900', marginTop: 3 },
  identitySub: { color: FateDropColors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  identityAction: { color: FateDropColors.goldBright, fontWeight: '900', fontSize: 10 },
  premium: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: `${FateDropColors.gold}0D`, borderWidth: 1, borderColor: `${FateDropColors.gold}38`, marginBottom: 12 },
  premiumTitle: { color: FateDropColors.ivory, fontWeight: '900' },
  premiumText: { color: FateDropColors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  upgrade: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900' },
  form: { gap: 10, padding: 15, borderRadius: 18, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft },
  formEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  input: { flex: 1, color: FateDropColors.ivory, backgroundColor: FateDropColors.card, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, fontSize: 14 },
  presetRow: { flexDirection: 'row', gap: 7 },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  presetActive: { borderColor: FateDropColors.gold, backgroundColor: `${FateDropColors.gold}12` },
  presetText: { color: FateDropColors.muted, fontSize: 11, fontWeight: '900' },
  presetTextActive: { color: FateDropColors.goldBright },
  ruleExplainer: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 8 },
  helper: { color: FateDropColors.muted, fontSize: 11, lineHeight: 16 },
  save: { flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: FateDropColors.goldBright },
  disabled: { opacity: 0.42 },
  saveText: { color: FateDropColors.ink, fontWeight: '900', letterSpacing: 0.5 },
  success: { color: FateDropColors.success, fontSize: 12, lineHeight: 17 },
  error: { color: FateDropColors.error, fontSize: 12, lineHeight: 17 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22, marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 20 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: FateDropTypography.sectionTitle, fontWeight: '700', marginTop: 3 },
  sectionAction: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900' },
  huntCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, marginBottom: 8 },
  huntIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0D`, borderWidth: 1, borderColor: `${FateDropColors.gold}30` },
  huntTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' },
  huntMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: FateDropColors.success },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.manifested}48`, backgroundColor: FateDropColors.surface, marginTop: 8 },
  matchLive: { color: FateDropColors.manifested, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  matchTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 3 },
  matchMeta: { color: FateDropColors.secondary, fontSize: 11, marginTop: 3 },
  matchPrice: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '800', marginTop: 5 },
  empty: { color: FateDropColors.muted, fontSize: 12 },
  flex: { flex: 1 },
});
