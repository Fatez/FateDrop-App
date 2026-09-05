import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { TCG_REGISTRY } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import { buildFatePriceDiscovery, fatePriceVariantLabel } from '@/lib/fate-price-discovery';
import { FateMarketApiError, searchFatePriceCards, type FatePriceCard } from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function tcgMeta(code: string) {
  const found = TCG_REGISTRY.find((item) => item.code === code);
  return found || null;
}

function tcgName(code: string) {
  return tcgMeta(code)?.shortName || code.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cardTitle(card: { name: string; collectorNumber: string }) {
  return `${card.name}${card.collectorNumber ? ` #${card.collectorNumber}` : ''}`;
}

export default function FatePriceDiscoveryScreen() {
  const params = useLocalSearchParams<{
    collectorNumber?: string | string[];
    name?: string | string[];
    query?: string | string[];
    setId?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const routeSetId = first(params.setId)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const routeTcg = first(params.tcg)?.trim().toLowerCase() || '';
  const routeName = first(params.name)?.trim() || '';
  const routeQuery = first(params.query)?.trim() || '';
  const routeCollectorNumber = first(params.collectorNumber)?.trim() || '';

  const [query, setQuery] = useState(routeQuery || routeName || routeCollectorNumber);
  const [results, setResults] = useState<FatePriceCard[]>([]);
  const [selectedTcg, setSelectedTcg] = useState(routeTcg);
  const [selectedSetId, setSelectedSetId] = useState(routeSetId);
  const [selectedPrintingId, setSelectedPrintingId] = useState('');
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');

  const model = useMemo(() => buildFatePriceDiscovery(results, {
    tcgCode: selectedTcg,
    setId: selectedSetId,
    printingId: selectedPrintingId,
  }), [results, selectedPrintingId, selectedSetId, selectedTcg]);

  const selectedSet = useMemo(() => model.sets.find((set) => set.id === selectedSetId) || null, [model.sets, selectedSetId]);
  const selectedCard = useMemo(() => model.cards.find((card) => card.printingId === selectedPrintingId) || null, [model.cards, selectedPrintingId]);

  const searchCards = useCallback(async (nextQuery: string, nextSetId = '') => {
    const cleanQuery = nextQuery.trim();
    if (cleanQuery.length < 2 && !nextSetId) {
      setNotice('Enter at least two letters or numbers to start the identity path.');
      setResults([]);
      return;
    }
    setSearching(true);
    setNotice('');
    try {
      const response = await searchFatePriceCards({ query: cleanQuery, setId: nextSetId, limit: 100 });
      const cards = response.cards;
      setResults(cards);
      setSelectedPrintingId('');

      if (nextSetId) {
        const anchor = cards.find((card) => card.setId === nextSetId);
        setSelectedTcg(anchor?.tcgCode || routeTcg || '');
        setSelectedSetId(nextSetId);
      } else {
        setSelectedTcg(routeTcg && cards.some((card) => card.tcgCode === routeTcg) ? routeTcg : '');
        setSelectedSetId('');
      }

      if (!cards.length) {
        setNotice('No verified canonical card identities matched that search.');
      } else if (cards.length >= 100) {
        setNotice('100 verified identities loaded. Narrow by game, set, or a more specific name/number to keep the path exact.');
      } else {
        setNotice(`${cards.length} verified identit${cards.length === 1 ? 'y' : 'ies'} loaded. Follow the path to the exact variant.`);
      }
    } catch (error) {
      setResults([]);
      setNotice(error instanceof FateMarketApiError ? error.message : 'Canonical FatePrice discovery is temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  }, [routeTcg]);

  useEffect(() => {
    if (routeSetId) {
      void searchCards(query, routeSetId);
    } else if (query.trim().length >= 2) {
      void searchCards(query);
    }
    // Route values are the initial discovery seed only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!results.length || selectedTcg || model.games.length !== 1) return;
    setSelectedTcg(model.games[0].code);
  }, [model.games, results.length, selectedTcg]);

  useEffect(() => {
    if (!selectedTcg || selectedSetId || model.sets.length !== 1) return;
    setSelectedSetId(model.sets[0].id);
  }, [model.sets, selectedSetId, selectedTcg]);

  useEffect(() => {
    if (!selectedSetId || selectedPrintingId || model.cards.length !== 1) return;
    setSelectedPrintingId(model.cards[0].printingId);
  }, [model.cards, selectedPrintingId, selectedSetId]);

  const chooseGame = useCallback((code: string) => {
    setSelectedTcg(code);
    setSelectedSetId('');
    setSelectedPrintingId('');
  }, []);

  const chooseSet = useCallback((id: string) => {
    setSelectedSetId(id);
    setSelectedPrintingId('');
  }, []);

  const resetDiscovery = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedTcg('');
    setSelectedSetId('');
    setSelectedPrintingId('');
    setNotice('');
  }, []);

  const openExactCard = useCallback((card: FatePriceCard) => {
    router.push({
      pathname: '/fate-price',
      params: {
        cardId: card.id,
        collectorNumber: card.collectorNumber,
        name: card.name || '',
        setId: card.setId,
        setName: card.setName || '',
        tcg: card.tcgCode || '',
      },
    });
  }, []);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FateDropBackground />
      <Image
        source={require('../assets/images/fate-market-orbital-theme.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top center"
        cachePolicy="disk"
        enforceEarlyResizing
        recyclingKey="fate-price:discovery"
      />
      <View style={styles.themeVeil} />
      <View style={styles.themeLowerVeil} />
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityLabel="Back to Fate Market" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={20} color={FateDropColors.ivory} />
        <Text style={styles.backText}>Fate Market</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>FATEPRICE · EXACT DISCOVERY</Text>
          <Text style={styles.title}>Find the card. Then remove every ambiguity.</Text>
          <Text style={styles.copy}>Search once, then narrow through Game → Set → Card → Variant. FatePrice only opens when the identity is exact.</Text>
        </View>
        <View style={styles.marketMark}>
          <View style={styles.marketMarkOuter} />
          <View style={styles.marketMarkInner} />
          <Image source={require('../assets/images/home-orbital-crystal.png')} style={styles.marketMarkCrystal} contentFit="contain" cachePolicy="memory-disk" />
        </View>
      </View>

      <View accessibilityRole="tablist" style={styles.areaRail}>
        <Pressable accessibilityRole="tab" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} style={styles.areaTab}><Ionicons name="pulse-outline" size={16} color={FateDropColors.muted} /><Text style={styles.areaTitle}>FatePulse</Text></Pressable>
        <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.areaTab, styles.areaTabActive]}><Ionicons name="pricetag-outline" size={16} color={FateDropColors.goldBright} /><Text style={[styles.areaTitle, styles.areaTitleActive]}>FatePrice</Text><View style={styles.areaActiveGem} /></View>
        <Pressable accessibilityRole="tab" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'collectors' } })} style={styles.areaTab}><Ionicons name="albums-outline" size={16} color={FateDropColors.muted} /><Text style={styles.areaTitle}>Collectors</Text></Pressable>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchHeading}>
          <View style={styles.flex}>
            <Text style={styles.sectionEyebrow}>START WITH WHAT YOU KNOW</Text>
            <Text style={styles.searchTitle}>{selectedSetId ? `Search inside ${selectedSet?.name || routeSetName || 'this set'}` : 'Card name or collector number'}</Text>
          </View>
          {results.length ? <Pressable accessibilityLabel="Start FatePrice discovery again" onPress={resetDiscovery} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}><Ionicons name="refresh" size={14} color={FateDropColors.goldBright} /><Text style={styles.resetText}>RESET</Text></Pressable> : null}
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={FateDropColors.goldBright} />
          <TextInput
            accessibilityLabel="Search verified FatePrice cards"
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => void searchCards(query, selectedSetId)}
            placeholder={selectedSetId ? 'e.g. 194 or Charizard' : 'e.g. Charizard or 194'}
            placeholderTextColor={FateDropColors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          <Pressable accessibilityLabel="Search verified cards" disabled={searching} onPress={() => void searchCards(query, selectedSetId)} style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}>
            {searching ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name="arrow-forward" size={17} color={FateDropColors.goldBright} />}
          </Pressable>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>

      <DiscoveryRail
        game={selectedTcg ? tcgName(selectedTcg) : ''}
        set={selectedSet?.name || (selectedSetId === routeSetId ? routeSetName : '')}
        card={selectedCard ? cardTitle(selectedCard) : ''}
        variantReady={model.variants.length > 0}
      />

      {!results.length && !searching ? <View style={styles.emptyState}>
        <Ionicons name="git-branch-outline" size={25} color={FateDropColors.goldBright} />
        <Text style={styles.emptyTitle}>No catalogue maze.</Text>
        <Text style={styles.emptyCopy}>Type the card name or number you know. FateDrop will turn the matches into a short identity path instead of dumping a wall of near-identical cards on you.</Text>
      </View> : null}

      {results.length ? <StepSection number="01" eyebrow="GAME" title={selectedTcg ? tcgName(selectedTcg) : 'Which game?'} detail={selectedTcg ? 'Change game to reset the steps below.' : 'Only games present in these verified matches are shown.'}>
        <View style={styles.optionStack}>
          {model.games.map((game) => {
            const meta = tcgMeta(game.code);
            const active = selectedTcg === game.code;
            return <Pressable key={game.code} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseGame(game.code)} style={({ pressed }) => [styles.optionRow, active && styles.optionRowActive, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, active && styles.optionIconActive]}><Ionicons name={(meta?.icon || 'layers-outline') as keyof typeof Ionicons.glyphMap} size={17} color={active ? FateDropColors.goldBright : FateDropColors.secondary} /></View>
              <View style={styles.flex}><Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{tcgName(game.code)}</Text><Text style={styles.optionMeta}>{game.identityCount} matching exact identit{game.identityCount === 1 ? 'y' : 'ies'}</Text></View>
              <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={17} color={active ? FateDropColors.goldBright : FateDropColors.muted} />
            </Pressable>;
          })}
        </View>
      </StepSection> : null}

      {selectedTcg ? <StepSection number="02" eyebrow="SET" title={selectedSet ? selectedSet.name : 'Which set?'} detail={selectedSet ? selectedSet.seriesName || 'Verified canonical set' : 'Matching sets only — no giant all-time catalogue dump.'}>
        <View style={styles.optionStack}>
          {model.sets.map((set) => {
            const active = selectedSetId === set.id;
            return <Pressable key={set.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseSet(set.id)} style={({ pressed }) => [styles.optionRow, active && styles.optionRowActive, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, active && styles.optionIconActive]}><Ionicons name="albums-outline" size={17} color={active ? FateDropColors.goldBright : FateDropColors.secondary} /></View>
              <View style={styles.flex}><Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{set.name}</Text><Text style={styles.optionMeta}>{set.seriesName || 'Verified series'} · {set.cardCount} matching card{set.cardCount === 1 ? '' : 's'} · {set.identityCount} identit{set.identityCount === 1 ? 'y' : 'ies'}</Text></View>
              <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={17} color={active ? FateDropColors.goldBright : FateDropColors.muted} />
            </Pressable>;
          })}
        </View>
      </StepSection> : null}

      {selectedSetId ? <StepSection number="03" eyebrow="CARD" title={selectedCard ? cardTitle(selectedCard) : 'Which card?'} detail={selectedCard ? `${selectedCard.identityCount} exact variant identit${selectedCard.identityCount === 1 ? 'y' : 'ies'} available.` : 'Cards are grouped by canonical printing before variants are shown.'}>
        <View style={styles.optionStack}>
          {model.cards.map((card) => {
            const active = selectedPrintingId === card.printingId;
            return <Pressable key={card.printingId} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSelectedPrintingId(card.printingId)} style={({ pressed }) => [styles.optionRow, active && styles.optionRowActive, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, active && styles.optionIconActive]}><Ionicons name="id-card-outline" size={17} color={active ? FateDropColors.goldBright : FateDropColors.secondary} /></View>
              <View style={styles.flex}><Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{cardTitle(card)}</Text><Text style={styles.optionMeta}>{card.rarity || card.supertype || 'Verified printing'} · {card.identityCount} variant identit{card.identityCount === 1 ? 'y' : 'ies'}</Text></View>
              <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={17} color={active ? FateDropColors.goldBright : FateDropColors.muted} />
            </Pressable>;
          })}
        </View>
      </StepSection> : null}

      {selectedPrintingId ? <StepSection number="04" eyebrow="VARIANT" title="Choose the exact identity" detail="Finish and language remain separate. This is the identity FatePrice will value.">
        <View style={styles.variantStack}>
          {model.variants.map((card) => <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`Read FatePrice for ${cardTitle({ name: card.name || 'Unknown card', collectorNumber: card.collectorNumber })}, ${fatePriceVariantLabel(card)}`} onPress={() => openExactCard(card)} style={({ pressed }) => [styles.variantRow, pressed && styles.pressed]}>
            <View style={styles.variantGem}><Ionicons name="diamond-outline" size={18} color={FateDropColors.goldBright} /></View>
            <View style={styles.flex}><Text style={styles.variantTitle}>{fatePriceVariantLabel(card)}</Text><Text style={styles.variantMeta}>{cardTitle({ name: card.name || 'Unknown card', collectorNumber: card.collectorNumber })} · {card.setName || 'Verified set'}</Text></View>
            <View style={styles.readPrice}><Text style={styles.readPriceText}>READ</Text><Ionicons name="arrow-forward" size={14} color={FateDropColors.goldBright} /></View>
          </Pressable>)}
        </View>
      </StepSection> : null}

      <View style={styles.truthPanel}>
        <Ionicons name="shield-checkmark-outline" size={18} color={FateDropColors.goldBright} />
        <View style={styles.flex}><Text style={styles.truthTitle}>Exactness is the feature.</Text><Text style={styles.truthCopy}>FateDrop does not average lookalike printings together just to produce a convenient price. Search broadly; value narrowly.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function DiscoveryRail({ game, set, card, variantReady }: { game: string; set: string; card: string; variantReady: boolean }) {
  const steps = [
    { label: 'GAME', value: game },
    { label: 'SET', value: set },
    { label: 'CARD', value: card },
    { label: 'VARIANT', value: variantReady ? 'READY' : '' },
  ];
  return <View style={styles.discoveryRail}>{steps.map((step, index) => <View key={step.label} style={styles.discoveryStep}>
    <View style={[styles.stepDot, step.value && styles.stepDotActive]}>{step.value ? <Ionicons name="checkmark" size={9} color="#060A13" /> : <Text style={styles.stepNumber}>{index + 1}</Text>}</View>
    <Text style={[styles.stepLabel, step.value && styles.stepLabelActive]}>{step.label}</Text>
    {index < steps.length - 1 ? <View style={[styles.stepLine, step.value && styles.stepLineActive]} /> : null}
  </View>)}</View>;
}

function StepSection({ number, eyebrow, title, detail, children }: { number: string; eyebrow: string; title: string; detail: string; children: React.ReactNode }) {
  return <View style={styles.stepSection}>
    <View style={styles.stepHeading}>
      <Text style={styles.stepIndex}>{number}</Text>
      <View style={styles.flex}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDetail}>{detail}</Text></View>
    </View>
    {children}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  themeVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,14,.48)' },
  themeLowerVeil: { position: 'absolute', left: 0, right: 0, top: '32%', bottom: 0, backgroundColor: 'rgba(3,7,18,.66)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 124 },
  flex: { flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.988 }] },
  back: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -7, paddingHorizontal: 7 },
  backText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '800', letterSpacing: .5 },
  hero: { minHeight: 148, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 28, lineHeight: 33, marginTop: 7, textShadowColor: 'rgba(0,0,0,.94)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 7, maxWidth: 310 },
  marketMark: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  marketMarkOuter: { position: 'absolute', width: 66, height: 66, borderRadius: 33, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.66)' },
  marketMarkInner: { position: 'absolute', width: 51, height: 51, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)' },
  marketMarkCrystal: { width: 58, height: 58 },
  areaRail: { height: 50, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(3,8,20,.18)' },
  areaTab: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.16)' },
  areaTabActive: { backgroundColor: 'rgba(226,197,141,.07)' },
  areaTitle: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 10.5 },
  areaTitleActive: { color: FateDropColors.goldBright },
  areaActiveGem: { position: 'absolute', width: 5, height: 5, bottom: -3, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  searchPanel: { marginTop: 18, paddingHorizontal: 8, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', backgroundColor: 'rgba(3,8,20,.28)' },
  searchHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  searchTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 3 },
  resetButton: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', borderRadius: 999 },
  resetText: { color: FateDropColors.goldBright, fontSize: 6.5, fontWeight: '900', letterSpacing: .65 },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, paddingLeft: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 4, backgroundColor: 'rgba(3,8,20,.56)' },
  searchInput: { flex: 1, minWidth: 0, color: FateDropColors.ivory, fontSize: 12, paddingVertical: 12 },
  searchAction: { width: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(226,197,141,.30)' },
  notice: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, marginTop: 8 },
  discoveryRail: { minHeight: 58, flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 3 },
  discoveryStep: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.30)', backgroundColor: 'rgba(3,8,20,.62)' },
  stepDotActive: { borderColor: FateDropColors.goldBright, backgroundColor: FateDropColors.goldBright },
  stepNumber: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900' },
  stepLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', letterSpacing: .55, marginTop: 5 },
  stepLabelActive: { color: FateDropColors.goldBright },
  stepLine: { position: 'absolute', top: 9, left: '62%', width: '76%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(226,197,141,.20)' },
  stepLineActive: { backgroundColor: 'rgba(226,197,141,.66)' },
  emptyState: { minHeight: 205, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 34, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.30)', backgroundColor: 'rgba(3,8,20,.25)' },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 20, marginTop: 10 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 7 },
  stepSection: { marginTop: 14, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.24)', backgroundColor: 'rgba(3,8,20,.25)' },
  stepHeading: { flexDirection: 'row', gap: 10, paddingHorizontal: 8, paddingBottom: 9 },
  stepIndex: { width: 25, color: 'rgba(226,197,141,.42)', fontFamily: Fonts.serif, fontSize: 17 },
  stepTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 2 },
  stepDetail: { color: FateDropColors.muted, fontSize: 7.5, lineHeight: 11, marginTop: 3 },
  optionStack: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.16)' },
  optionRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.15)' },
  optionRowActive: { backgroundColor: 'rgba(226,197,141,.065)' },
  optionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)' },
  optionIconActive: { borderColor: 'rgba(226,197,141,.72)', backgroundColor: 'rgba(226,197,141,.07)' },
  optionTitle: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 13 },
  optionTitleActive: { color: FateDropColors.ivory },
  optionMeta: { color: FateDropColors.muted, fontSize: 6.8, lineHeight: 10, marginTop: 3 },
  variantStack: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(124,110,255,.22)' },
  variantRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(124,110,255,.18)', backgroundColor: 'rgba(124,110,255,.025)' },
  variantGem: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)' },
  variantTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13.5, textTransform: 'capitalize' },
  variantMeta: { color: FateDropColors.muted, fontSize: 6.8, lineHeight: 10, marginTop: 4 },
  readPrice: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 999 },
  readPriceText: { color: FateDropColors.goldBright, fontSize: 6.3, fontWeight: '900', letterSpacing: .55 },
  truthPanel: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 18, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.26)', backgroundColor: 'rgba(3,8,20,.30)' },
  truthTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13 },
  truthCopy: { color: FateDropColors.muted, fontSize: 7, lineHeight: 10.5, marginTop: 3 },
});
