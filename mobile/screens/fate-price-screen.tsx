import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToFateCollectorAction } from '@/components/add-to-fate-collector-action';
import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar } from '@/components/fate-price-chrome';
import { FateDropColors, Fonts } from '@/constants/theme';
import {
  FateMarketApiError,
  fetchFatePrice,
  fetchFatePriceCard,
  fetchFatePriceHistory,
  searchFatePriceCards,
  type FatePriceCard,
  type FatePriceHistoryDays,
  type FatePriceHistorySnapshot,
  type FatePriceMovement,
  type FatePriceScope,
  type FatePriceSnapshot,
} from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(value: number | null | undefined, currencyCode: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const currency = currencyCode || 'EUR';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function movementText(movement: FatePriceMovement | undefined) {
  const value = movement?.available ? movement.percent : null;
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function movementAccent(movement: FatePriceMovement | undefined) {
  const value = movement?.available ? movement.percent : null;
  if (value == null || value === 0) return FateDropColors.goldBright;
  return value > 0 ? FateDropColors.manifested : FateDropColors.vanished;
}

function formatDate(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Unknown';
  try {
    return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Unknown';
  }
}

function scopeKey(scope: FatePriceScope) {
  return `${scope.currencyCode || ''}|${scope.marketSegmentKey}|${scope.conditionCode}`;
}

function scopeLabel(scope: FatePriceScope) {
  const segment = scope.marketSegmentKey.replaceAll('_', ' ').replaceAll('-', ' ');
  const condition = scope.conditionCode === 'unspecified' ? null : scope.conditionCode.replaceAll('_', ' ');
  return [segment, condition, scope.currencyCode].filter(Boolean).join(' · ');
}

function evidenceReason(reason: string | null | undefined) {
  if (reason === 'AMBIGUOUS_MARKET_SCOPE') return 'More than one verified market scope is available. Choose the exact scope below.';
  if (reason === 'NO_VERIFIED_MARKET_EVIDENCE') return 'No verified market evidence exists for this exact card yet.';
  if (reason === 'NO_MARKET_EVIDENCE_FOR_SCOPE') return 'No verified evidence exists for the selected market scope.';
  if (reason === 'STALE_MARKET_EVIDENCE') return 'The latest evidence is too old to publish as a current FatePrice.';
  if (reason === 'INSUFFICIENT_MARKET_SIGNALS') return 'The source does not yet provide enough central price signals.';
  if (reason === 'NO_MARKET_EVIDENCE_AS_OF') return 'There is no verified evidence at the required point in time.';
  if (reason === 'NO_MARKET_EVIDENCE_IN_RANGE') return 'There are no stored market-day observations in this window yet.';
  return 'Choose an exact canonical card to read its verified market evidence.';
}

function cardLabel(card: FatePriceCard) {
  const number = card.collectorNumber ? ` #${card.collectorNumber}` : '';
  const variant = card.variantCode && card.variantCode !== 'standard' ? ` · ${card.variantCode.replaceAll('-', ' ')}` : '';
  return `${card.name || 'Unknown card'}${number}${variant}`;
}

export default function FatePriceScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    collectorNumber?: string | string[];
    name?: string | string[];
    printingId?: string | string[];
    query?: string | string[];
    setId?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const routeCardId = first(params.cardId)?.trim() || '';
  const routeSetId = first(params.setId)?.trim() || '';
  const routeSetName = first(params.setName)?.trim() || '';
  const routeName = first(params.name)?.trim() || '';
  const routePrintingId = first(params.printingId)?.trim() || '';
  const routeCollectorNumber = first(params.collectorNumber)?.trim() || '';
  const routeQuery = first(params.query)?.trim() || '';
  const [query, setQuery] = useState(routeSetId ? '' : routeQuery || routeName);
  const [setFilterId, setSetFilterId] = useState(routeSetId);
  const [results, setResults] = useState<FatePriceCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<FatePriceCard | null>(null);
  const [selectedCardId, setSelectedCardId] = useState(routeCardId);
  const [price, setPrice] = useState<FatePriceSnapshot | null>(null);
  const [history, setHistory] = useState<FatePriceHistorySnapshot | null>(null);
  const [historyDays, setHistoryDays] = useState<FatePriceHistoryDays>(30);
  const [searching, setSearching] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchNotice, setSearchNotice] = useState('');
  const [priceNotice, setPriceNotice] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');

  const loadPrice = useCallback(async (cardIdentityId: string, scope: FatePriceScope | null = null, force = false) => {
    setPriceLoading(true);
    setPriceNotice('');
    try {
      const next = await fetchFatePrice(cardIdentityId, { force, scope });
      setPrice(next);
    } catch (error) {
      setPrice(null);
      setPriceNotice(error instanceof FateMarketApiError ? error.message : 'FatePrice evidence is temporarily unavailable.');
    } finally {
      setPriceLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (cardIdentityId: string, scope: FatePriceScope | null = null, days: FatePriceHistoryDays = 30, force = false) => {
    setHistoryLoading(true);
    setHistoryNotice('');
    try {
      const next = await fetchFatePriceHistory(cardIdentityId, { days, force, scope });
      setHistory(next);
    } catch (error) {
      setHistory(null);
      setHistoryNotice(error instanceof FateMarketApiError ? error.message : 'FatePrice history is temporarily unavailable.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const searchCards = useCallback(async (nextQuery: string, nextSetId: string) => {
    const cleanQuery = nextQuery.trim();
    if (cleanQuery.length < 2 && !nextSetId) {
      setSearchNotice('Enter at least two letters or numbers.');
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchNotice('');
    try {
      const response = await searchFatePriceCards({ query: cleanQuery, setId: nextSetId, limit: 60 });
      setResults(response.cards);
      setSearchNotice(response.cards.length ? `${response.count} exact canonical card${response.count === 1 ? '' : 's'} found.` : 'No exact canonical cards matched that search.');
    } catch (error) {
      setResults([]);
      setSearchNotice(error instanceof FateMarketApiError ? error.message : 'Canonical card search is temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  }, []);

  const runSearch = useCallback(() => searchCards(query, setFilterId), [query, searchCards, setFilterId]);

  useEffect(() => {
    let active = true;
    if (routeCardId) {
      setSelectedCardId(routeCardId);
      void Promise.allSettled([fetchFatePriceCard(routeCardId), fetchFatePrice(routeCardId), fetchFatePriceHistory(routeCardId, { days: 30 })]).then(([cardResult, priceResult, historyResult]) => {
        if (!active) return;
        if (cardResult.status === 'fulfilled') setSelectedCard(cardResult.value.card);
        if (priceResult.status === 'fulfilled') setPrice(priceResult.value);
        else setPriceNotice(priceResult.reason instanceof FateMarketApiError ? priceResult.reason.message : 'FatePrice evidence is temporarily unavailable.');
        if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
        else setHistoryNotice(historyResult.reason instanceof FateMarketApiError ? historyResult.reason.message : 'FatePrice history is temporarily unavailable.');
        setPriceLoading(false);
        setHistoryLoading(false);
      });
      setPriceLoading(true);
      setHistoryLoading(true);
    } else if (routeSetId) {
      void searchCards('', routeSetId);
    } else if (routeQuery || routeName) {
      void searchCards(routeQuery || routeName, '');
    }
    return () => { active = false; };
  }, [routeCardId, routeName, routeQuery, routeSetId, searchCards]);

  const selectCard = useCallback((card: FatePriceCard) => {
    setSelectedCard(card);
    setSelectedCardId(card.id);
    setQuery(card.name || card.collectorNumber || '');
    setResults([]);
    setSearchNotice('');
    setPrice(null);
    setHistory(null);
    setHistoryNotice('');
    void Promise.all([loadPrice(card.id), loadHistory(card.id, null, historyDays)]);
  }, [historyDays, loadHistory, loadPrice]);

  const chooseHistoryDays = useCallback((days: FatePriceHistoryDays) => {
    setHistoryDays(days);
    if (selectedCardId) void loadHistory(selectedCardId, price?.marketScope ?? null, days);
  }, [loadHistory, price?.marketScope, selectedCardId]);

  const selectedTitle = selectedCard?.name || (selectedCardId === routeCardId ? routeName : '') || 'Exact canonical card';
  const selectedSet = selectedCard?.setName || (selectedCardId === routeCardId ? routeSetName : '') || 'Verified identity';
  const selectedNumber = selectedCard?.collectorNumber || (selectedCardId === routeCardId ? routeCollectorNumber : '');
  const selectedPrintingId = selectedCard?.printingId || routePrintingId;
  const status = priceLoading ? 'READING CLOUD' : price?.available ? 'EVIDENCE LIVE' : selectedCardId ? 'EVIDENCE GATED' : 'CHOOSE A CARD';
  const currency = price?.price?.currencyCode || price?.marketScope?.currencyCode || price?.evidence.availableScopes[0]?.currencyCode || 'EUR';
  const scopeOptions = price?.evidence.availableScopes ?? [];
  const currentScopeKey = price?.marketScope ? scopeKey(price.marketScope) : '';
  const titleDetail = useMemo(() => {
    if (!selectedCardId) return null;
    const parts = [selectedSet, selectedNumber ? `#${selectedNumber}` : null, selectedCard?.variantCode && selectedCard.variantCode !== 'standard' ? selectedCard.variantCode.replaceAll('-', ' ') : null];
    return parts.filter(Boolean).join(' · ');
  }, [selectedCard?.variantCode, selectedCardId, selectedNumber, selectedSet]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FatePriceScreenBackground sceneKey={`detail:${selectedCardId || 'unselected'}`} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={priceLoading || historyLoading} onRefresh={() => selectedCardId ? void Promise.all([loadPrice(selectedCardId, price?.marketScope ?? null, true), loadHistory(selectedCardId, price?.marketScope ?? null, historyDays, true)]) : undefined} tintColor={FateDropColors.goldBright} />}
      >
        <FatePriceTopBar step={4} backLabel="Variants" />

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>FATEPRICE</Text>
            <Text style={styles.title}>The exact card. The evidence behind its value.</Text>
            <Text style={styles.copy}>One canonical identity, one explicit market scope, and only the movement Cloud can prove.</Text>
          </View>
          <View style={styles.marketMark}>
            <View style={styles.marketMarkOuter} />
            <View style={styles.marketMarkInner} />
            {priceLoading ? <ActivityIndicator color={FateDropColors.goldBright} /> : <Image source={require('../assets/images/home-orbital-crystal.png')} style={styles.marketMarkCrystal} contentFit="contain" cachePolicy="memory-disk" />}
          </View>
        </View>

        <MarketConstellation />

        {!selectedCardId ? <View style={styles.searchPanel}>
          <View style={styles.searchHeading}>
            <View style={styles.flex}>
              <Text style={styles.sectionEyebrow}>EXACT CARD IDENTITY</Text>
              <Text style={styles.searchTitle}>{setFilterId ? `Choose a card from ${routeSetName || 'this set'}` : 'Find a card by name or number'}</Text>
            </View>
            {setFilterId ? <Pressable accessibilityLabel="Clear set filter" onPress={() => { setSetFilterId(''); setResults([]); setSearchNotice(''); }} style={styles.clearFilter}><Ionicons name="close" size={14} color={FateDropColors.goldBright} /></Pressable> : null}
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={FateDropColors.goldBright} />
            <TextInput
              accessibilityLabel="Search exact cards"
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch()}
              placeholder={setFilterId ? 'Filter this set' : 'e.g. Charizard or 194'}
              placeholderTextColor={FateDropColors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            <Pressable accessibilityLabel="Search cards" disabled={searching} onPress={() => void runSearch()} style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}>
              {searching ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : <Ionicons name="arrow-forward" size={17} color={FateDropColors.goldBright} />}
            </Pressable>
          </View>
          {searchNotice ? <Text style={styles.searchNotice}>{searchNotice}</Text> : null}
          {results.length ? <View style={styles.results}>{results.map((card) => (
            <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`Read FatePrice for ${cardLabel(card)}`} onPress={() => selectCard(card)} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
              <View style={styles.resultGem}><Ionicons name="diamond-outline" size={15} color={FateDropColors.goldBright} /></View>
              <View style={styles.flex}><Text style={styles.resultName}>{cardLabel(card)}</Text><Text style={styles.resultMeta}>{card.setName || 'Verified set'} · {card.languageCode.toUpperCase()}</Text></View>
              <Ionicons name="chevron-forward" size={15} color={FateDropColors.muted} />
            </Pressable>
          ))}</View> : null}
        </View> : null}

        {selectedCardId ? <View style={styles.identityStrip}>
          <FatePriceCardGlyph collectorNumber={selectedNumber} />
          <View style={styles.flex}><Text style={styles.identityStripEyebrow}>EXACT CANONICAL IDENTITY</Text><Text style={styles.identityStripTitle}>{selectedTitle}</Text><Text style={styles.identityStripMeta}>{titleDetail || selectedSet}</Text></View>
          <View style={styles.identityVerified}><Ionicons name="shield-checkmark" size={13} color={FateDropColors.manifested} /><Text style={styles.identityVerifiedText}>VERIFIED</Text></View>
        </View> : null}

        <View style={styles.pricePanel}>
          <View style={styles.panelHeading}>
            <View style={styles.flex}><Text style={styles.sectionEyebrow}>CANONICAL FATEPRICE</Text><Text style={styles.panelTitle}>{selectedTitle}</Text>{titleDetail ? <Text style={styles.identityMeta}>{titleDetail}</Text> : null}</View>
            <View style={styles.statusPill}><Text style={styles.statusText}>{status}</Text></View>
          </View>

          <View style={styles.valueInstrument}>
            <View style={styles.valueOrbit} />
            <Ionicons name="pricetag-outline" size={22} color={FateDropColors.goldBright} />
            <Text style={styles.valueLabel}>EXACT-CARD VALUE</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.valueMain}>{formatMoney(price?.price?.amount, currency)}</Text>
            <Text style={styles.valueSub}>{price?.available ? `${scopeLabel(price.marketScope!)} · as of ${formatDate(price.price?.asOf)}` : priceNotice || evidenceReason(price?.reason)}</Text>
          </View>

          <View style={styles.metricLedger}>
            <PriceMetric accent={movementAccent(price?.movement.d7)} detail={price?.movement.d7.available ? 'Verified history' : 'Not available'} label="7D MOVE" value={movementText(price?.movement.d7)} />
            <View style={styles.ledgerDivider} />
            <PriceMetric accent={movementAccent(price?.movement.d30)} detail={price?.movement.d30.available ? 'Verified history' : 'Not available'} label="30D MOVE" value={movementText(price?.movement.d30)} />
            <View style={styles.ledgerDivider} />
            <PriceMetric accent={FateDropColors.echo} detail={price?.confidence ? `${price.confidence.sourceCount} source${price.confidence.sourceCount === 1 ? '' : 's'}` : 'Not scored'} label="CONFIDENCE" value={price?.confidence?.level.toUpperCase() || '—'} />
          </View>

          {selectedCardId ? <View style={styles.journeyActions}>
            <Pressable
              accessibilityRole="button"
              disabled={!selectedPrintingId || (!routeSetId && !selectedCard?.setId)}
              onPress={() => router.push({
                pathname: '/fate-price-variants',
                params: {
                  collectorNumber: selectedNumber,
                  name: selectedTitle,
                  printingId: selectedPrintingId,
                  setId: selectedCard?.setId || routeSetId,
                  setName: selectedSet,
                  tcg: selectedCard?.tcgCode || first(params.tcg) || '',
                },
              })}
              style={({ pressed }) => [styles.journeyAction, pressed && styles.pressed]}
            >
              <Ionicons name="layers-outline" size={17} color={FateDropColors.goldBright} />
              <View style={styles.flex}><Text style={styles.journeyActionLabel}>VARIANTS</Text><Text style={styles.journeyActionTitle}>Check another printing</Text></View>
              <Ionicons name="chevron-forward" size={16} color={FateDropColors.goldBright} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/fate-price-buy', params: { cardId: selectedCardId, collectorNumber: selectedNumber, name: selectedTitle, setName: selectedSet } })}
              style={({ pressed }) => [styles.journeyAction, styles.journeyActionPrimary, pressed && styles.pressed]}
            >
              <Ionicons name="storefront-outline" size={17} color={FateDropColors.ivory} />
              <View style={styles.flex}><Text style={styles.journeyActionLabel}>RETAILER NETWORK</Text><Text style={styles.journeyActionTitle}>Where to buy</Text></View>
              <Ionicons name="arrow-forward" size={16} color={FateDropColors.goldBright} />
            </Pressable>
          </View> : null}

          {selectedCardId ? <AddToFateCollectorAction cardIdentityId={selectedCardId} setName={selectedSet} /> : null}
          {selectedCardId ? <HistoryPanel currencyCode={currency} days={historyDays} history={history} loading={historyLoading} notice={historyNotice} onChooseDays={chooseHistoryDays} /> : null}

          {scopeOptions.length ? (
            <View style={styles.scopeSection}>
              <Text style={styles.scopeTitle}>{scopeOptions.length > 1 ? 'CHOOSE EXACT MARKET SCOPE' : 'VERIFIED MARKET SCOPE'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRail}>
                {scopeOptions.map((scope) => {
                  const selected = currentScopeKey === scopeKey(scope);
                  return <Pressable key={scopeKey(scope)} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => void Promise.all([loadPrice(selectedCardId, scope), loadHistory(selectedCardId, scope, historyDays)])} style={[styles.scopeButton, selected && styles.scopeButtonActive]}><View style={[styles.scopeDot, selected && styles.scopeDotActive]} /><Text style={[styles.scopeButtonText, selected && styles.scopeButtonTextActive]}>{scopeLabel(scope).toUpperCase()}</Text></Pressable>;
                })}
              </ScrollView>
            </View>
          ) : null}

          {price?.available && price.price ? (
            <View style={styles.evidencePanel}>
              <Text style={styles.sectionEyebrow}>PRICE EVIDENCE</Text>
              <View style={styles.evidenceRows}>
                <EvidenceRow label="Fair range" value={`${formatMoney(price.price.fairLow, currency)} – ${formatMoney(price.price.fairHigh, currency)}`} />
                <EvidenceRow label="Lowest guide" value={formatMoney(price.price.guideLow, currency)} />
                <EvidenceRow label="Sources" value={price.evidence.sources.length ? price.evidence.sources.join(' · ') : 'Not published'} />
                <EvidenceRow label="Evidence age" value={price.confidence ? `${price.confidence.ageHours} hours` : 'Unknown'} />
              </View>
              <View style={styles.truthLine}><Ionicons name="shield-checkmark-outline" size={16} color={FateDropColors.goldBright} /><Text style={styles.truthCopy}>The central FatePrice uses verified market, trend, 7D and 30D guide signals. Lowest listing is shown only as context and never drives the central value.</Text></View>
            </View>
          ) : null}

          {!selectedCardId ? <View style={styles.emptyState}><Ionicons name="finger-print-outline" size={24} color={FateDropColors.goldBright} /><Text style={styles.emptyTitle}>Start with an exact card.</Text><Text style={styles.emptyCopy}>Names, numbers, printings and variants stay distinct. FatePrice will not blend similar cards into one convenient-looking number.</Text></View> : null}
        </View>

        <View style={styles.bridgePanel}>
          <Text style={styles.sectionEyebrow}>ONE MARKET · THREE VIEWS</Text>
          <Text style={styles.bridgeTitle}>Put this value in context.</Text>
          <Text style={styles.bridgeCopy}>FatePulse explains wider movement. Fate Collections shows what verified prices mean across your own cards and binders.</Text>
          <View style={styles.bridgeActions}>
            <BridgeAction accent={FateDropColors.manifested} icon="pulse-outline" label="OPEN FATEPULSE" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} />
            <BridgeAction accent={FateDropColors.echo} icon="albums-outline" label="OPEN COLLECTIONS" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'collectors' } })} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketConstellation() {
  return <View accessibilityRole="tablist" style={styles.areaRail}>
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} style={styles.areaTab}><Ionicons name="pulse-outline" size={16} color={FateDropColors.muted} /><Text style={styles.areaTitle}>FatePulse</Text></Pressable>
    <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.areaTab, styles.areaTabActive]}><Ionicons name="pricetag-outline" size={16} color={FateDropColors.goldBright} /><Text style={[styles.areaTitle, { color: FateDropColors.goldBright }]}>FatePrice</Text><View style={styles.areaActiveGem} /></View>
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'collectors' } })} style={styles.areaTab}><Ionicons name="albums-outline" size={16} color={FateDropColors.muted} /><Text style={styles.areaTitle}>Collections</Text></Pressable>
  </View>;
}

function PriceMetric({ accent, detail, label, value }: { accent: string; detail: string; label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: accent }]}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

function HistoryPanel({
  currencyCode,
  days,
  history,
  loading,
  notice,
  onChooseDays,
}: {
  currencyCode: string;
  days: FatePriceHistoryDays;
  history: FatePriceHistorySnapshot | null;
  loading: boolean;
  notice: string;
  onChooseDays: (days: FatePriceHistoryDays) => void;
}) {
  const points = history?.available ? history.points : [];
  const amounts = points.map((point) => point.amount);
  const low = amounts.length ? Math.min(...amounts) : null;
  const high = amounts.length ? Math.max(...amounts) : null;
  const spread = low != null && high != null ? high - low : 0;

  return <View style={styles.historyPanel}>
    <View style={styles.historyHeading}>
      <View style={styles.flex}><Text style={styles.sectionEyebrow}>VERIFIED PRICE HISTORY</Text><Text style={styles.historyCopy}>Cloud-calculated FatePrice on stored market days only. Missing days are never filled.</Text></View>
      {loading ? <ActivityIndicator size="small" color={FateDropColors.goldBright} /> : null}
    </View>
    <View accessibilityRole="tablist" style={styles.historyWindowRail}>
      {([7, 30, 90] as FatePriceHistoryDays[]).map((window) => <Pressable key={window} accessibilityRole="tab" accessibilityState={{ selected: days === window }} onPress={() => onChooseDays(window)} style={[styles.historyWindow, days === window && styles.historyWindowActive]}><Text style={[styles.historyWindowText, days === window && styles.historyWindowTextActive]}>{window}D</Text></Pressable>)}
    </View>
    {points.length ? <>
      <View style={styles.historyRange}><Text style={styles.historyRangeText}>{formatMoney(high, currencyCode)}</Text><Text style={styles.historyPointCount}>{points.length} stored day{points.length === 1 ? '' : 's'}</Text></View>
      <View style={styles.historyPlot}>
        {points.map((point) => {
          const stemHeight = spread > 0 && low != null ? 14 + (((point.amount - low) / spread) * 72) : 50;
          return <View key={`${point.marketDay}:${point.asOf}`} accessibilityLabel={`${point.marketDay}, ${formatMoney(point.amount, point.currencyCode)}, ${point.confidence} confidence`} style={styles.historyColumn}><View style={[styles.historyStem, { height: stemHeight }]}><View style={styles.historyDot} /></View></View>;
        })}
      </View>
      <View style={styles.historyAxis}><Text style={styles.historyAxisText}>{points[0]?.marketDay}</Text><Text style={styles.historyRangeText}>{formatMoney(low, currencyCode)}</Text><Text style={styles.historyAxisText}>{points.at(-1)?.marketDay}</Text></View>
    </> : <View style={styles.historyEmpty}><Ionicons name="analytics-outline" size={18} color={FateDropColors.muted} /><Text style={styles.historyEmptyText}>{notice || evidenceReason(history?.reason)}</Text></View>}
  </View>;
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.evidenceRow}><Text style={styles.evidenceLabel}>{label}</Text><Text style={styles.evidenceValue}>{value}</Text></View>;
}

function BridgeAction({ accent, icon, label, onPress }: { accent: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.bridgeAction, { borderColor: `${accent}58` }, pressed && styles.pressed]}><Ionicons name={icon} size={16} color={accent} /><Text style={[styles.bridgeActionText, { color: accent }]}>{label}</Text><Ionicons name="arrow-forward" size={14} color={accent} /></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  themeVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,5,14,.47)' },
  themeLowerVeil: { position: 'absolute', left: 0, right: 0, top: '34%', bottom: 0, backgroundColor: 'rgba(3,7,18,.61)' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 124 },
  flex: { flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  back: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -7, paddingHorizontal: 7 },
  backText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '800', letterSpacing: .5 },
  hero: { minHeight: 136, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCopy: { flex: 1 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.65 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 28, lineHeight: 33, marginTop: 7, textShadowColor: 'rgba(0,0,0,.94)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 7, maxWidth: 300 },
  marketMark: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  marketMarkOuter: { position: 'absolute', width: 66, height: 66, borderRadius: 33, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.66)' },
  marketMarkInner: { position: 'absolute', width: 51, height: 51, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.62)' },
  marketMarkCrystal: { width: 58, height: 58 },
  areaRail: { height: 50, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)', backgroundColor: 'rgba(3,8,20,.18)' },
  areaTab: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.16)' },
  areaTabActive: { backgroundColor: 'rgba(226,197,141,.07)' },
  areaTitle: { color: FateDropColors.muted, fontFamily: Fonts.serif, fontSize: 10.5 },
  areaActiveGem: { position: 'absolute', width: 5, height: 5, bottom: -3, transform: [{ rotate: '45deg' }], backgroundColor: FateDropColors.goldBright },
  searchPanel: { marginTop: 17, paddingHorizontal: 8, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.32)', backgroundColor: 'rgba(3,8,20,.25)' },
  searchHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  searchTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16, marginTop: 3 },
  clearFilter: { width: 31, height: 31, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.44)', alignItems: 'center', justifyContent: 'center' },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, paddingLeft: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.42)', borderRadius: 4, backgroundColor: 'rgba(3,8,20,.52)' },
  searchInput: { flex: 1, minWidth: 0, color: FateDropColors.ivory, fontSize: 12, paddingVertical: 12 },
  searchAction: { width: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(226,197,141,.30)' },
  searchNotice: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, marginTop: 8 },
  results: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.22)' },
  resultRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.18)' },
  resultGem: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.35)' },
  resultName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 12.5 },
  resultMeta: { color: FateDropColors.muted, fontSize: 7, marginTop: 3 },
  identityStrip: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 15, padding: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.43)', borderRadius: 15, backgroundColor: 'rgba(4,9,22,.82)' },
  identityStripEyebrow: { color: FateDropColors.goldBright, fontSize: 6.5, fontWeight: '900', letterSpacing: .7 },
  identityStripTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 4 },
  identityStripMeta: { color: FateDropColors.secondary, fontSize: 7.5, lineHeight: 11, marginTop: 4, textTransform: 'capitalize' },
  identityVerified: { alignItems: 'center', gap: 4 },
  identityVerifiedText: { color: FateDropColors.manifested, fontSize: 5.3, fontWeight: '900', letterSpacing: .5 },
  pricePanel: { marginTop: 21 },
  panelHeading: { minHeight: 57, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 5 },
  panelTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19, lineHeight: 23, marginTop: 3 },
  identityMeta: { color: FateDropColors.muted, fontSize: 7.5, marginTop: 3, textTransform: 'capitalize' },
  statusPill: { maxWidth: 112, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(3,8,20,.42)' },
  statusText: { color: FateDropColors.goldBright, fontSize: 6.3, fontWeight: '900', letterSpacing: .55, textAlign: 'center' },
  valueInstrument: { minHeight: 232, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  valueOrbit: { position: 'absolute', width: 208, height: 208, borderRadius: 104, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.48)' },
  valueLabel: { color: FateDropColors.gold, fontSize: 6.8, fontWeight: '900', letterSpacing: .8, marginTop: 8 },
  valueMain: { maxWidth: 190, color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 37, lineHeight: 44, marginTop: 2 },
  valueSub: { maxWidth: 240, color: FateDropColors.secondary, fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 3 },
  metricLedger: { minHeight: 72, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.27)' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  metricLabel: { color: FateDropColors.muted, fontSize: 6.2, fontWeight: '900', letterSpacing: .5, textAlign: 'center' },
  metricValue: { maxWidth: '100%', fontFamily: Fonts.serif, fontSize: 17, marginTop: 2, textAlign: 'center' },
  metricDetail: { color: FateDropColors.muted, fontSize: 5.9, marginTop: 2, textAlign: 'center' },
  ledgerDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(226,197,141,.20)' },
  journeyActions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  journeyAction: { flex: 1, minWidth: 0, minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.37)', borderRadius: 12, backgroundColor: 'rgba(4,9,22,.78)' },
  journeyActionPrimary: { borderColor: 'rgba(124,110,255,.68)', backgroundColor: 'rgba(124,110,255,.14)' },
  journeyActionLabel: { color: FateDropColors.goldBright, fontSize: 5.2, fontWeight: '900', letterSpacing: .5 },
  journeyActionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 10.5, marginTop: 3 },
  historyPanel: { marginTop: 14, paddingHorizontal: 8, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.34)', backgroundColor: 'rgba(3,8,20,.28)' },
  historyHeading: { minHeight: 34, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyCopy: { color: FateDropColors.secondary, fontSize: 7.5, lineHeight: 11, marginTop: 4 },
  historyWindowRail: { alignSelf: 'flex-start', flexDirection: 'row', marginTop: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.26)' },
  historyWindow: { minWidth: 44, minHeight: 29, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(226,197,141,.20)' },
  historyWindowActive: { backgroundColor: 'rgba(226,197,141,.11)' },
  historyWindowText: { color: FateDropColors.muted, fontSize: 6.8, fontWeight: '900', letterSpacing: .5 },
  historyWindowTextActive: { color: FateDropColors.goldBright },
  historyRange: { minHeight: 25, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 7 },
  historyRangeText: { color: FateDropColors.muted, fontSize: 6.4 },
  historyPointCount: { color: FateDropColors.gold, fontSize: 6.2, fontWeight: '800', letterSpacing: .35 },
  historyPlot: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.28)' },
  historyColumn: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  historyStem: { width: 1, minHeight: 8, backgroundColor: 'rgba(124,110,255,.78)' },
  historyDot: { position: 'absolute', top: -2, left: -2, width: 5, height: 5, borderRadius: 3, backgroundColor: FateDropColors.goldBright },
  historyAxis: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyAxisText: { color: FateDropColors.muted, fontSize: 5.8 },
  historyEmpty: { minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 22 },
  historyEmptyText: { color: FateDropColors.muted, fontSize: 7.4, lineHeight: 11, textAlign: 'center' },
  scopeSection: { paddingHorizontal: 5, paddingTop: 14 },
  scopeTitle: { color: FateDropColors.gold, fontSize: 6.4, fontWeight: '900', letterSpacing: .7 },
  scopeRail: { gap: 8, paddingVertical: 9, paddingRight: 18 },
  scopeButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.28)', backgroundColor: 'rgba(3,8,20,.38)' },
  scopeButtonActive: { borderColor: 'rgba(226,197,141,.74)', backgroundColor: 'rgba(226,197,141,.08)' },
  scopeDot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: FateDropColors.muted },
  scopeDotActive: { borderColor: FateDropColors.goldBright, backgroundColor: FateDropColors.goldBright },
  scopeButtonText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .45 },
  scopeButtonTextActive: { color: FateDropColors.ivory },
  evidencePanel: { marginTop: 12, paddingHorizontal: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.27)' },
  evidenceRows: { marginTop: 8 },
  evidenceRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.15)' },
  evidenceLabel: { color: FateDropColors.muted, fontSize: 7.5, fontWeight: '800' },
  evidenceValue: { flex: 1, color: FateDropColors.ivory, fontSize: 8.5, textAlign: 'right', textTransform: 'capitalize' },
  truthLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 13 },
  truthCopy: { flex: 1, color: FateDropColors.secondary, fontSize: 8.2, lineHeight: 13 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 28 },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17, marginTop: 8 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 6, textAlign: 'center' },
  bridgePanel: { marginTop: 24, paddingHorizontal: 7, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.30)' },
  bridgeTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, marginTop: 4 },
  bridgeCopy: { color: FateDropColors.secondary, fontSize: 8.5, lineHeight: 13, marginTop: 5 },
  bridgeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  bridgeAction: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(3,8,20,.34)' },
  bridgeActionText: { fontSize: 6.5, fontWeight: '900', letterSpacing: .45 },
});
