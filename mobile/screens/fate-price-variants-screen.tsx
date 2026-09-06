import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FatePriceCardGlyph, FatePriceScreenBackground, FatePriceTopBar, FatePriceTruth } from '@/components/fate-price-chrome';
import { FateDropColors, Fonts } from '@/constants/theme';
import { FateMarketApiError, fetchFatePriceSetCards, type FatePriceCard } from '@/services/fate-market';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pretty(value: string | null | undefined) {
  const clean = String(value || '').trim();
  if (!clean) return 'Unknown';
  if (clean === 'standard') return 'Standard';
  return clean.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function FatePriceVariantsScreen() {
  const params = useLocalSearchParams<{
    collectorNumber?: string | string[];
    finish?: string | string[];
    language?: string | string[];
    name?: string | string[];
    printingId?: string | string[];
    setId?: string | string[];
    setName?: string | string[];
    tcg?: string | string[];
  }>();
  const setId = first(params.setId)?.trim() || '';
  const printingId = first(params.printingId)?.trim() || '';
  const routeName = first(params.name)?.trim() || 'Exact card';
  const routeNumber = first(params.collectorNumber)?.trim() || '';
  const setName = first(params.setName)?.trim() || 'Verified set';
  const tcg = first(params.tcg)?.trim() || 'pokemon';
  const preferredFinish = first(params.finish)?.trim() || '';
  const preferredLanguage = first(params.language)?.trim() || '';
  const [variants, setVariants] = useState<FatePriceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!setId || !printingId) {
      setNotice('A verified set and printing identity are required.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      const response = await fetchFatePriceSetCards(setId, { languageCode: '', variantCode: '', limit: 500 });
      const matches = response.cards
        .filter((card) => card.printingId === printingId)
        .sort((left, right) => {
          const leftPreferred = Number(left.variantCode === preferredFinish) + Number(left.languageCode === preferredLanguage);
          const rightPreferred = Number(right.variantCode === preferredFinish) + Number(right.languageCode === preferredLanguage);
          return rightPreferred - leftPreferred || left.variantCode.localeCompare(right.variantCode) || left.languageCode.localeCompare(right.languageCode);
        });
      setVariants(matches);
      if (!matches.length) setNotice('No verified variants are published for this printing yet.');
    } catch (error) {
      setVariants([]);
      setNotice(error instanceof FateMarketApiError ? error.message : 'Exact variants are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [preferredFinish, preferredLanguage, printingId, setId]);

  useEffect(() => {
    void load();
  }, [load]);

  const anchor = variants[0] || null;
  const title = anchor?.name || routeName;
  const collectorNumber = anchor?.collectorNumber || routeNumber;
  const finishCount = useMemo(() => new Set(variants.map((card) => card.variantCode)).size, [variants]);
  const languageCount = useMemo(() => new Set(variants.map((card) => card.languageCode)).size, [variants]);

  const openExact = useCallback((card: FatePriceCard) => {
    router.push({
      pathname: '/fate-price',
      params: {
        cardId: card.id,
        collectorNumber: card.collectorNumber,
        name: card.name || '',
        printingId: card.printingId,
        setId: card.setId,
        setName: card.setName || setName,
        tcg: card.tcgCode || tcg,
      },
    });
  }, [setName, tcg]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FatePriceScreenBackground sceneKey={`variants:${printingId}`} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FatePriceTopBar step={3} backLabel={setName} />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FATEPRICE · EXACT IDENTITY</Text>
        <Text style={styles.title}>Variants & printings.</Text>
        <Text style={styles.subtitle}>Make sure it’s the right one.</Text>
        <Text style={styles.copy}>Choose the finish and language printed on the card. Rarity is shown beside them, but never used as a substitute for finish.</Text>
      </View>

      <View style={styles.identityPanel}>
        <FatePriceCardGlyph collectorNumber={collectorNumber} large />
        <View style={styles.identityCopy}>
          <Text style={styles.identityName}>{title}</Text>
          <Text style={styles.identitySet}>{setName}</Text>
          <Text style={styles.identityNumber}>#{collectorNumber || '—'}</Text>
          <View style={styles.identityStats}>
            <MiniStat label="FINISHES" value={finishCount} />
            <View style={styles.statDivider} />
            <MiniStat label="LANGUAGES" value={languageCount} />
            <View style={styles.statDivider} />
            <MiniStat label="IDENTITIES" value={variants.length} />
          </View>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionEyebrow}>CHOOSE THE EXACT CARD</Text><Text style={styles.sectionTitle}>{variants.length} verified {variants.length === 1 ? 'identity' : 'identities'}</Text></View>
        <Ionicons name="git-branch-outline" size={21} color={FateDropColors.goldBright} />
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={FateDropColors.goldBright} /><Text style={styles.loadingText}>Resolving verified variants…</Text></View> : null}
      {!loading && notice ? <View style={styles.empty}><Ionicons name="diamond-outline" size={28} color={FateDropColors.goldBright} /><Text style={styles.emptyTitle}>No exact path yet.</Text><Text style={styles.emptyCopy}>{notice}</Text></View> : null}
      {!loading && !notice ? <View style={styles.variantStack}>{variants.map((card, index) => <Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`Open FatePrice for ${title}, ${pretty(card.variantCode)}, ${card.languageCode.toUpperCase()}`} onPress={() => openExact(card)} style={({ pressed }) => [styles.variantCard, index === 0 && styles.variantCardFirst, pressed && styles.pressed]}>
        <View style={styles.variantIndex}><Text style={styles.variantIndexText}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.variantLine} /></View>
        <View style={styles.variantMain}>
          <View style={styles.variantTop}><Text style={styles.variantFinish}>{pretty(card.variantCode)}</Text><View style={styles.verified}><Ionicons name="shield-checkmark" size={11} color={FateDropColors.manifested} /><Text style={styles.verifiedText}>EXACT</Text></View></View>
          <View style={styles.fieldGrid}>
            <Field label="FINISH" value={pretty(card.variantCode)} />
            <Field label="RARITY" value={card.rarity || 'Not supplied'} />
            <Field label="LANGUAGE" value={card.languageCode.toUpperCase()} />
            <Field label="CARD NUMBER" value={`#${card.collectorNumber}`} />
          </View>
          <View style={styles.readRow}><Text style={styles.readText}>READ EXACT FATEPRICE</Text><Ionicons name="arrow-forward" size={16} color={FateDropColors.goldBright} /></View>
        </View>
      </Pressable>)}</View> : null}

      <FatePriceTruth title="One choice, one market scope.">FatePrice values the selected canonical identity only. If verified evidence is missing or ambiguous, the value stays unknown rather than borrowing a neighbour’s price.</FatePriceTruth>
    </ScrollView>
  </SafeAreaView>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <View style={styles.miniStat}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text numberOfLines={1} style={styles.fieldValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030713' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 7, paddingBottom: 126 },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  hero: { minHeight: 196, justifyContent: 'center', paddingRight: '30%', paddingVertical: 12 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.45 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 32, lineHeight: 36, marginTop: 8, textShadowColor: 'rgba(0,0,0,.95)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
  subtitle: { color: FateDropColors.goldBright, fontFamily: Fonts.serif, fontSize: 18, marginTop: 2 },
  copy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, marginTop: 9 },
  identityPanel: { minHeight: 190, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.52)', borderRadius: 17, backgroundColor: 'rgba(4,9,22,.84)' },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 23, lineHeight: 27 },
  identitySet: { color: FateDropColors.secondary, fontSize: 10, marginTop: 5 },
  identityNumber: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '800', marginTop: 4 },
  identityStats: { height: 49, flexDirection: 'row', alignItems: 'center', marginTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(226,197,141,.22)' },
  miniStat: { flex: 1, minWidth: 0, alignItems: 'center' },
  miniValue: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 17 },
  miniLabel: { color: FateDropColors.muted, fontSize: 5.3, fontWeight: '900', letterSpacing: .45, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 25, backgroundColor: 'rgba(226,197,141,.3)' },
  sectionHeading: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.24)' },
  sectionEyebrow: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.15 },
  sectionTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19, marginTop: 4 },
  loading: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: FateDropColors.muted, fontSize: 9 },
  empty: { minHeight: 230, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.27)', borderRadius: 15 },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18, marginTop: 9 },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 6 },
  variantStack: { gap: 10, marginTop: 12 },
  variantCard: { minHeight: 190, flexDirection: 'row', gap: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(226,197,141,.34)', borderRadius: 15, backgroundColor: 'rgba(4,9,22,.84)' },
  variantCardFirst: { borderColor: 'rgba(226,197,141,.62)', shadowColor: FateDropColors.violet, shadowOpacity: .2, shadowRadius: 8 },
  variantIndex: { width: 25, alignItems: 'center' },
  variantIndexText: { color: 'rgba(226,197,141,.52)', fontFamily: Fonts.serif, fontSize: 15 },
  variantLine: { flex: 1, width: StyleSheet.hairlineWidth, marginTop: 7, backgroundColor: 'rgba(226,197,141,.23)' },
  variantMain: { flex: 1 },
  variantTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  variantFinish: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 19 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,110,255,.45)', borderRadius: 999 },
  verifiedText: { color: FateDropColors.manifested, fontSize: 5.5, fontWeight: '900', letterSpacing: .55 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  field: { width: '48%', minHeight: 46, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(226,197,141,.17)' },
  fieldLabel: { color: FateDropColors.muted, fontSize: 5.8, fontWeight: '900', letterSpacing: .65 },
  fieldValue: { color: FateDropColors.secondary, fontSize: 9, marginTop: 4 },
  readRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  readText: { color: FateDropColors.goldBright, fontSize: 7, fontWeight: '900', letterSpacing: .75 },
});
