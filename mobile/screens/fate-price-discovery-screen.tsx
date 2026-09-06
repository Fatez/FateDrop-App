import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  FatePriceAreaRail,
  FatePriceScreenBackground,
  FatePriceCardGlyph,
  FatePriceTopBar,
  FatePriceTruth,
} from '@/components/fate-price-chrome';
import { TCG_REGISTRY } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  FateMarketApiError,
  fetchFatePriceSets,
  searchFatePriceCards,
  type FatePriceCard,
  type FatePriceSet,
} from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function tcgName(code: string) {
  return TCG_REGISTRY.find((item) => item.code === code)?.shortName
    || code.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function releaseLabel(value: number | null) {
  if (!value) return 'Release date verified later';
  return new Date(value).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

type PrintingResult = { card: FatePriceCard; identityCount: number };

function groupPrintings(cards: FatePriceCard[]) {
  const grouped = new Map<string, PrintingResult>();
  for (const card of cards) {
    const current = grouped.get(card.printingId);
    if (current) current.identityCount += 1;
    else grouped.set(card.printingId, { card, identityCount: 1 });
  }
  return [...grouped.values()].sort((left, right) => (
    String(left.card.name || '').localeCompare(String(right.card.name || ''))
    || left.card.collectorNumber.localeCompare(right.card.collectorNumber, undefined, { numeric: true })
  ));
}

export default function FatePriceDiscoveryScreen() {
  const params = useLocalSearchParams<{
    collectorNumber?: string | string[];
    name?: string | string[];
    query?: string | string[];
    tcg?: string | string[];
  }>();
  const routeTcg = first(params.tcg)?.trim().toLowerCase() || 'pokemon';
  const initialQuery = first(params.query)?.trim() || first(params.name)?.trim() || first(params.collectorNumber)?.trim() || '';
  const [selectedTcg, setSelectedTcg] = useState(routeTcg);
  const [query, setQuery] = useState(initialQuery);
  const [sets, setSets] = useState<FatePriceSet[]>([]);
  const [matchingSets, setMatchingSets] = useState<FatePriceSet[]>([]);
  const [cards, setCards] = useState<FatePriceCard[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const seededSearch = useRef(false);

  const loadSets = useCallback(async (tcgCode: string) => {
    setLoadingSets(true);
    setNotice('');
    try {
      const response = await fetchFatePriceSets({ tcgCode, limit: 80 });
      setSets(response.sets);
      if (!response.sets.length) setNotice(`No verified ${tcgName(tcgCode)} sets are published in FatePrice yet.`);
    } catch (error) {
      setSets([]);
      setNotice(error instanceof FateMarketApiError ? error.message : 'Verified FatePrice sets are temporarily unavailable.');
    } finally {
      setLoadingSets(false);
    }
  }, []);

  useEffect(() => {
    void loadSets(routeTcg);
  }, [loadSets, routeTcg]);

  const runSearch = useCallback(async () => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setCards([]);
      setMatchingSets([]);
      setNotice('Enter at least two letters or numbers. FatePrice will keep the identity path exact.');
      return;
    }
    setSearching(true);
    setNotice('');
    try {
      const [cardResponse, setResponse] = await Promise.all([
        searchFatePriceCards({ query: cleanQuery, limit: 100 }),
        fetchFatePriceSets({ tcgCode: selectedTcg, query: cleanQuery, limit: 20 }),
      ]);
      const scopedCards = cardResponse.cards.filter((card) => !selectedTcg || card.tcgCode === selectedTcg);
      setCards(scopedCards);
      setMatchingSets(setResponse.sets);
      if (!scopedCards.length && !setResponse.sets.length) setNotice('No verified set or exact-card identity matched that search.');
    } catch (error) {
      setCards([]);
      setMatchingSets([]);
      setNotice(error instanceof FateMarketApiError ? error.message : 'FatePrice discovery is temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  }, [query, selectedTcg]);

  useEffect(() => {
    if (seededSearch.current || initialQuery.length < 2) return;
    seededSearch.current = true;
    void runSearch();
  }, [initialQuery, runSearch]);

  const chooseTcg = useCallback((tcgCode: string) => {
    setSelectedTcg(tcgCode);
    setCards([]);
    setMatchingSets([]);
    setQuery('');
    void loadSets(tcgCode);
  }, [loadSets]);

  const openSet = useCallback((set: FatePriceSet) => {
    router.push({ pathname: '/fate-price-set', params: { setId: set.id, setName: set.name, tcg: set.tcgCode || selectedTcg } });
  }, [selectedTcg]);

  const openPrinting = useCallback((card: FatePriceCard) => {
    router.push({
      pathname: '/fate-price-variants',
      params: {
        collectorNumber: card.collectorNumber,
        name: card.name || '',
        printingId: card.printingId,
        setId: card.setId,
        setName: card.setName || '',
        tcg: card.tcgCode || selectedTcg,
      },
    });
  }, [selectedTcg]);

  const verifiedSets = useMemo(() => [...sets]
    .sort((left, right) => (right.releasedAt || 0) - (left.releasedAt || 0) || left.name.localeCompare(right.name))
    .slice(0, 10), [sets]);
  const printings = useMemo(() => groupPrintings(cards), [cards]);
  const games = TCG_REGISTRY.slice(0, 4);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FatePriceScreenBackground sceneKey="discovery" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <FatePriceTopBar step={1} />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FATEPRICE · SEARCH & DISCOVERY</Text>
        <Text style={styles.title}>Find the card.{`\n`}Remove every ambiguity.</Text>
        <Text style={styles.copy}>Search once, then move through Game → Set → Card → Variant. The wayfinder opens a value only after the exact identity is proven.</Text>
        <View style={styles.heroBadges}>
          <View style={styles.heroBadge}><Ionicons name="shield-checkmark-outline" size={12} color={FateDropColors.goldBright} /><Text style={styles.heroBadgeText}>VERIFIED IDENTITIES</Text></View>
          <View style={styles.heroBadge}><Ionicons name="cash-outline" size={12} color={FateDropColors.goldBright} /><Text style={styles.heroBadgeText}>GBP DISPLAY</Text></View>
        </View>
      </View>

      <FatePriceAreaRail />

      <View style={styles.searchPanel}>
        <View style={styles.searchCopy}>
          <Text style={styles.sectionEyebrow}>START WITH WHAT YOU KNOW</Text>
          <Text style={styles.searchTitle}>Cards, sets or collector numbers</Text>
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={20} color={FateDropColors.goldBright} />
          <TextInput
            accessibilityLabel="Search FatePrice cards, sets or collector numbers"
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => void runSearch()}
            placeholder="e.g. Charizard, 151, 199…"
            placeholderTextColor={FateDropColors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          <Pressable accessibilityLabel="Search FatePrice" disabled={searching} onPress={() => void runSearch()} style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}>
            {searching ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name="arrow-forward" size={18} color={FateDropColors.goldBright} />}
          </Pressable>
        </View>
        <View style={styles.scopeLine}><View style={styles.scopeDot} /><Text style={styles.scopeText}>Searching verified {tcgName(selectedTcg)} identities</Text></View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>

      {(matchingSets.length > 0 || printings.length > 0) ? <View style={styles.section}>
        <SectionHeading eyebrow="EXACT MATCHES" title="Continue the identity path" detail={`${matchingSets.length} set${matchingSets.length === 1 ? '' : 's'} · ${printings.length} canonical card printing${printings.length === 1 ? '' : 's'}`} />
        {matchingSets.map((set) => <SetResult key={set.id} set={set} onPress={() => openSet(set)} />)}
        {printings.map(({ card, identityCount }) => <PrintingResultRow key={card.printingId} card={card} identityCount={identityCount} onPress={() => openPrinting(card)} />)}
      </View> : null}

      <View style={styles.section}>
        <SectionHeading eyebrow="BROWSE BY TCG" title="Choose the world first" detail="Only verified catalogue evidence appears beyond this point." />
        <View style={styles.gameGrid}>
          {games.map((game) => {
            const active = selectedTcg === game.code;
            return <Pressable key={game.code} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseTcg(game.code)} style={({ pressed }) => [styles.gameCard, active && styles.gameCardActive, pressed && styles.pressed]}>
              <View style={[styles.gameIcon, active && styles.gameIconActive]}><Ionicons name={game.icon} size={22} color={active ? FateDropColors.goldBright : game.accent} /></View>
              <Text numberOfLines={1} style={[styles.gameName, active && styles.gameNameActive]}>{game.shortName}</Text>
              <Text style={styles.gameStatus}>{active ? 'SELECTED' : game.live ? 'VERIFIED' : 'CATALOGUE'}</Text>
            </Pressable>;
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading eyebrow="VERIFIED SETS" title={`Explore ${tcgName(selectedTcg)}`} detail="Newest verified releases first—not a fabricated popularity chart." />
        {loadingSets ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Reading canonical sets…</Text></View> : null}
        {!loadingSets && verifiedSets.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.setRail}>
          {verifiedSets.map((set) => <Pressable key={set.id} accessibilityRole="button" onPress={() => openSet(set)} style={({ pressed }) => [styles.setCard, pressed && styles.pressed]}>
            <View style={styles.setArt}><View style={styles.setOrbit} /><Ionicons name="albums-outline" size={26} color={FateDropColors.goldBright} /></View>
            <Text numberOfLines={2} style={styles.setName}>{set.name}</Text>
            <Text numberOfLines={1} style={styles.setSeries}>{set.seriesName || 'Verified series'}</Text>
            <Text style={styles.setRelease}>{releaseLabel(set.releasedAt)}</Text>
          </Pressable>)}
        </ScrollView> : null}
      </View>

      <FatePriceTruth title="Exactness is the feature.">FateDrop never averages lookalike printings into a convenient answer. Search broadly, then value the exact finish, rarity and language narrowly.</FatePriceTruth>
    </ScrollView>
  </SafeAreaView>;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <View style={styles.sectionHeading}>
    <View style={styles.headingGem} />
    <View style={styles.flex}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionDetail}>{detail}</Text></View>
  </View>;
}

function SetResult({ set, onPress }: { set: FatePriceSet; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
    <View style={styles.resultIcon}><Ionicons name="albums-outline" size={19} color={FateDropColors.goldBright} /></View>
    <View style={styles.flex}><Text style={styles.resultTitle}>{set.name}</Text><Text style={styles.resultMeta}>SET · {set.seriesName || 'Verified series'} · {set.total || set.printedTotal || '—'} cards</Text></View>
    <Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright} />
  </Pressable>;
}

function PrintingResultRow({ card, identityCount, onPress }: { card: FatePriceCard; identityCount: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
    <FatePriceCardGlyph collectorNumber={card.collectorNumber} />
    <View style={styles.flex}><Text style={styles.resultTitle}>{card.name || 'Unknown card'}</Text><Text style={styles.resultMeta}>{card.setName || 'Verified set'} · #{card.collectorNumber}</Text><Text style={styles.resultVariant}>{identityCount} exact finish/language identit{identityCount === 1 ? 'y' : 'ies'}</Text></View>
    <Ionicons name="chevron-forward" size={18} color={FateDropColors.goldBright} />
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 7, paddingBottom: 126 },
  flex: { flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  hero: { minHeight: 238, justifyContent: 'center', paddingRight: '29%', paddingVertical: 16 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.55 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 34, lineHeight: 38, marginTop: 9, textShadowColor: 'rgba(0,0,0,.98)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  copy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 10, textShadowColor: '#030713', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 7 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  heroBadge: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 999, backgroundColor: 'rgba(3,8,20,.66)' },
  heroBadgeText: { color: FateDropColors.goldBright, fontSize: 6.5, fontWeight: '900', letterSpacing: .65 },
  searchPanel: { marginTop: 17, padding: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', borderRadius: 16, backgroundColor: 'rgba(4,9,22,.82)' },
  searchCopy: { paddingHorizontal: 2 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.25 },
  searchTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, marginTop: 4 },
  searchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11, paddingLeft: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)', borderRadius: 11, backgroundColor: 'rgba(1,5,15,.78)' },
  searchInput: { flex: 1, minWidth: 0, color: FateDropColors.ivory, fontSize: 12, paddingVertical: 13 },
  searchAction: { width: 49, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(124,110,255,.42)' },
  scopeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9, paddingHorizontal: 3 },
  scopeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: FateDropColors.manifested },
  scopeText: { color: FateDropColors.muted, fontSize: 8 },
  notice: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 13, marginTop: 8, paddingHorizontal: 3 },
  section: { marginTop: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 11 },
  headingGem: { width: 7, height: 7, marginTop: 4, transform: [{ rotate: '45deg' }], borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(124,110,255,.45)' },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 21, marginTop: 3 },
  sectionDetail: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 12, marginTop: 3 },
  gameGrid: { flexDirection: 'row', gap: 7 },
  gameCard: { flex: 1, minWidth: 0, height: 91, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 13, backgroundColor: 'rgba(4,9,22,.7)' },
  gameCardActive: { borderColor: 'rgba(226,197,141,.86)', backgroundColor: 'rgba(124,110,255,.12)', shadowColor: FateDropColors.goldBright, shadowOpacity: .25, shadowRadius: 7 },
  gameIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(124,110,255,.09)' },
  gameIconActive: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.55)', backgroundColor: 'rgba(226,197,141,.07)' },
  gameName: { color: FateDropColors.secondary, fontFamily: Fonts.serif, fontSize: 10, marginTop: 6 },
  gameNameActive: { color: FateDropColors.ivory },
  gameStatus: { color: FateDropColors.muted, fontSize: 5.5, fontWeight: '900', letterSpacing: .55, marginTop: 2 },
  loading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 9 },
  loadingText: { color: FateDropColors.muted, fontSize: 9 },
  setRail: { gap: 9, paddingRight: 8 },
  setCard: { width: 137, minHeight: 181, padding: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.36)', borderRadius: 14, backgroundColor: 'rgba(4,9,22,.77)' },
  setArt: { height: 87, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.36)', backgroundColor: 'rgba(23,16,54,.7)' },
  setOrbit: { position: 'absolute', width: 95, height: 41, borderRadius: 50, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.4)', transform: [{ rotate: '-17deg' }] },
  setName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 13, lineHeight: 16, marginTop: 8 },
  setSeries: { color: FateDropColors.secondary, fontSize: 7.5, marginTop: 4 },
  setRelease: { color: FateDropColors.goldBright, fontSize: 6.5, fontWeight: '800', letterSpacing: .45, marginTop: 5 },
  resultRow: { minHeight: 85, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 13, backgroundColor: 'rgba(4,9,22,.8)' },
  resultIcon: { width: 55, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.44)', backgroundColor: 'rgba(124,110,255,.09)' },
  resultTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 15 },
  resultMeta: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, marginTop: 3 },
  resultVariant: { color: FateDropColors.goldBright, fontSize: 7, marginTop: 4 },
});
