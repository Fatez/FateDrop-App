import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateJourneyRail, FateMetricStrip, FateSectionHeading } from '@/components/fate-polish-ui';
import { FateDropBackground, FateDropHeader, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { TCG_REGISTRY, isTcgCode, type TcgCode } from '@/constants/tcg-registry';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { useTcgCapabilities } from '@/contexts/tcg-capabilities-context';
import { saveRemoteFateFind, type FateFindCompanionId } from '@/services/fatedrop-id';

const website = (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || 'https://fate-drop.com').replace(/\/$/, '');
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const toPence = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;
const toPercent = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;

type RrpPreset = '0' | '5' | '10' | 'custom';
type CompanionId = FateFindCompanionId;
const COMPANIONS: { id: CompanionId; name: string; signal: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'koru', name: 'Koru', signal: 'Manifested', icon: 'sparkles-outline', color: FateDropColors.manifested },
  { id: 'fenn', name: 'Fenn', signal: 'Echo', icon: 'radio-outline', color: FateDropColors.echo },
  { id: 'oru', name: 'Oru', signal: 'Whisper', icon: 'ear-outline', color: FateDropColors.whisper },
  { id: 'nyxen', name: 'Nyxen', signal: 'Vanished', icon: 'moon-outline', color: FateDropColors.vanished },
];
function companionName(id: unknown) { return COMPANIONS.find((companion) => companion.id === id)?.name ?? 'Koru'; }
function companionFromFateFind(item: Record<string, unknown>) { const preferences = item.notificationPreferences; if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return 'Koru'; return companionName((preferences as Record<string, unknown>).companionId); }
function moneyPence(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? `£${(value / 100).toFixed(2)}` : null; }

export default function FateMatchScreenV3() {
  const params = useLocalSearchParams<{ query?: string | string[]; tcg?: string | string[]; maxDelivered?: string | string[]; maxItem?: string | string[]; maxAboveRrp?: string | string[] }>();
  const { snapshot, signedIn, can, refresh, syncing } = useFateDropId();
  const { capabilityFor } = useTcgCapabilities();
  const incomingQuery = first(params.query)?.trim() ?? '';
  const setupMode = incomingQuery.length > 0;
  const [query, setQuery] = useState('');
  const [tcgCode, setTcgCode] = useState<TcgCode>('pokemon');
  const [maxItem, setMaxItem] = useState('');
  const [maxDelivered, setMaxDelivered] = useState('');
  const [rrpPreset, setRrpPreset] = useState<RrpPreset>('0');
  const [customPercent, setCustomPercent] = useState('');
  const [companionId, setCompanionId] = useState<CompanionId>('koru');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = first(params.query), item = first(params.maxItem), delivered = first(params.maxDelivered), maxAbove = first(params.maxAboveRrp);
    if (q) setQuery(q); if (item) setMaxItem(item); if (delivered) setMaxDelivered(delivered);
    if (maxAbove) { if (['0', '5', '10'].includes(maxAbove)) setRrpPreset(maxAbove as RrpPreset); else { setRrpPreset('custom'); setCustomPercent(maxAbove); } }
  }, [params.maxAboveRrp, params.maxDelivered, params.maxItem, params.query]);

  const selectedTcgCodes = useMemo<TcgCode[]>(() => snapshot?.tcgPreferences.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences.selectedTcgCodes]);
  useEffect(() => { const requested = first(params.tcg); const selectedRequest = isTcgCode(requested) && selectedTcgCodes.includes(requested) ? requested : null; setTcgCode((current) => selectedRequest ?? (selectedTcgCodes.includes(current) ? current : selectedTcgCodes[0])); }, [params.tcg, selectedTcgCodes]);

  const premium = can('advanced_fate_match');
  const tcgDefinition = TCG_REGISTRY.find((entry) => entry.code === tcgCode) ?? TCG_REGISTRY[0];
  const tcgCapability = capabilityFor(tcgCode);
  const maxPercentAboveRrp = rrpPreset === 'custom' ? toPercent(customPercent) : Number(rrpPreset);
  const selectedCompanion = COMPANIONS.find((companion) => companion.id === companionId) ?? COMPANIONS[0];
  const activeHunts = useMemo(() => (snapshot?.fateFinds ?? []).filter((item) => item.enabled !== false), [snapshot?.fateFinds]);
  const recentMatches = useMemo(() => [...(snapshot?.fateMatches ?? [])].sort((a, b) => b.matchedAt - a.matchedAt).slice(0, 12), [snapshot?.fateMatches]);

  const save = async () => {
    setStatus(null); setError(null);
    if (!query.trim()) return setError('Tell FateDrop which product to find.');
    if (!signedIn) return setError('Sign in to FateDrop ID first.');
    if (!premium) return setError('Hosted FateFind monitoring is a Premium capability.');
    if (!tcgCapability.lifecycleAlertsEnabled) return setError(`${tcgDefinition.shortName} is interest-only until its canonical catalogue, retailer monitoring and lifecycle delivery are verified.`);
    if (maxPercentAboveRrp == null) return setError('Enter a valid maximum percentage above RRP.');
    try {
      await saveRemoteFateFind({ tcgCode, query: query.trim(), maxPercentAboveRrp, maxItemPricePence: toPence(maxItem), maxTruePricePence: toPence(maxDelivered), stockRequirement: 'in_stock', scope: 'online', notificationPreferences: { website: true, app: true, discord: snapshot?.notificationPreferences.discord === true, companionId } });
      await refresh(); setStatus(`FateFind active. ${selectedCompanion.name} will bring you the alert when a qualifying result becomes a FateMatch.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'FateFind could not be saved.'); }
  };

  return <SafeAreaView style={styles.safe}><FateDropBackground /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.ivory} /><Text style={styles.backText}>Back</Text></Pressable>
    <FateDropHeader title={setupMode ? 'FateFind rules' : 'FateMatches'} subtitle={setupMode ? 'SET THE HUNT' : 'FOUND FOR YOU'} />

    <View style={styles.hero}><View style={styles.heroGlow} /><Text style={styles.eyebrow}>{setupMode ? 'FATEFIND · ACTIVE HUNT SETUP' : 'FATEMATCH · QUALIFIED OUTCOMES'}</Text><Text style={styles.heroTitle}>{setupMode ? 'Turn a saved idea into a precise hunt.' : 'See exactly what FateFind has qualified for you.'}</Text><Text style={styles.heroCopy}>{setupMode ? 'Set the boundaries FateDrop must obey: TCG, product, RRP tolerance, price ceiling and delivered-cost ceiling. A result only becomes a FateMatch when those rules genuinely qualify.' : 'FateMatch is not a second watchlist. It is the evidence-backed outcome of FateFind finding something that satisfies your rules.'}</Text>{!setupMode ? <Pressable onPress={() => router.push('/fatefind')} style={styles.heroAction}><Ionicons name="telescope-outline" size={15} color={FateDropColors.background} /><Text style={styles.heroActionText}>RUN FATEFIND</Text></Pressable> : null}</View>

    <FateJourneyRail steps={[
      { label: 'SAVED', detail: 'Wishlist', icon: 'bookmark-outline', state: 'done' },
      { label: 'RULES', detail: setupMode ? 'Editing now' : 'FateFind', icon: 'options-outline', state: setupMode ? 'active' : activeHunts.length ? 'done' : 'idle' },
      { label: 'SEARCHING', detail: `${activeHunts.length} active`, icon: 'telescope-outline', state: activeHunts.length ? 'done' : 'idle' },
      { label: 'MATCHED', detail: `${recentMatches.length} recent`, icon: 'sparkles-outline', state: recentMatches.length ? 'done' : activeHunts.length ? 'active' : 'idle' },
    ]} />
    <FateMetricStrip items={[
      { icon: 'telescope-outline', value: String(activeHunts.length), label: 'ACTIVE FINDS', color: FateDropColors.goldBright },
      { icon: 'sparkles-outline', value: String(recentMatches.length), label: 'RECENT MATCHES', color: FateDropColors.manifested },
      { icon: signedIn ? 'cloud-done-outline' : 'cloud-offline-outline', value: signedIn ? 'SYNCED' : 'SIGN IN', label: 'FATEDROP ID', color: signedIn ? FateDropColors.cyan : FateDropColors.echo },
    ]} />

    {setupMode ? <>
      <FateSectionHeading eyebrow="HUNT RULES" title="What counts as the right deal?" copy="Every limit is explicit. Unknown delivery stays unknown; it never becomes £0." />
      <View style={styles.identity}><View style={styles.flex}><Text style={styles.identityLabel}>FATEDROP ID</Text><Text style={styles.identityValue}>{signedIn ? `${snapshot?.user.fateId} · ${snapshot?.entitlement.effectiveTier.toUpperCase()}` : 'Not connected'}</Text><Text style={styles.identitySub}>{signedIn ? (premium ? 'Cloud FateFind monitoring confirmed.' : 'Account connected; hosted monitoring remains locked.') : 'Sign in so FateFind can keep searching when the app is closed.'}</Text></View><Pressable onPress={() => router.push('/account')}><Text style={styles.identityAction}>{signedIn ? 'MANAGE' : 'SIGN IN'}</Text></Pressable></View>
      {!premium && signedIn ? <View style={styles.premium}><Ionicons name="sparkles-outline" color={FateDropColors.goldBright} size={20} /><View style={styles.flex}><Text style={styles.premiumTitle}>Hosted FateFind is Premium</Text><Text style={styles.premiumText}>Membership truth comes from the backend. Upgrade on the website and the capability syncs back to the app.</Text></View><Pressable onPress={() => void Linking.openURL(`${website}/subscriptions`)}><Text style={styles.upgrade}>PLANS ↗</Text></Pressable></View> : null}
      <View style={styles.form}>
        <FieldLabel text="TRADING CARD GAME" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>{TCG_REGISTRY.filter((entry) => selectedTcgCodes.includes(entry.code)).map((entry) => <FilterChip key={entry.code} label={`${entry.shortName}${capabilityFor(entry.code).lifecycleAlertsEnabled ? '' : ' · soon'}`} active={tcgCode === entry.code} onPress={() => setTcgCode(entry.code)} />)}</ScrollView>
        <FieldLabel text="PRODUCT" /><TextInput value={query} onChangeText={setQuery} placeholder="e.g. Destined Rivals ETB" placeholderTextColor={FateDropColors.muted} style={styles.input} />
        <FieldLabel text="MAX ABOVE RRP" /><View style={styles.presetRow}>{(['0','5','10','custom'] as RrpPreset[]).map((value) => <Pressable key={value} onPress={() => setRrpPreset(value)} style={[styles.preset, rrpPreset === value && styles.presetActive]}><Text style={[styles.presetText, rrpPreset === value && styles.presetTextActive]}>{value === 'custom' ? 'CUSTOM' : `${value}%`}</Text></Pressable>)}</View>
        {rrpPreset === 'custom' ? <TextInput value={customPercent} onChangeText={setCustomPercent} keyboardType="decimal-pad" placeholder="Custom % above RRP" placeholderTextColor={FateDropColors.muted} style={styles.input} /> : null}
        <Text style={styles.ruleExplainer}>{maxPercentAboveRrp === 0 ? '0% means below RRP and at RRP qualify; anything above RRP is blocked.' : maxPercentAboveRrp == null ? 'Enter the highest premium above RRP you will accept.' : `Up to +${maxPercentAboveRrp}% above RRP may qualify. Anything higher is blocked.`}</Text>
        <View style={styles.row}><TextInput value={maxItem} onChangeText={setMaxItem} keyboardType="decimal-pad" placeholder="Max item £" placeholderTextColor={FateDropColors.muted} style={styles.input} /><TextInput value={maxDelivered} onChangeText={setMaxDelivered} keyboardType="decimal-pad" placeholder="Max True Price £" placeholderTextColor={FateDropColors.muted} style={styles.input} /></View>
        <View style={styles.ruleSummary}><RulePill label="STOCK" value="IN STOCK" /><RulePill label="SCOPE" value="ONLINE" /><RulePill label="ITEM CAP" value={maxItem.trim() ? `£${maxItem}` : 'NONE'} /><RulePill label="TRUE PRICE CAP" value={maxDelivered.trim() ? `£${maxDelivered}` : 'NONE'} /></View>
        <Text style={styles.helper}>RRP percentage uses the item price against the verified baseline. True Price is the full known checkout cost. Unknown delivery never qualifies as free delivery.</Text>
        <FieldLabel text="WHO SHOULD BRING THE FATEMATCH?" /><View style={styles.companionGrid}>{COMPANIONS.map((companion) => { const active = companion.id === companionId; return <Pressable key={companion.id} onPress={() => setCompanionId(companion.id)} style={[styles.companion, active && { borderColor: companion.color, backgroundColor: `${companion.color}10` }]}><Ionicons name={companion.icon} size={18} color={active ? companion.color : FateDropColors.secondary} /><Text style={[styles.companionName, active && { color: companion.color }]}>{companion.name}</Text><Text style={styles.companionSignal}>{companion.signal}</Text></Pressable>; })}</View>
        <Pressable disabled={syncing || !premium || !tcgCapability.lifecycleAlertsEnabled} onPress={() => void save()} style={[styles.save, (!premium || syncing || !tcgCapability.lifecycleAlertsEnabled) && styles.disabled]}><Ionicons name="telescope-outline" size={17} color={FateDropColors.background} /><Text style={styles.saveText}>{syncing ? 'SYNCING…' : tcgCapability.lifecycleAlertsEnabled ? 'START FATEFIND' : 'TCG COMING SOON'}</Text></Pressable>
        {status ? <Text style={styles.success}>{status}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </> : null}

    <FateSectionHeading eyebrow="FATEMATCH · QUALIFIED NOW" title="Successful results" copy="These are outcomes. If a result is here, FateFind qualified it against the rules attached to the hunt." />
    {recentMatches.length ? recentMatches.map((match) => <Pressable key={match.id} onPress={() => match.url ? void Linking.openURL(match.url) : undefined} style={styles.matchCard}>
      <View style={styles.matchIcon}><Ionicons name="sparkles" size={18} color={FateDropColors.manifested} /></View><View style={styles.flex}><View style={styles.matchTop}><Text style={styles.matchLive}>{companionName(match.companionId)} FOUND THIS</Text><StatusBadge label="FATEMATCH" color={FateDropColors.manifested} /></View><Text style={styles.matchTitle}>{match.title}</Text><Text style={styles.matchMeta}>{TCG_REGISTRY.find((entry) => entry.code === match.tcgCode)?.shortName ?? 'Unknown TCG'} · {match.retailerName} · {match.stockStatus}</Text><Text style={styles.matchPrice}>{match.itemPricePence != null ? `£${(match.itemPricePence / 100).toFixed(2)}` : 'Price unavailable'}{match.percentAboveRrp != null ? ` · ${match.percentAboveRrp > 0 ? '+' : ''}${match.percentAboveRrp.toFixed(1)}% vs RRP` : ''}</Text></View><Ionicons name="arrow-forward" size={17} color={FateDropColors.manifested} /></Pressable>) : <EmptyBlock icon="sparkles-outline" title="No FateMatches yet" copy="A match appears here only when an active FateFind genuinely qualifies." />}

    <FateSectionHeading eyebrow="FATEFIND · SEARCHING NOW" title="Active hunts" copy="These are still working. They are not matches and they are not Wishlist bookmarks." action="RUN NEW" onAction={() => router.push('/fatefind')} />
    {activeHunts.length ? activeHunts.map((item) => {
      const queryText = String(item.query || item.queryText || 'FateFind'); const itemTcg = isTcgCode(item.tcgCode) ? item.tcgCode : null; const percent = typeof item.maxPercentAboveRrp === 'number' ? item.maxPercentAboveRrp : null; const companion = companionFromFateFind(item as Record<string, unknown>);
      const itemCap = moneyPence(item.maxItemPricePence), deliveredCap = moneyPence(item.maxTruePricePence);
      return <View key={item.id} style={styles.huntCard}><View style={styles.huntIcon}><Ionicons name="telescope" size={18} color={FateDropColors.goldBright} /></View><View style={styles.flex}><View style={styles.huntTop}><Text style={styles.huntState}>SEARCHING</Text><View style={styles.liveDot} /></View><Text style={styles.huntTitle}>{queryText}</Text><Text style={styles.huntMeta}>{itemTcg ? TCG_REGISTRY.find((entry) => entry.code === itemTcg)?.shortName ?? itemTcg : 'Unknown TCG'} · {companion}</Text><View style={styles.huntRules}>{percent != null ? <RulePill label="RRP" value={`≤ +${percent}%`} /> : null}{itemCap ? <RulePill label="ITEM" value={`≤ ${itemCap}`} /> : null}{deliveredCap ? <RulePill label="TRUE PRICE" value={`≤ ${deliveredCap}`} /> : null}</View></View></View>;
    }) : <EmptyBlock icon="telescope-outline" title="Nothing searching right now" copy={signedIn ? 'Start a FateFind from Search or FateFind when you want persistent monitoring.' : 'Sign in to load and manage your FateFinds.'} />}
  </ScrollView></SafeAreaView>;
}

function FieldLabel({ text }: { text: string }) { return <Text style={styles.formEyebrow}>{text}</Text>; }
function RulePill({ label, value }: { label: string; value: string }) { return <View style={styles.rulePill}><Text style={styles.rulePillLabel}>{label}</Text><Text style={styles.rulePillValue}>{value}</Text></View>; }
function EmptyBlock({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) { return <View style={styles.empty}><Ionicons name={icon} size={21} color={FateDropColors.goldBright} /><View style={styles.flex}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{copy}</Text></View></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 110 }, flex: { flex: 1 }, back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }, backText: { color: FateDropColors.ivory, fontWeight: '800' },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,197,141,.24)', backgroundColor: 'rgba(7,12,20,.88)', marginBottom: 11 }, heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -80, top: -110, backgroundColor: `${FateDropColors.violetLight}0D` }, eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 }, heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 28, lineHeight: 32, marginTop: 7, maxWidth: 340 }, heroCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 8 }, heroAction: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginTop: 15, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: FateDropColors.goldBright }, heroActionText: { color: FateDropColors.background, fontSize: 8.5, fontWeight: '900', letterSpacing: .5 },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 13, borderRadius: 16, backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: FateDropColors.borderSoft, marginBottom: 10 }, identityLabel: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, identityValue: { color: FateDropColors.ivory, fontWeight: '900', marginTop: 3 }, identitySub: { color: FateDropColors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 }, identityAction: { color: FateDropColors.goldBright, fontWeight: '900', fontSize: 9 },
  premium: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 13, borderRadius: 16, backgroundColor: `${FateDropColors.gold}0D`, borderWidth: 1, borderColor: `${FateDropColors.gold}38`, marginBottom: 10 }, premiumTitle: { color: FateDropColors.ivory, fontWeight: '900' }, premiumText: { color: FateDropColors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 }, upgrade: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900' },
  form: { gap: 10, padding: 15, borderRadius: 19, backgroundColor: 'rgba(10,15,23,.92)', borderWidth: 1, borderColor: FateDropColors.borderSoft }, formEyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.05, marginTop: 3 }, input: { flex: 1, color: FateDropColors.ivory, backgroundColor: FateDropColors.card, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, fontSize: 13 }, presetRow: { flexDirection: 'row', gap: 7 }, preset: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card }, presetActive: { borderColor: FateDropColors.goldBright, backgroundColor: `${FateDropColors.goldBright}10` }, presetText: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900' }, presetTextActive: { color: FateDropColors.goldBright }, ruleExplainer: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 15 }, row: { flexDirection: 'row', gap: 8 }, helper: { color: FateDropColors.muted, fontSize: 9.5, lineHeight: 14 }, ruleSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, rulePill: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: `${FateDropColors.goldBright}28`, backgroundColor: `${FateDropColors.goldBright}08` }, rulePillLabel: { color: FateDropColors.muted, fontSize: 6.3, fontWeight: '900', letterSpacing: .5 }, rulePillValue: { color: FateDropColors.ivory, fontSize: 8.5, fontWeight: '900', marginTop: 2 },
  companionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, companion: { width: '48%', minHeight: 78, justifyContent: 'center', padding: 11, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card }, companionName: { color: FateDropColors.secondary, fontSize: 12, fontWeight: '900', marginTop: 5 }, companionSignal: { color: FateDropColors.muted, fontSize: 8, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' }, save: { flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: FateDropColors.goldBright }, disabled: { opacity: .42 }, saveText: { color: FateDropColors.background, fontWeight: '900', letterSpacing: .5 }, success: { color: FateDropColors.success, fontSize: 10.5, lineHeight: 15 }, error: { color: FateDropColors.error, fontSize: 10.5, lineHeight: 15 },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.manifested}42`, backgroundColor: `${FateDropColors.manifested}08`, marginBottom: 8 }, matchIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.manifested}38`, backgroundColor: `${FateDropColors.manifested}0D` }, matchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, matchLive: { color: FateDropColors.manifested, fontSize: 7.5, fontWeight: '900', letterSpacing: .75 }, matchTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 4 }, matchMeta: { color: FateDropColors.secondary, fontSize: 9.5, marginTop: 3 }, matchPrice: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '800', marginTop: 5 },
  huntCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.goldBright}30`, backgroundColor: 'rgba(10,15,23,.9)', marginBottom: 8 }, huntIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.goldBright}0D`, borderWidth: 1, borderColor: `${FateDropColors.goldBright}30` }, huntTop: { flexDirection: 'row', alignItems: 'center', gap: 5 }, huntState: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .7 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.manifested }, huntTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 4 }, huntMeta: { color: FateDropColors.secondary, fontSize: 9.5, marginTop: 3 }, huntRules: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(8,13,21,.72)' }, emptyTitle: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900' }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
});
