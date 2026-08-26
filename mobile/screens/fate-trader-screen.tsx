import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  createTraderBinderItem,
  createTraderCollectionItem,
  deleteTraderCollectionItem,
  fateTraderCardLabel,
  FateTraderApiError,
  fetchTraderBinder,
  fetchTraderSeries,
  fetchTraderSetCards,
  fetchTraderSets,
  fetchTraderStructuredWants,
  putTraderExactWant,
  putTraderStructuredWant,
  searchTraderCards,
  type FateTraderCard,
  type FateTraderSeries,
  type FateTraderSet,
} from '@/services/fate-trader';

type Mode = 'have' | 'want' | 'find';
type CopyState = 'raw' | 'graded';
type WantCopyState = 'any' | 'raw' | 'graded';

const CONDITIONS = [
  ['mint', 'Mint'],
  ['near_mint', 'Near Mint'],
  ['lightly_played', 'Lightly Played'],
  ['moderately_played', 'Moderately Played'],
  ['heavily_played', 'Heavily Played'],
  ['damaged', 'Damaged'],
] as const;

const TRADE_MODES = [
  ['negotiable', 'Negotiable'],
  ['open', 'Open to offers'],
  ['exact_wants_only', 'Exact Wants only'],
  ['one_for_one', 'One for one'],
  ['bundle_ok', 'Bundles considered'],
] as const;

function messageFor(error: unknown, fallback: string) {
  if (error instanceof FateTraderApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function titleCase(value: string | null | undefined) {
  if (!value) return '—';
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function FateTraderScreen() {
  const { signedIn } = useFateDropId();
  const [mode, setMode] = useState<Mode>('have');
  const [series, setSeries] = useState<FateTraderSeries[]>([]);
  const [sets, setSets] = useState<FateTraderSet[]>([]);
  const [cards, setCards] = useState<FateTraderCard[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [setId, setSetId] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FateTraderCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [binderCount, setBinderCount] = useState(0);
  const [wantCount, setWantCount] = useState(0);

  const [copyState, setCopyState] = useState<CopyState>('raw');
  const [conditionCode, setConditionCode] = useState('near_mint');
  const [gradingCompany, setGradingCompany] = useState('PSA');
  const [gradeLabel, setGradeLabel] = useState('10');
  const [tradeMode, setTradeMode] = useState('negotiable');
  const [haveLocal, setHaveLocal] = useState(true);
  const [havePostal, setHavePostal] = useState(true);
  const [haveNotes, setHaveNotes] = useState('');

  const [wantCopyState, setWantCopyState] = useState<WantCopyState>('any');
  const [minimumCondition, setMinimumCondition] = useState('near_mint');
  const [minimumGrade, setMinimumGrade] = useState('');
  const [maximumGrade, setMaximumGrade] = useState('');
  const [gradingCompanies, setGradingCompanies] = useState('');
  const [wantLocal, setWantLocal] = useState(true);
  const [wantPostal, setWantPostal] = useState(true);
  const [wantNotes, setWantNotes] = useState('');

  const selectedSeries = useMemo(() => series.find((item) => item.id === seriesId) || null, [series, seriesId]);
  const selectedSet = useMemo(() => sets.find((item) => item.id === setId) || null, [sets, setId]);

  const loadMine = useCallback(async () => {
    if (!signedIn) {
      setBinderCount(0);
      setWantCount(0);
      return;
    }
    try {
      const [binder, wants] = await Promise.all([fetchTraderBinder(), fetchTraderStructuredWants()]);
      setBinderCount(binder.items?.length || 0);
      setWantCount(wants.count || wants.wants?.length || 0);
    } catch (cause) {
      if (cause instanceof FateTraderApiError && cause.status === 401) {
        setError('Your FateDrop session has expired. Sign in again to use your Trade Binder and Wants.');
        return;
      }
      setError(messageFor(cause, 'Could not read your Fate Trader data.'));
    }
  }, [signedIn]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [seriesResult, cardsResult] = await Promise.all([
        fetchTraderSeries(),
        searchTraderCards({ limit: 60 }),
      ]);
      setSeries(seriesResult.series || []);
      setCards(cardsResult.cards || []);
      setBackendAvailable(true);
      await loadMine();
    } catch (cause) {
      setBackendAvailable(!(cause instanceof FateTraderApiError && cause.status === 404 && cause.code === 'NOT_FOUND'));
      setError(messageFor(cause, 'The verified Fate Trader catalogue is not available yet.'));
    } finally {
      setLoading(false);
    }
  }, [loadMine]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const chooseSeries = async (nextSeriesId: string) => {
    setSeriesId(nextSeriesId);
    setSetId('');
    setSelected(null);
    setSets([]);
    setError('');
    if (!nextSeriesId) return;
    setLoading(true);
    try {
      const result = await fetchTraderSets(nextSeriesId);
      setSets(result.sets || []);
    } catch (cause) {
      setError(messageFor(cause, 'Could not load verified sets.'));
    } finally {
      setLoading(false);
    }
  };

  const chooseSet = async (nextSetId: string) => {
    setSetId(nextSetId);
    setSelected(null);
    setError('');
    if (!nextSetId) return;
    setLoading(true);
    try {
      const result = await fetchTraderSetCards(nextSetId);
      setCards(result.cards || []);
    } catch (cause) {
      setError(messageFor(cause, 'Could not load cards for this set.'));
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      const result = await searchTraderCards({ query, setId, limit: 100 });
      setCards(result.cards || []);
    } catch (cause) {
      setError(messageFor(cause, 'Could not search the verified card catalogue.'));
    } finally {
      setLoading(false);
    }
  };

  const submitHave = async () => {
    if (!selected || saving) return;
    if (!signedIn) {
      setError('Sign in to add cards to your Trade Binder.');
      return;
    }
    if (!haveLocal && !havePostal) {
      setError('Choose at least one trade method: local or postal.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const itemBody: Record<string, unknown> = {
      fateCardId: selected.fateCardId,
      quantity: 1,
      tradeQuantity: 1,
      copyState,
      notes: haveNotes.trim() || undefined,
    };
    if (copyState === 'raw') itemBody.conditionCode = conditionCode;
    else itemBody.grading = {
      gradingCompany: gradingCompany.trim(),
      gradeLabel: gradeLabel.trim(),
      gradeValue: gradeLabel.trim() ? Number(gradeLabel) : null,
    };

    try {
      const created = await createTraderCollectionItem(itemBody);
      try {
        await createTraderBinderItem({
          collectionItemId: created.item.id,
          tradeMode,
          visibility: 'private',
          localTradeAllowed: haveLocal,
          postalTradeAllowed: havePostal,
          notes: haveNotes.trim() || undefined,
        });
      } catch (binderError) {
        try {
          await deleteTraderCollectionItem(created.item.id, created.item.revision);
        } catch {
          // Preserve the primary Binder error. The collection entry remains owned
          // by the user and is not equivalent to a public trade listing.
        }
        throw binderError;
      }
      setNotice(`${fateTraderCardLabel(selected)} is staged in your private Trade Binder. It is not a public listing yet.`);
      await loadMine();
    } catch (cause) {
      setError(messageFor(cause, 'Could not add this card to your Trade Binder.'));
    } finally {
      setSaving(false);
    }
  };

  const submitWant = async () => {
    if (!selected || saving) return;
    if (!signedIn) {
      setError('Sign in to save cards to your Wants.');
      return;
    }
    if (!wantLocal && !wantPostal) {
      setError('Choose at least one trade method: local or postal.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await putTraderExactWant(selected.fateCardId, { quantity: 1, active: true });

      const constraints: Record<string, unknown> = {
        copyState: wantCopyState,
        localTradeAllowed: wantLocal,
        postalTradeAllowed: wantPostal,
        notes: wantNotes.trim() || undefined,
      };
      if (wantCopyState === 'raw') constraints.minimumConditionCode = minimumCondition;
      if (wantCopyState === 'graded') {
        constraints.minimumGrade = minimumGrade.trim() ? Number(minimumGrade) : null;
        constraints.maximumGrade = maximumGrade.trim() ? Number(maximumGrade) : null;
        constraints.acceptedGradingCompanies = gradingCompanies.split(',').map((value) => value.trim()).filter(Boolean);
      }

      try {
        await putTraderStructuredWant(selected.fateCardId, constraints);
      } catch (constraintError) {
        setError(`The exact Want was saved, but its trade conditions need attention: ${messageFor(constraintError, 'could not save conditions')}`);
        await loadMine();
        return;
      }

      setNotice(`${fateTraderCardLabel(selected)} is now in your Wants with the conditions you chose.`);
      await loadMine();
    } catch (cause) {
      setError(messageFor(cause, 'Could not save this wanted card.'));
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
          <View style={styles.headerFlex}><FateDropHeader title="Fate Trader" subtitle="FATE NETWORK · COLLECTOR TRADING" /></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>HAVE → WANT → FIND → TRADE</Text>
          <Text style={styles.heroTitle}>Trade with intent, not noise.</Text>
          <Text style={styles.heroCopy}>Find the exact verified card, set the conditions you actually care about, and let FateDrop prepare the structured trade data underneath.</Text>
          <View style={styles.heroStats}>
            <Stat value={String(binderCount)} label="MY TRADE ITEMS" />
            <Stat value={String(wantCount)} label="MY WANTS" />
            <Stat value="—" label="FINDER NEXT" />
          </View>
        </View>

        {backendAvailable === false ? (
          <Notice tone="warning" title="Cloud Trader is still dark" copy="The App is wired only to verified FateDrop data. No demo cards or matches are being fabricated." />
        ) : null}
        {error ? <Notice tone="error" title="Fate Trader needs attention" copy={error} /> : null}
        {notice ? <Notice tone="success" title="Saved" copy={notice} /> : null}

        <View style={styles.modeGrid}>
          <ModeButton active={mode === 'have'} icon="albums-outline" title="I HAVE" copy="Put a card or slab forward." onPress={() => { setMode('have'); setNotice(''); }} />
          <ModeButton active={mode === 'want'} icon="search-outline" title="I WANT" copy="Set an exact card Want." onPress={() => { setMode('want'); setNotice(''); }} />
          <ModeButton active={mode === 'find'} icon="git-compare-outline" title="FIND" copy="Verified opportunities only." onPress={() => { setMode('find'); setNotice(''); }} />
        </View>

        {mode === 'find' ? (
          <View style={styles.finderCard}>
            <Text style={styles.sectionEyebrow}>FATE TRADE FINDER</Text>
            <Text style={styles.finderTitle}>Finder stays honest until network matching is exposed.</Text>
            <Text style={styles.finderCopy}>The compatibility engine is being built around real collector intentions, but the live matching route is not exposed yet. FateDrop will not invent example matches and present them as real collectors.</Text>
            <FinderStep number="1" text="Add exact cards you genuinely have available to trade." />
            <FinderStep number="2" text="Add exact Wants and the raw / graded conditions you accept." />
            <FinderStep number="3" text="The Trade Network will revalidate both sides before surfacing compatibility." />
            <FinderStep number="4" text="Only strict reciprocal evidence can become FATE TRADE FOUND." />
          </View>
        ) : (
          <>
            {!signedIn ? (
              <View style={styles.signInCard}>
                <Ionicons name="person-circle-outline" size={27} color={FateDropColors.goldBright} />
                <View style={styles.flex}><Text style={styles.signInTitle}>Sign in to use Fate Trader</Text><Text style={styles.signInCopy}>The verified card catalogue can be browsed without an account. Your Binder and Wants are tied to your FateDrop ID.</Text></View>
                <Pressable onPress={() => router.push('/account')} style={styles.signInButton}><Text style={styles.signInButtonText}>SIGN IN</Text></Pressable>
              </View>
            ) : null}

            <View style={styles.panel}>
              <Text style={styles.sectionEyebrow}>STEP 1 · VERIFIED CARD IDENTITY</Text>
              <Text style={styles.sectionTitle}>Find the exact card</Text>
              <Text style={styles.sectionCopy}>Search directly, or narrow Pokémon by era/series and set. Free-text cards cannot become Trade Binder or Want identities.</Text>

              <Text style={styles.fieldLabel}>ERA / SERIES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <ChoiceChip active={!seriesId} label="All verified" onPress={() => void chooseSeries('')} />
                {series.map((item) => <ChoiceChip key={item.id} active={seriesId === item.id} label={item.name} onPress={() => void chooseSeries(item.id)} />)}
              </ScrollView>

              {seriesId ? <>
                <Text style={styles.fieldLabel}>SET / EXPANSION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {sets.length ? sets.map((item) => <ChoiceChip key={item.id} active={setId === item.id} label={item.name} onPress={() => void chooseSet(item.id)} />) : <Text style={styles.hint}>{loading ? 'Loading verified sets…' : 'No verified sets returned.'}</Text>}
                </ScrollView>
              </> : null}

              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => void runSearch()}
                  placeholder="Search e.g. Furret, Charizard, 136…"
                  placeholderTextColor={FateDropColors.muted}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                <Pressable onPress={() => void runSearch()} style={styles.searchButton}><Ionicons name="search" size={18} color={FateDropColors.background} /></Pressable>
              </View>

              <View style={styles.contextLine}>
                <Text style={styles.contextText}>{selectedSeries?.name || 'Pokémon TCG'}{selectedSet ? `  ›  ${selectedSet.name}` : ''}</Text>
                <Text style={styles.contextCount}>{cards.length} shown</Text>
              </View>

              {loading && !cards.length ? <View style={styles.loader}><ActivityIndicator color={FateDropColors.gold} /><Text style={styles.hint}>Loading verified cards…</Text></View> : null}
              <View style={styles.cardResults}>
                {cards.map((card) => (
                  <Pressable key={card.fateCardId} onPress={() => setSelected(card)} style={[styles.cardResult, selected?.fateCardId === card.fateCardId && styles.cardResultSelected]}>
                    <View style={styles.flex}>
                      <Text style={styles.cardName}>{card.name || 'Unknown card'}</Text>
                      <Text style={styles.cardMeta}>{card.setName || 'Unknown set'} · #{card.collectorNumber}</Text>
                    </View>
                    <View style={styles.cardTags}><Text style={styles.cardTag}>{titleCase(card.variantCode)}</Text><Text style={styles.cardTag}>{card.languageCode.toUpperCase()}</Text></View>
                  </Pressable>
                ))}
                {!loading && !cards.length ? <Text style={styles.emptyText}>No verified cards match this view yet.</Text> : null}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionEyebrow}>STEP 2 · TRADE CONDITIONS</Text>
              <Text style={styles.sectionTitle}>{mode === 'have' ? 'Tell FateDrop what you have' : 'Tell FateDrop what you want'}</Text>
              <Text style={styles.sectionCopy}>Only the information needed for this trade. You do not need to upload your whole collection.</Text>

              {!selected ? (
                <View style={styles.selectPrompt}><Ionicons name="arrow-up-outline" size={21} color={FateDropColors.gold} /><Text style={styles.selectPromptTitle}>Select a verified card above</Text><Text style={styles.selectPromptCopy}>Your conditions will attach to that exact printing, variant and language.</Text></View>
              ) : <>
                <View style={styles.selectedCard}>
                  <Text style={styles.selectedEyebrow}>SELECTED</Text>
                  <Text style={styles.selectedTitle}>{fateTraderCardLabel(selected)}</Text>
                  <Text style={styles.selectedMeta}>{selected.seriesName || 'Pokémon'} · {selected.setName || 'Unknown set'} · {selected.languageCode.toUpperCase()}</Text>
                </View>

                {mode === 'have' ? <>
                  <FieldGroup label="CARD TYPE"><View style={styles.wrap}><ChoiceChip active={copyState === 'raw'} label="Raw card" onPress={() => setCopyState('raw')} /><ChoiceChip active={copyState === 'graded'} label="Graded slab" onPress={() => setCopyState('graded')} /></View></FieldGroup>
                  {copyState === 'raw' ? <FieldGroup label="CONDITION"><View style={styles.wrap}>{CONDITIONS.map(([value, label]) => <ChoiceChip key={value} active={conditionCode === value} label={label} onPress={() => setConditionCode(value)} />)}</View></FieldGroup> : <View style={styles.twoCol}><TextField label="GRADING COMPANY" value={gradingCompany} onChangeText={setGradingCompany} placeholder="PSA" /><TextField label="GRADE" value={gradeLabel} onChangeText={setGradeLabel} placeholder="10" keyboardType="decimal-pad" /></View>}
                  <FieldGroup label="WHAT ARE YOU OPEN TO?"><View style={styles.wrap}>{TRADE_MODES.map(([value, label]) => <ChoiceChip key={value} active={tradeMode === value} label={label} onPress={() => setTradeMode(value)} />)}</View></FieldGroup>
                  <TradeMethods local={haveLocal} postal={havePostal} onLocal={setHaveLocal} onPostal={setHavePostal} />
                  <TextField label="OPTIONAL NOTE" value={haveNotes} onChangeText={setHaveNotes} placeholder="Anything another collector should know…" multiline />
                  <Pressable disabled={saving || !signedIn} onPress={() => void submitHave()} style={[styles.primaryButton, (saving || !signedIn) && styles.disabled]}>{saving ? <ActivityIndicator color={FateDropColors.background} /> : <Text style={styles.primaryButtonText}>ADD TO MY TRADE ITEMS</Text>}</Pressable>
                  <Text style={styles.footnote}>This is staged privately in your Trade Binder. It is not a public listing until the authoritative Trade Network phase is enabled.</Text>
                </> : <>
                  <FieldGroup label="WHAT COPY WOULD YOU ACCEPT?"><View style={styles.wrap}><ChoiceChip active={wantCopyState === 'any'} label="Raw or graded" onPress={() => setWantCopyState('any')} /><ChoiceChip active={wantCopyState === 'raw'} label="Raw only" onPress={() => setWantCopyState('raw')} /><ChoiceChip active={wantCopyState === 'graded'} label="Graded only" onPress={() => setWantCopyState('graded')} /></View></FieldGroup>
                  {wantCopyState === 'raw' ? <FieldGroup label="MINIMUM CONDITION"><View style={styles.wrap}>{CONDITIONS.map(([value, label]) => <ChoiceChip key={value} active={minimumCondition === value} label={label} onPress={() => setMinimumCondition(value)} />)}</View></FieldGroup> : null}
                  {wantCopyState === 'graded' ? <><View style={styles.twoCol}><TextField label="MINIMUM GRADE" value={minimumGrade} onChangeText={setMinimumGrade} placeholder="8" keyboardType="decimal-pad" /><TextField label="MAXIMUM GRADE" value={maximumGrade} onChangeText={setMaximumGrade} placeholder="10" keyboardType="decimal-pad" /></View><TextField label="GRADING COMPANIES (OPTIONAL)" value={gradingCompanies} onChangeText={setGradingCompanies} placeholder="PSA, CGC, BGS" /></> : null}
                  <TradeMethods local={wantLocal} postal={wantPostal} onLocal={setWantLocal} onPostal={setWantPostal} />
                  <TextField label="OPTIONAL NOTE" value={wantNotes} onChangeText={setWantNotes} placeholder="Specific preference or trade note…" multiline />
                  <Pressable disabled={saving || !signedIn} onPress={() => void submitWant()} style={[styles.primaryButton, (saving || !signedIn) && styles.disabled]}>{saving ? <ActivityIndicator color={FateDropColors.background} /> : <Text style={styles.primaryButtonText}>ADD TO MY WANTS</Text>}</Pressable>
                </>}
              </>}
            </View>
          </>
        )}

        <View style={styles.safetyCard}>
          <Ionicons name="shield-checkmark-outline" size={21} color={FateDropColors.gold} />
          <View style={styles.flex}><Text style={styles.safetyTitle}>Compatibility is not valuation</Text><Text style={styles.safetyCopy}>Fate Trader will connect stated trade intentions. It does not decide financial fairness, authenticity or card condition for you. Exact identity and trade conditions remain explicit.</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ active, icon, title, copy, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; title: string; copy: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Ionicons name={icon} size={20} color={active ? FateDropColors.goldBright : FateDropColors.secondary} /><Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{title}</Text><Text style={styles.modeCopy}>{copy}</Text></Pressable>;
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}><Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text></Pressable>;
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function TextField({ label, multiline = false, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'decimal-pad' }) {
  return <View style={styles.textField}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={FateDropColors.muted} style={[styles.textInput, multiline && styles.multiline]} /></View>;
}

function TradeMethods({ local, postal, onLocal, onPostal }: { local: boolean; postal: boolean; onLocal: (value: boolean) => void; onPostal: (value: boolean) => void }) {
  return <FieldGroup label="TRADE METHODS"><View style={styles.wrap}><ChoiceChip active={local} label="Local / in person" onPress={() => onLocal(!local)} /><ChoiceChip active={postal} label="Postal" onPress={() => onPostal(!postal)} /></View></FieldGroup>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function FinderStep({ number, text }: { number: string; text: string }) {
  return <View style={styles.finderStep}><View style={styles.finderNumber}><Text style={styles.finderNumberText}>{number}</Text></View><Text style={styles.finderStepText}>{text}</Text></View>;
}

function Notice({ tone, title, copy }: { tone: 'warning' | 'error' | 'success'; title: string; copy: string }) {
  const color = tone === 'error' ? FateDropColors.error : tone === 'success' ? FateDropColors.success : FateDropColors.warning;
  return <View style={[styles.notice, { borderColor: `${color}55`, backgroundColor: `${color}0E` }]}><Ionicons name={tone === 'success' ? 'checkmark-circle-outline' : 'warning-outline'} size={20} color={color} /><View style={styles.flex}><Text style={[styles.noticeTitle, { color }]}>{title}</Text><Text style={styles.noticeCopy}>{copy}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 52 },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerFlex: { flex: 1 },
  backButton: { width: 40, height: 40, marginTop: 4, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  hero: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  eyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 33, fontWeight: '700', marginTop: 6 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  statValue: { color: FateDropColors.ivory, fontSize: 18, fontWeight: '900' },
  statLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', marginTop: 2, letterSpacing: .55 },
  notice: { flexDirection: 'row', gap: 10, padding: 13, marginBottom: 10, borderRadius: 15, borderWidth: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '900' },
  noticeCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  modeGrid: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  modeButton: { flex: 1, minHeight: 94, padding: 11, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  modeButtonActive: { borderColor: `${FateDropColors.gold}88`, backgroundColor: `${FateDropColors.gold}10` },
  modeTitle: { color: FateDropColors.secondary, fontSize: 11, fontWeight: '900', marginTop: 6 },
  modeTitleActive: { color: FateDropColors.goldBright },
  modeCopy: { color: FateDropColors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  signInCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.gold}44`, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  signInTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },
  signInCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  signInButton: { paddingHorizontal: 10, minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright },
  signInButtonText: { color: FateDropColors.background, fontSize: 9, fontWeight: '900' },
  panel: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 21, fontWeight: '700', marginTop: 3 },
  sectionCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 5, marginBottom: 13 },
  fieldGroup: { marginTop: 12 },
  fieldLabel: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: .7, marginBottom: 6 },
  chipRow: { gap: 6, paddingRight: 8, paddingBottom: 3 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choiceChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  choiceChipActive: { borderColor: `${FateDropColors.gold}88`, backgroundColor: `${FateDropColors.gold}13` },
  choiceChipText: { color: FateDropColors.secondary, fontSize: 10, fontWeight: '800' },
  choiceChipTextActive: { color: FateDropColors.goldBright },
  hint: { color: FateDropColors.muted, fontSize: 11, paddingVertical: 9 },
  searchRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  searchInput: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card, color: FateDropColors.ivory, paddingHorizontal: 12, fontSize: 12 },
  searchButton: { width: 46, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright },
  contextLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 10, marginBottom: 7 },
  contextText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, fontWeight: '800' },
  contextCount: { color: FateDropColors.muted, fontSize: 9, fontWeight: '800' },
  loader: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  cardResults: { gap: 6, maxHeight: 390, overflow: 'hidden' },
  cardResult: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  cardResultSelected: { borderColor: `${FateDropColors.gold}99`, backgroundColor: `${FateDropColors.gold}0E` },
  cardName: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900' },
  cardMeta: { color: FateDropColors.secondary, fontSize: 10, marginTop: 2 },
  cardTags: { alignItems: 'flex-end', gap: 3 },
  cardTag: { color: FateDropColors.muted, fontSize: 8, fontWeight: '800' },
  emptyText: { color: FateDropColors.muted, textAlign: 'center', fontSize: 11, paddingVertical: 20 },
  selectPrompt: { alignItems: 'center', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  selectPromptTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900', marginTop: 5 },
  selectPromptCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 3 },
  selectedCard: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.gold}44`, backgroundColor: `${FateDropColors.gold}0B`, marginBottom: 4 },
  selectedEyebrow: { color: FateDropColors.gold, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  selectedTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900', marginTop: 3 },
  selectedMeta: { color: FateDropColors.secondary, fontSize: 10, marginTop: 3 },
  twoCol: { flexDirection: 'row', gap: 8, marginTop: 12 },
  textField: { flex: 1, marginTop: 12 },
  textInput: { minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card, color: FateDropColors.ivory, paddingHorizontal: 11, fontSize: 12 },
  multiline: { minHeight: 78, paddingTop: 10, textAlignVertical: 'top' },
  primaryButton: { minHeight: 47, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright, marginTop: 15 },
  primaryButtonText: { color: FateDropColors.background, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  disabled: { opacity: .45 },
  footnote: { color: FateDropColors.muted, fontSize: 9, lineHeight: 13, marginTop: 7 },
  finderCard: { padding: 19, borderRadius: 21, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 12 },
  finderTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 24, lineHeight: 28, fontWeight: '700', marginTop: 5 },
  finderCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 14 },
  finderStep: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  finderNumber: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: `${FateDropColors.gold}0D` },
  finderNumberText: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900' },
  finderStepText: { flex: 1, color: FateDropColors.ivory, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  safetyCard: { flexDirection: 'row', gap: 10, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  safetyTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },
  safetyCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
});
