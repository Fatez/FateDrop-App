import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { createTraderOffer, createTraderWant, fetchTraderMatches, fetchTraderOffers, fetchTraderWants, type TraderMatch, type TraderOffer, type TraderWant } from '@/services/fate-trader';

type Mode = 'matches' | 'wants' | 'offers';
type Composer = 'want' | 'offer' | null;

export default function FateTraderScreen() {
  const [mode, setMode] = useState<Mode>('matches');
  const [composer, setComposer] = useState<Composer>(null);
  const [wants, setWants] = useState<TraderWant[]>([]);
  const [offers, setOffers] = useState<TraderOffer[]>([]);
  const [matches, setMatches] = useState<TraderMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [setName, setSetName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [variant, setVariant] = useState('');
  const [language, setLanguage] = useState('English');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [cashAdjustment, setCashAdjustment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextWants, nextOffers, nextMatches] = await Promise.all([
        fetchTraderWants(),
        fetchTraderOffers(),
        fetchTraderMatches(),
      ]);
      setWants(Array.isArray(nextWants) ? nextWants : []);
      setOffers(Array.isArray(nextOffers) ? nextOffers : []);
      setMatches(Array.isArray(nextMatches) ? nextMatches : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fate Trader is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeCount = useMemo(() => wants.length + offers.length, [offers.length, wants.length]);

  const resetComposer = () => {
    setCardName('');
    setSetName('');
    setCardNumber('');
    setVariant('');
    setLanguage('English');
    setCondition('');
    setNotes('');
    setCashAdjustment('');
  };

  const submit = async () => {
    if (!composer || !cardName.trim()) {
      Alert.alert('Card required', 'Enter the card you want to trade for or offer.');
      return;
    }

    const card = {
      tcg: 'Pokémon',
      cardName: cardName.trim(),
      setName: setName.trim() || null,
      cardNumber: cardNumber.trim() || null,
      variant: variant.trim() || null,
      language: language.trim() || null,
      condition: condition.trim() || null,
    };

    setSaving(true);
    try {
      if (composer === 'want') {
        await createTraderWant({ card, notes: notes.trim() || undefined });
      } else {
        const parsedCash = cashAdjustment.trim() ? Number(cashAdjustment.replace(/[^0-9.-]/g, '')) : null;
        await createTraderOffer({
          card,
          notes: notes.trim() || undefined,
          cashAdjustment: parsedCash != null && Number.isFinite(parsedCash) ? parsedCash : null,
        });
      }
      setComposer(null);
      resetComposer();
      await load();
    } catch (cause) {
      Alert.alert('Could not save', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.gold} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable accessibilityLabel="Back to Fate Network" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.headerFlex}><FateDropHeader title="Fate Trader" subtitle="COLLECTOR-TO-COLLECTOR MATCHING" /></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>FATE NETWORK</Text>
          <Text style={styles.heroTitle}>Trade with intent, not noise.</Text>
          <Text style={styles.heroCopy}>Tell FateDrop what you want and what you can offer. The network looks for compatible collector intentions and keeps exact evidence separate from potential matches.</Text>
          <View style={styles.heroStats}>
            <Stat value={String(matches.length)} label="MATCHES" />
            <Stat value={String(wants.length)} label="WANTS" />
            <Stat value={String(offers.length)} label="OFFERS" />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryAction} onPress={() => setComposer('want')}>
            <Ionicons name="search-outline" size={18} color={FateDropColors.background} />
            <Text style={styles.primaryActionText}>I'M LOOKING FOR</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => setComposer('offer')}>
            <Ionicons name="swap-horizontal-outline" size={18} color={FateDropColors.goldBright} />
            <Text style={styles.secondaryActionText}>I CAN OFFER</Text>
          </Pressable>
        </View>

        {composer ? (
          <View style={styles.composerCard}>
            <View style={styles.composerHead}>
              <View>
                <Text style={styles.sectionEyebrow}>{composer === 'want' ? 'CREATE A WANT' : 'CREATE AN OFFER'}</Text>
                <Text style={styles.sectionTitle}>{composer === 'want' ? 'What are you searching for?' : 'What can you trade?'}</Text>
              </View>
              <Pressable onPress={() => { setComposer(null); resetComposer(); }} style={styles.iconButton}><Ionicons name="close" size={18} color={FateDropColors.ivory} /></Pressable>
            </View>
            <Field label="Card name" value={cardName} onChangeText={setCardName} placeholder="e.g. Charizard ex" />
            <View style={styles.twoCol}>
              <View style={styles.flex}><Field label="Set" value={setName} onChangeText={setSetName} placeholder="Set name" /></View>
              <View style={styles.flex}><Field label="Card no." value={cardNumber} onChangeText={setCardNumber} placeholder="199/165" /></View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.flex}><Field label="Variant" value={variant} onChangeText={setVariant} placeholder="Holo / reverse / etc." /></View>
              <View style={styles.flex}><Field label="Language" value={language} onChangeText={setLanguage} placeholder="English" /></View>
            </View>
            <Field label="Condition / grade" value={condition} onChangeText={setCondition} placeholder="Raw NM / PSA 10 / etc." />
            {composer === 'offer' ? <Field label="Cash adjustment (£)" value={cashAdjustment} onChangeText={setCashAdjustment} placeholder="Optional" keyboardType="decimal-pad" /> : null}
            <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional trade notes" multiline />
            <Text style={styles.identityNote}>Exact card identity wins. Missing set/number/variant details may only qualify as a potential match until both collectors confirm equivalence.</Text>
            <Pressable disabled={saving} onPress={() => void submit()} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color={FateDropColors.background} /> : <Text style={styles.saveButtonText}>{composer === 'want' ? 'SAVE WANT' : 'SAVE OFFER'}</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.segmented}>
          <Segment active={mode === 'matches'} label={`Matches ${matches.length}`} onPress={() => setMode('matches')} />
          <Segment active={mode === 'wants'} label={`My Wants ${wants.length}`} onPress={() => setMode('wants')} />
          <Segment active={mode === 'offers'} label={`My Offers ${offers.length}`} onPress={() => setMode('offers')} />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={20} color={FateDropColors.warning} />
            <View style={styles.flex}><Text style={styles.errorTitle}>Trader data unavailable</Text><Text style={styles.errorCopy}>{error}</Text></View>
          </View>
        ) : null}

        {loading && !error && !activeCount && !matches.length ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.gold} /><Text style={styles.loadingText}>Reading Fate Trader…</Text></View> : null}

        {mode === 'matches' ? (
          <View style={styles.list}>
            {matches.map((match, index) => <MatchCard key={match.id ?? `match-${index}`} match={match} />)}
            {!loading && !matches.length ? <Empty icon="git-compare-outline" title="No compatible trade found yet" copy="Create a want and an offer. Fate Trader will only surface evidence it can actually support." /> : null}
          </View>
        ) : null}

        {mode === 'wants' ? (
          <View style={styles.list}>
            {wants.map((want) => <IntentCard key={want.id} kind="want" title={cardLabel(want.card)} detail={cardDetail(want.card)} status={want.status} notes={want.notes} />)}
            {!loading && !wants.length ? <Empty icon="search-outline" title="No wants yet" copy="Tell the network which card you're trying to find." /> : null}
          </View>
        ) : null}

        {mode === 'offers' ? (
          <View style={styles.list}>
            {offers.map((offer) => <IntentCard key={offer.id} kind="offer" title={cardLabel(offer.card)} detail={cardDetail(offer.card)} status={offer.status} notes={offer.notes} cashAdjustment={offer.cashAdjustment} />)}
            {!loading && !offers.length ? <Empty icon="swap-horizontal-outline" title="No offers yet" copy="Add cards you're genuinely willing to trade." /> : null}
          </View>
        ) : null}

        <View style={styles.safetyCard}>
          <Ionicons name="shield-checkmark-outline" size={21} color={FateDropColors.gold} />
          <View style={styles.flex}>
            <Text style={styles.safetyTitle}>Trade safely</Text>
            <Text style={styles.safetyCopy}>Fate Trader finds compatibility; it does not guarantee condition, authenticity, value or counterparty behaviour. Confirm card identity and agree exchange terms before completing any trade.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={FateDropColors.muted} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentActive]}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text></Pressable>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function MatchCard({ match }: { match: TraderMatch }) {
  const exact = String(match.compatibility ?? '').toLowerCase() === 'exact';
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.matchIcon, { borderColor: exact ? `${FateDropColors.success}66` : `${FateDropColors.gold}55` }]}><Ionicons name={exact ? 'checkmark-circle-outline' : 'sparkles-outline'} size={19} color={exact ? FateDropColors.success : FateDropColors.gold} /></View>
        <View style={styles.flex}><Text style={styles.cardTitle}>{match.want?.card ? cardLabel(match.want.card) : 'Compatible trade'}</Text><Text style={styles.cardDetail}>{exact ? 'Exact reciprocal compatibility' : 'Potential compatibility — verify details'}</Text></View>
        <Text style={[styles.matchBadge, { color: exact ? FateDropColors.success : FateDropColors.gold }]}>{exact ? 'EXACT' : 'POTENTIAL'}</Text>
      </View>
      {match.offer?.card ? <Text style={styles.exchangeText}>Available offer: {cardLabel(match.offer.card)}</Text> : null}
      {match.counterpart?.displayName ? <Text style={styles.counterpart}>Collector: {match.counterpart.displayName}</Text> : null}
      {match.evidence?.length ? <View style={styles.evidence}>{match.evidence.slice(0, 3).map((item, i) => <Text key={`${item}-${i}`} style={styles.evidenceText}>• {item}</Text>)}</View> : null}
    </View>
  );
}

function IntentCard({ kind, title, detail, status, notes, cashAdjustment }: { kind: 'want' | 'offer'; title: string; detail: string; status?: string | null; notes?: string | null; cashAdjustment?: number | null }) {
  return <View style={styles.card}><View style={styles.cardHead}><View style={styles.matchIcon}><Ionicons name={kind === 'want' ? 'search-outline' : 'swap-horizontal-outline'} size={19} color={FateDropColors.gold} /></View><View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text></View><Text style={styles.intentStatus}>{String(status || 'ACTIVE').toUpperCase()}</Text></View>{cashAdjustment ? <Text style={styles.exchangeText}>Cash adjustment: £{cashAdjustment.toFixed(2)}</Text> : null}{notes ? <Text style={styles.notes}>{notes}</Text> : null}</View>;
}

function Empty({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) {
  return <View style={styles.empty}><Ionicons name={icon} size={24} color={FateDropColors.secondary} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{copy}</Text></View>;
}

function cardLabel(card: { cardName: string; cardNumber?: string | null }) {
  return `${card.cardName}${card.cardNumber ? ` · ${card.cardNumber}` : ''}`;
}

function cardDetail(card: { setName?: string | null; variant?: string | null; language?: string | null; condition?: string | null }) {
  return [card.setName, card.variant, card.language, card.condition].filter(Boolean).join(' · ') || 'Identity details not supplied';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 44 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerFlex: { flex: 1 },
  backButton: { width: 40, height: 40, marginTop: 4, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  hero: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  eyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 33, fontWeight: '700', marginTop: 6 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  statValue: { color: FateDropColors.ivory, fontSize: 18, fontWeight: '900' }, statLabel: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', marginTop: 2, letterSpacing: .7 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  primaryAction: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: FateDropColors.goldBright },
  primaryActionText: { color: FateDropColors.background, fontSize: 11, fontWeight: '900', letterSpacing: .5 },
  secondaryAction: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: FateDropColors.surface },
  secondaryActionText: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: .5 },
  composerCard: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, gap: 10, marginBottom: 14 },
  composerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 20, fontWeight: '700', marginTop: 2 },
  iconButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  field: { gap: 5 }, fieldLabel: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: .5 },
  input: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card, color: FateDropColors.ivory, paddingHorizontal: 12, fontSize: 13 }, multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 },
  identityNote: { color: FateDropColors.muted, fontSize: 11, lineHeight: 16 },
  saveButton: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright }, saveButtonText: { color: FateDropColors.background, fontSize: 11, fontWeight: '900', letterSpacing: .8 }, disabled: { opacity: .55 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card, marginBottom: 12 },
  segment: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: FateDropColors.surface, borderWidth: 1, borderColor: `${FateDropColors.gold}55` }, segmentText: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900' }, segmentTextActive: { color: FateDropColors.goldBright },
  list: { gap: 8 },
  card: { padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, matchIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}44`, backgroundColor: FateDropColors.card },
  cardTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' }, cardDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 }, matchBadge: { fontSize: 9, fontWeight: '900', letterSpacing: .7 }, intentStatus: { color: FateDropColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .6 },
  exchangeText: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '800', marginTop: 10 }, counterpart: { color: FateDropColors.secondary, fontSize: 11, marginTop: 5 }, notes: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 9 }, evidence: { gap: 3, marginTop: 8 }, evidenceText: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 15 },
  errorCard: { flexDirection: 'row', gap: 10, padding: 14, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.warning}55`, backgroundColor: `${FateDropColors.warning}0E` }, errorTitle: { color: FateDropColors.warning, fontSize: 14, fontWeight: '900' }, errorCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  loading: { alignItems: 'center', paddingVertical: 28, gap: 8 }, loadingText: { color: FateDropColors.secondary, fontSize: 12 },
  empty: { alignItems: 'center', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface }, emptyTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900', marginTop: 8 }, emptyCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  safetyCard: { flexDirection: 'row', gap: 10, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginTop: 16 }, safetyTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' }, safetyCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
