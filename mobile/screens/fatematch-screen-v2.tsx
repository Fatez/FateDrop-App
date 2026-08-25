import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { saveRemoteFateFind, type FateFindCompanionId } from '@/services/fatedrop-id';

const website = (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || 'https://fate-drop.com').replace(/\/$/, '');
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const toPence = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;
const toPercent = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;

type RrpPreset = '0' | '5' | '10' | 'custom';
type CompanionId = FateFindCompanionId;

const COMPANIONS: { id: CompanionId; name: string; signal: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'koru', name: 'Koru', signal: 'Manifested', icon: 'sparkles-outline' },
  { id: 'fenn', name: 'Fenn', signal: 'Echo', icon: 'radio-outline' },
  { id: 'oru', name: 'Oru', signal: 'Whisper', icon: 'ear-outline' },
  { id: 'nyxen', name: 'Nyxen', signal: 'Vanished', icon: 'moon-outline' },
];

function companionName(id: unknown) {
  return COMPANIONS.find((companion) => companion.id === id)?.name ?? 'Koru';
}

function companionFromFateFind(item: Record<string, unknown>) {
  const preferences = item.notificationPreferences;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return 'Koru';
  return companionName((preferences as Record<string, unknown>).companionId);
}

export default function FateMatchScreenV2() {
  const params = useLocalSearchParams<{ query?: string | string[]; maxDelivered?: string | string[]; maxItem?: string | string[]; maxAboveRrp?: string | string[] }>();
  const { snapshot, signedIn, can, refresh, syncing } = useFateDropId();
  const incomingQuery = first(params.query)?.trim() ?? '';
  const setupMode = incomingQuery.length > 0;
  const [query, setQuery] = useState('');
  const [maxItem, setMaxItem] = useState('');
  const [maxDelivered, setMaxDelivered] = useState('');
  const [rrpPreset, setRrpPreset] = useState<RrpPreset>('0');
  const [customPercent, setCustomPercent] = useState('');
  const [companionId, setCompanionId] = useState<CompanionId>('koru');
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
  const selectedCompanion = COMPANIONS.find((companion) => companion.id === companionId) ?? COMPANIONS[0];

  const activeHunts = useMemo(() => (snapshot?.fateFinds ?? []).filter((item) => item.enabled !== false), [snapshot?.fateFinds]);
  const recentMatches = useMemo(() => [...(snapshot?.fateMatches ?? [])].sort((a, b) => b.matchedAt - a.matchedAt).slice(0, 8), [snapshot?.fateMatches]);

  const save = async () => {
    setStatus(null);
    setError(null);
    if (!query.trim()) return setError('Tell FateDrop which product to find.');
    if (!signedIn) return setError('Sign in to FateDrop ID first.');
    if (!premium) return setError('Hosted FateFind monitoring is a Premium capability.');
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
          companionId,
        },
      });
      await refresh();
      setStatus(`FateFind active. ${selectedCompanion.name} will bring you the alert when a qualifying result becomes a FateMatch.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FateFind could not be saved.');
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

        <FateDropHeader title={setupMode ? 'FateFind' : 'FateMatches'} subtitle={setupMode ? 'FIND · WATCH · MATCH' : 'FOUND FOR YOU'} />

        {setupMode ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroOrnament} />
              <Text style={styles.eyebrow}>KEEP FATEFIND SEARCHING</Text>
              <Text style={styles.heroTitle}>Tell FateDrop what counts as the right deal.</Text>
              <Text style={styles.heroCopy}>FateFind checks the network now and keeps hunting if nothing qualifies. When an observed offer satisfies your rules, that successful result becomes a FateMatch.</Text>
            </View>

            <View style={styles.identity}>
              <View style={styles.flex}>
                <Text style={styles.identityLabel}>FATEDROP ID</Text>
                <Text style={styles.identityValue}>{signedIn ? `${snapshot?.user.fateId} · ${snapshot?.entitlement.effectiveTier.toUpperCase()}` : 'Not connected'}</Text>
                <Text style={styles.identitySub}>{signedIn ? (premium ? 'Cloud FateFind monitoring confirmed.' : 'Account connected; hosted FateFind monitoring remains locked.') : 'Sign in so FateFind can keep searching when the app is closed.'}</Text>
              </View>
              <Pressable onPress={() => router.push('/account')}>
                <Text style={styles.identityAction}>{signedIn ? 'MANAGE' : 'SIGN IN'}</Text>
              </Pressable>
            </View>

            {!premium && signedIn ? (
              <View style={styles.premium}>
                <Ionicons name="sparkles-outline" color={FateDropColors.goldBright} size={20} />
                <View style={styles.flex}>
                  <Text style={styles.premiumTitle}>Hosted FateFind is Premium</Text>
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

              <Text style={styles.helper}>RRP percentage uses the item price against the verified value baseline. True Price shows the full known cost to buy, including mandatory delivery/fees. Unknown delivery never becomes £0.</Text>

              <Text style={styles.formEyebrow}>WHO SHOULD BRING YOU THE FATEMATCH?</Text>
              <View style={styles.companionGrid}>
                {COMPANIONS.map((companion) => {
                  const active = companion.id === companionId;
                  return (
                    <Pressable key={companion.id} onPress={() => setCompanionId(companion.id)} style={[styles.companion, active && styles.companionActive]}>
                      <Ionicons name={companion.icon} size={18} color={active ? FateDropColors.goldBright : FateDropColors.secondary} />
                      <Text style={[styles.companionName, active && styles.companionNameActive]}>{companion.name}</Text>
                      <Text style={styles.companionSignal}>{companion.signal}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helper}>This chooses the companion who delivers your personal FateFind result. Their network roles stay unchanged: Oru = Whisper, Fenn = Echo, Koru = Manifested, Nyxen = Vanished.</Text>

              <Pressable disabled={syncing || !premium} onPress={() => void save()} style={[styles.save, (!premium || syncing) && styles.disabled]}>
                <Ionicons name="telescope-outline" size={17} color={FateDropColors.ink} />
                <Text style={styles.saveText}>{syncing ? 'Syncing…' : 'START FATEFIND'}</Text>
              </Pressable>

              {status ? <Text style={styles.success}>{status}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </>
        ) : (
          <View style={styles.hero}>
            <View style={styles.heroOrnament} />
            <Text style={styles.eyebrow}>FATEFIND RESULTS</Text>
            <Text style={styles.heroTitle}>A FateMatch means FateFind found what you asked for.</Text>
            <Text style={styles.heroCopy}>FateMatch is an outcome, not another watchlist. Create the hunt in FateFind; this screen shows what is still searching and the qualifying offers FateDrop has found for you.</Text>
            <Pressable onPress={() => router.push('/fatefind')} style={styles.heroAction}>
              <Ionicons name="telescope-outline" size={16} color={FateDropColors.ink} />
              <Text style={styles.heroActionText}>RUN FATEFIND</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>SEARCHING NOW</Text>
            <Text style={styles.sectionTitle}>Active FateFinds</Text>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { view: 'matches' } })}>
            <Text style={styles.sectionAction}>OPEN ALERTS →</Text>
          </Pressable>
        </View>

        {activeHunts.length ? activeHunts.map((item) => {
          const queryText = String(item.query || item.queryText || 'FateFind');
          const percent = typeof item.maxPercentAboveRrp === 'number' ? item.maxPercentAboveRrp : null;
          const companion = companionFromFateFind(item as Record<string, unknown>);
          return (
            <View key={item.id} style={styles.huntCard}>
              <View style={styles.huntIcon}><Ionicons name="telescope" size={18} color={FateDropColors.goldBright} /></View>
              <View style={styles.flex}>
                <Text style={styles.huntTitle}>{queryText}</Text>
                <Text style={styles.huntMeta}>FateFind active · {companion}{percent != null ? ` · max +${percent}% vs RRP` : ''}</Text>
              </View>
              <View style={styles.liveDot} />
            </View>
          );
        }) : <Text style={styles.empty}>{signedIn ? 'No active FateFinds yet.' : 'Sign in to load your FateFinds.'}</Text>}

        <Text style={styles.sectionEyebrow}>RECENT FATEMATCHES</Text>
        {recentMatches.length ? recentMatches.map((match) => {
          const matchCompanion = companionName(match.companionId);
          return (
            <Pressable key={match.id} onPress={() => match.url ? void Linking.openURL(match.url) : undefined} style={styles.matchCard}>
              <View style={styles.flex}>
                <Text style={styles.matchLive}>{matchCompanion.toUpperCase()} · FATEMATCH — LIVE NOW</Text>
                <Text style={styles.matchTitle}>{match.title}</Text>
                <Text style={styles.matchMeta}>{matchCompanion} found this · {match.retailerName} · {match.stockStatus}</Text>
                <Text style={styles.matchPrice}>
                  {match.itemPricePence != null ? `£${(match.itemPricePence / 100).toFixed(2)}` : 'Price unavailable'}
                  {match.percentAboveRrp != null ? ` · ${match.percentAboveRrp > 0 ? '+' : ''}${match.percentAboveRrp.toFixed(1)}% vs RRP` : ''}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color={FateDropColors.manifested} />
            </Pressable>
          );
        }) : <Text style={styles.empty}>No FateMatches yet. A match appears here only when an active FateFind genuinely qualifies.</Text>}
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
  heroAction: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 7, marginTop: 16, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, backgroundColor: FateDropColors.goldBright },
  heroActionText: { color: FateDropColors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
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
  companionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  companion: { width: '48%', minHeight: 82, justifyContent: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  companionActive: { borderColor: FateDropColors.gold, backgroundColor: `${FateDropColors.gold}12` },
  companionName: { color: FateDropColors.secondary, fontSize: 13, fontWeight: '900', marginTop: 5 },
  companionNameActive: { color: FateDropColors.goldBright },
  companionSignal: { color: FateDropColors.muted, fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
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
  empty: { color: FateDropColors.muted, fontSize: 12, lineHeight: 18 },
  flex: { flex: 1 },
});