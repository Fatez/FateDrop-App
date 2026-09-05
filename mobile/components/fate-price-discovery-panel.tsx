import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { TCG_REGISTRY } from '@/constants/tcg-registry';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  fetchFatePriceSeries,
  fetchFatePriceSets,
  searchScopedFatePriceCards,
  type FatePriceSeries,
  type FatePriceSet,
} from '@/services/fate-price-discovery';
import { FateMarketApiError, type FatePriceCard } from '@/services/fate-market';

type DiscoveryScope = {
  tcgCode: string;
  seriesId: string;
  setId: string;
};

type Props = {
  initialQuery?: string;
  initialTcgCode?: string;
  initialSeriesId?: string;
  initialSeriesName?: string;
  initialSetId?: string;
  initialSetName?: string;
  onSelectCard: (card: FatePriceCard) => void;
};

function cardLabel(card: FatePriceCard) {
  const number = card.collectorNumber ? ` #${card.collectorNumber}` : '';
  const variant = card.variantCode && card.variantCode !== 'standard' ? ` · ${card.variantCode.replaceAll('-', ' ')}` : '';
  return `${card.name || 'Unknown card'}${number}${variant}`;
}

export function FatePriceDiscoveryPanel({
  initialQuery = '',
  initialTcgCode = '',
  initialSeriesId = '',
  initialSeriesName = '',
  initialSetId = '',
  initialSetName = '',
  onSelectCard,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<DiscoveryScope>({
    tcgCode: initialTcgCode,
    seriesId: initialSeriesId,
    setId: initialSetId,
  });
  const [series, setSeries] = useState<FatePriceSeries[]>([]);
  const [sets, setSets] = useState<FatePriceSet[]>([]);
  const [results, setResults] = useState<FatePriceCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const requestSequence = useRef(0);

  const liveTcgs = useMemo(() => TCG_REGISTRY.filter((entry) => entry.live), []);
  const selectedTcg = liveTcgs.find((entry) => entry.code === scope.tcgCode);
  const selectedSeries = series.find((entry) => entry.id === scope.seriesId);
  const selectedSet = sets.find((entry) => entry.id === scope.setId);
  const seriesLabel = selectedSeries?.name || (scope.seriesId === initialSeriesId ? initialSeriesName : '') || 'Series';
  const setLabel = selectedSet?.name || (scope.setId === initialSetId ? initialSetName : '') || 'Set';

  const searchCards = useCallback(async (nextScope: DiscoveryScope, nextQuery = query) => {
    const cleanQuery = nextQuery.trim();
    if (cleanQuery.length < 2 && !nextScope.tcgCode && !nextScope.seriesId && !nextScope.setId) {
      setResults([]);
      setNotice(cleanQuery ? 'Enter at least two letters or numbers.' : 'Choose a TCG to browse, or search by card name or number.');
      return;
    }

    const sequence = ++requestSequence.current;
    setSearching(true);
    setNotice('');
    try {
      const response = await searchScopedFatePriceCards({
        query: cleanQuery,
        tcgCode: nextScope.tcgCode,
        seriesId: nextScope.seriesId,
        setId: nextScope.setId,
        limit: 60,
      });
      if (sequence !== requestSequence.current) return;
      setResults(response.cards);
      setNotice(response.cards.length
        ? `${response.count} exact canonical card${response.count === 1 ? '' : 's'} in this scope.`
        : 'No exact canonical cards match this scope.');
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setResults([]);
      setNotice(error instanceof FateMarketApiError ? error.message : 'Canonical card search is temporarily unavailable.');
    } finally {
      if (sequence === requestSequence.current) setSearching(false);
    }
  }, [query]);

  const applyScope = useCallback((nextScope: DiscoveryScope) => {
    setScope(nextScope);
    void searchCards(nextScope);
  }, [searchCards]);

  useEffect(() => {
    let active = true;
    if (!scope.tcgCode) {
      setSeries([]);
      return () => { active = false; };
    }
    setMetadataLoading(true);
    void fetchFatePriceSeries(scope.tcgCode)
      .then((response) => { if (active) setSeries(response.series); })
      .catch(() => { if (active) setSeries([]); })
      .finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; };
  }, [scope.tcgCode]);

  useEffect(() => {
    let active = true;
    if (!scope.tcgCode || !scope.seriesId) {
      setSets([]);
      return () => { active = false; };
    }
    setMetadataLoading(true);
    void fetchFatePriceSets(scope.tcgCode, scope.seriesId)
      .then((response) => { if (active) setSets(response.sets); })
      .catch(() => { if (active) setSets([]); })
      .finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; };
  }, [scope.seriesId, scope.tcgCode]);

  useEffect(() => {
    if (initialQuery.trim() || initialTcgCode || initialSeriesId || initialSetId) {
      void searchCards({ tcgCode: initialTcgCode, seriesId: initialSeriesId, setId: initialSetId }, initialQuery);
    }
  // Route-derived discovery should run once. Later changes are owned by the controls below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>EXACT CARD IDENTITY</Text>
          <Text style={styles.title}>{scope.setId ? `Choose a card from ${setLabel}` : scope.seriesId ? `Browse ${seriesLabel}` : selectedTcg ? `Browse ${selectedTcg.shortName}` : 'Find a card by name or number'}</Text>
        </View>
        {metadataLoading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}
      </View>

      <Text style={styles.stepLabel}>1 · TCG</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        <FilterChip label="ALL" selected={!scope.tcgCode} onPress={() => applyScope({ tcgCode: '', seriesId: '', setId: '' })} />
        {liveTcgs.map((tcg) => (
          <FilterChip key={tcg.code} label={tcg.shortName.toUpperCase()} selected={scope.tcgCode === tcg.code} onPress={() => applyScope({ tcgCode: tcg.code, seriesId: '', setId: '' })} />
        ))}
      </ScrollView>

      {scope.tcgCode ? <>
        <Text style={styles.stepLabel}>2 · SERIES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          <FilterChip label="ALL SERIES" selected={!scope.seriesId} onPress={() => applyScope({ tcgCode: scope.tcgCode, seriesId: '', setId: '' })} />
          {series.map((item) => (
            <FilterChip key={item.id} label={item.name.toUpperCase()} selected={scope.seriesId === item.id} onPress={() => applyScope({ tcgCode: scope.tcgCode, seriesId: item.id, setId: '' })} />
          ))}
        </ScrollView>
      </> : null}

      {scope.tcgCode && scope.seriesId ? <>
        <Text style={styles.stepLabel}>3 · SET</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          <FilterChip label="ALL SETS" selected={!scope.setId} onPress={() => applyScope({ tcgCode: scope.tcgCode, seriesId: scope.seriesId, setId: '' })} />
          {sets.map((item) => (
            <FilterChip key={item.id} label={item.name.toUpperCase()} selected={scope.setId === item.id} onPress={() => applyScope({ tcgCode: scope.tcgCode, seriesId: scope.seriesId, setId: item.id })} />
          ))}
        </ScrollView>
      </> : null}

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={FateDropColors.goldBright} />
        <TextInput
          accessibilityLabel="Search exact cards within current filters"
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={setQuery}
          onSubmitEditing={() => void searchCards(scope)}
          placeholder={scope.setId ? `Search ${setLabel}` : scope.seriesId ? `Search ${seriesLabel}` : scope.tcgCode ? `Search ${selectedTcg?.shortName || 'this TCG'}` : 'e.g. Charizard or 194'}
          placeholderTextColor={FateDropColors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        <Pressable accessibilityLabel="Search cards within current filters" disabled={searching} onPress={() => void searchCards(scope)} style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}>
          {searching ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name="arrow-forward" size={17} color={FateDropColors.goldBright} />}
        </Pressable>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {results.length ? <View style={styles.results}>{results.map((card) => (
        <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`Read FatePrice for ${cardLabel(card)}`} onPress={() => { setResults([]); setNotice(''); onSelectCard(card); }} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
          <View style={styles.resultGem}><Ionicons name="diamond-outline" size={15} color={FateDropColors.goldBright} /></View>
          <View style={styles.flex}>
            <Text style={styles.resultName}>{cardLabel(card)}</Text>
            <Text style={styles.resultMeta}>{[card.seriesName, card.setName, card.languageCode?.toUpperCase()].filter(Boolean).join(' · ')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={FateDropColors.muted} />
        </Pressable>
      ))}</View> : null}
    </>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipActive, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 3 },
  stepLabel: { color: FateDropColors.muted, fontSize: 6.5, fontWeight: '900', letterSpacing: .7, marginTop: 12 },
  filterRail: { gap: 7, paddingTop: 7, paddingRight: 18 },
  filterChip: { minHeight: 31, maxWidth: 190, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.25)', backgroundColor: 'rgba(3,8,20,.32)' },
  filterChipActive: { borderColor: 'rgba(226,197,141,.72)', backgroundColor: 'rgba(226,197,141,.09)' },
  filterText: { color: FateDropColors.muted, fontSize: 6.7, fontWeight: '900', letterSpacing: .35 },
  filterTextActive: { color: FateDropColors.goldBright },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13, paddingLeft: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 4, backgroundColor: 'rgba(3,8,20,.52)' },
  searchInput: { flex: 1, minWidth: 0, color: FateDropColors.ivory, fontSize: 12, paddingVertical: 12 },
  searchAction: { width: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(226,197,141,.30)' },
  notice: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, marginTop: 8 },
  results: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.22)' },
  resultRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.18)' },
  resultGem: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)' },
  resultName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12.5 },
  resultMeta: { color: FateDropColors.muted, fontSize: 7, marginTop: 3 },
});
