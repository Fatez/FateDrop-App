import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';
import { FateDropColors, Fonts } from '@/constants/theme';
import { FateMarketApiError, fetchFatePriceSetCards, type FatePriceCard, type FatePriceSet } from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pretty(value: string) {
  if (!value) return 'Unknown';
  if (value === 'standard') return 'Standard';
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

type PrintingGroup = {
  printingId: string;
  name: string;
  collectorNumber: string;
  rarity: string | null;
  supertype: string | null;
  cards: FatePriceCard[];
};

function groupPrintings(cards: FatePriceCard[]) {
  const groups = new Map<string, PrintingGroup>();
  for (const card of cards) {
    const current = groups.get(card.printingId);
    if (current) current.cards.push(card);
    else groups.set(card.printingId, {
      printingId: card.printingId,
      name: card.name || 'Unknown card',
      collectorNumber: card.collectorNumber,
      rarity: card.rarity,
      supertype: card.supertype,
      cards: [card],
    });
  }
  return [...groups.values()].sort((left, right) => (
    left.collectorNumber.localeCompare(right.collectorNumber, undefined, { numeric: true })
    || left.name.localeCompare(right.name)
  ));
}

export default function FatePriceSetScreen() {
  const params = useLocalSearchParams<{
    setId?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const setId = first(params.setId)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || 'Verified set';
  const tcg = first(params.tcg)?.trim() || 'pokemon';
  const [set, setSet] = useState<FatePriceSet | null>(null);
  const [cards, setCards] = useState<FatePriceCard[]>([]);
  const [query, setQuery] = useState('');
  const [finish, setFinish] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!setId) {
      setNotice('Choose a verified set from FatePrice first.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      const response = await fetchFatePriceSetCards(setId, { languageCode: '', variantCode: '', limit: 500 });
      setSet(response.set);
      setCards(response.cards);
      const languages = unique(response.cards.map((card) => card.languageCode));
      if (!languages.includes('en')) setLanguage(languages[0] || 'all');
      if (!response.cards.length) setNotice('This set is verified, but no exact card identities are published yet.');
    } catch (error) {
      setCards([]);
      setNotice(error instanceof FateMarketApiError ? error.message : 'This verified set is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    void load();
  }, [load]);

  const finishes = useMemo(() => unique(cards.map((card) => card.variantCode)), [cards]);
  const rarities = useMemo(() => unique(cards.map((card) => card.rarity)), [cards]);
  const languages = useMemo(() => unique(cards.map((card) => card.languageCode)), [cards]);
  const filteredCards = useMemo(() => cards.filter((card) => {
    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery && !`${card.name || ''} ${card.collectorNumber}`.toLowerCase().includes(cleanQuery)) return false;
    if (finish !== 'all' && card.variantCode !== finish) return false;
    if (rarity !== 'all' && card.rarity !== rarity) return false;
    if (language !== 'all' && card.languageCode !== language) return false;
    return true;
  }), [cards, finish, language, query, rarity]);
  const groups = useMemo(() => groupPrintings(filteredCards), [filteredCards]);
  const setName = set?.name || routeSetName;

  const openVariants = useCallback((group: PrintingGroup) => {
    router.push({
      pathname: '/fate-price-variants',
      params: {
        collectorNumber: group.collectorNumber,
        finish: finish === 'all' ? '' : finish,
        language: language === 'all' ? '' : language,
        name: group.name,
        printingId: group.printingId,
        setId,
        setName,
        tcg,
      },
    });
  }, [finish, language, setId, setName, tcg]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FatePriceScreenBackground sceneKey={`set:${setId}`} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <FatePriceTopBar step={2} backLabel="Search" />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FATEPRICE · SET VIEW</Text>
        <Text style={styles.title}>Narrow it down.</Text>
        <Text style={styles.copy}>Use the set’s real fields to find the exact card. Finish, rarity and language stay separate because they describe different things.</Text>
        <View style={styles.breadcrumb}><Ionicons name="sparkles-outline" size={13} color={FateDropColors.goldBright} /><Text style={styles.breadcrumbText}>{tcg.replaceAll('-', ' ').toUpperCase()} › {setName}</Text></View>
      </View>

      <View style={styles.setPanel}>
        <View style={styles.setMark}><Ionicons name="albums-outline" size={26} color={FateDropColors.goldBright} /><View style={styles.setOrbit} /></View>
        <View style={styles.flex}><Text style={styles.setName}>{setName}</Text><Text style={styles.setMeta}>{set?.seriesName || 'Verified series'} · {set?.total || set?.printedTotal || groups.length || '—'} cards</Text></View>
        <View style={styles.verified}><Ionicons name="shield-checkmark" size={12} color={FateDropColors.manifested} /><Text style={styles.verifiedText}>VERIFIED</Text></View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={19} color={FateDropColors.goldBright} />
        <TextInput accessibilityLabel={`Search within ${setName}`} autoCorrect={false} onChangeText={setQuery} placeholder={`Search within ${setName}…`} placeholderTextColor={FateDropColors.muted} style={styles.searchInput} value={query} />
        {query ? <Pressable accessibilityLabel="Clear set search" onPress={() => setQuery('')} style={styles.clear}><Ionicons name="close-circle" size={18} color={FateDropColors.secondary} /></Pressable> : null}
      </View>

      <FilterGroup label="FINISH" detail="How the card surface is printed" values={finishes} selected={finish} onSelect={setFinish} />
      <FilterGroup label="RARITY" detail="The card’s set classification" values={rarities} selected={rarity} onSelect={setRarity} />
      <FilterGroup label="LANGUAGE" detail="A separate exact identity field" values={languages} selected={language} onSelect={setLanguage} />

      <View style={styles.resultsHeading}>
        <View><Text style={styles.count}>{groups.length} CARDS</Text><Text style={styles.countDetail}>Every tile represents one canonical printing.</Text></View>
        <View style={styles.sort}><Ionicons name="swap-vertical-outline" size={15} color={FateDropColors.goldBright} /><Text style={styles.sortText}>SET ORDER</Text></View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Reading exact set identities…</Text></View> : null}
      {!loading && notice ? <View style={styles.empty}><Ionicons name="telescope-outline" size={27} color={FateDropColors.goldBright} /><Text style={styles.emptyTitle}>The path stops here for now.</Text><Text style={styles.emptyCopy}>{notice}</Text></View> : null}
      {!loading && !notice ? <View style={styles.cardGrid}>{groups.map((group) => <Pressable key={group.printingId} accessibilityRole="button" onPress={() => openVariants(group)} style={({ pressed }) => [styles.cardTile, pressed && styles.pressed]}>
        <View style={styles.glyphWrap}><FatePriceCardGlyph collectorNumber={group.collectorNumber} large /></View>
        <Text numberOfLines={2} style={styles.cardName}>{group.name}</Text>
        <Text style={styles.cardMeta}>#{group.collectorNumber} · {group.rarity || group.supertype || 'Verified card'}</Text>
        <View style={styles.identityLine}><Text style={styles.identityText}>{group.cards.length} EXACT {group.cards.length === 1 ? 'IDENTITY' : 'IDENTITIES'}</Text><Ionicons name="chevron-forward" size={14} color={FateDropColors.goldBright} /></View>
      </Pressable>)}</View> : null}

      <FatePriceTruth title="Finish is not rarity.">A Common card can also be Reverse Holo. FatePrice filters both fields independently so the exact identity never changes silently.</FatePriceTruth>
    </ScrollView>
  </SafeAreaView>;
}

function FilterGroup({ label, detail, values, selected, onSelect }: { label: string; detail: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.filterGroup}>
    <View style={styles.filterHeading}><Text style={styles.filterLabel}>{label}</Text><Text style={styles.filterDetail}>{detail}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
      <FilterChip label="All" active={selected === 'all'} onPress={() => onSelect('all')} />
      {values.map((value) => <FilterChip key={value} label={label === 'LANGUAGE' ? value.toUpperCase() : pretty(value)} active={selected === value} onPress={() => onSelect(value)} />)}
    </ScrollView>
  </View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}>
    {active ? <View style={styles.filterGem} /> : null}<Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 7, paddingBottom: 126 },
  flex: { flex: 1 },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  hero: { minHeight: 180, justifyContent: 'center', paddingRight: '31%', paddingVertical: 12 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 35, lineHeight: 39, marginTop: 8, textShadowColor: 'rgba(0,0,0,.95)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 8 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  breadcrumbText: { flex: 1, color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .65 },
  setPanel: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', borderRadius: 14, backgroundColor: 'rgba(4,9,22,.82)' },
  setMark: { width: 51, height: 51, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 11, backgroundColor: 'rgba(124,110,255,.12)' },
  setOrbit: { position: 'absolute', width: 58, height: 25, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.45)', transform: [{ rotate: '-18deg' }] },
  setName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17 },
  setMeta: { color: FateDropColors.secondary, fontSize: 8, marginTop: 4 },
  verified: { alignItems: 'center', gap: 3 },
  verifiedText: { color: FateDropColors.manifested, fontSize: 5.5, fontWeight: '900', letterSpacing: .55 },
  searchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, paddingLeft: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.38)', borderRadius: 12, backgroundColor: 'rgba(3,8,20,.8)' },
  searchInput: { flex: 1, minWidth: 0, color: FateDropColors.ivory, fontSize: 11.5, paddingVertical: 13 },
  clear: { width: 45, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  filterGroup: { marginTop: 15 },
  filterHeading: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 2 },
  filterLabel: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.15 },
  filterDetail: { color: FateDropColors.muted, fontSize: 7.5 },
  filterRail: { gap: 7, paddingTop: 8, paddingRight: 8 },
  filterChip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.31)', borderRadius: 999, backgroundColor: 'rgba(3,8,20,.72)' },
  filterChipActive: { borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(124,110,255,.16)', shadowColor: FateDropColors.goldBright, shadowOpacity: .22, shadowRadius: 6 },
  filterGem: { width: 5, height: 5, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  filterChipText: { color: FateDropColors.secondary, fontSize: 8.5 },
  filterChipTextActive: { color: FateDropColors.ivory, fontWeight: '800' },
  resultsHeading: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.27)' },
  count: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  countDetail: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 3 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { color: FateDropColors.secondary, fontSize: 6.5, fontWeight: '900', letterSpacing: .55 },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: FateDropColors.muted, fontSize: 9 },
  empty: { minHeight: 230, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.27)', borderRadius: 15 },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, marginTop: 9 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 6 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  cardTile: { width: '48.5%', minHeight: 255, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 15, backgroundColor: 'rgba(4,9,22,.82)' },
  glyphWrap: { height: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, backgroundColor: 'rgba(20,13,47,.48)' },
  cardName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 14, lineHeight: 17, marginTop: 8 },
  cardMeta: { color: FateDropColors.secondary, fontSize: 7, lineHeight: 10, marginTop: 4 },
  identityLine: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.22)' },
  identityText: { color: FateDropColors.goldBright, fontSize: 5.7, fontWeight: '900', letterSpacing: .5 },
});
