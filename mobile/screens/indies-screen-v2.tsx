import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { retailerHeroUri } from '@/constants/retailer-hero';
import { FateDropColors, Fonts } from '@/constants/theme';
import { fetchRetailerDirectory, type NetworkRetailer } from '@/services/retailer-directory';

type RetailerView = 'all' | 'major' | 'specialist' | 'local';

function hasRetailerStorefront(retailer: NetworkRetailer) {
  return retailer.retailerClass !== 'event_vendor';
}

function normalizedView(value?: string): RetailerView {
  if (value === 'major' || value === 'specialist' || value === 'local') return value;
  return 'all';
}

function matchesView(retailer: NetworkRetailer, view: RetailerView) {
  if (view === 'major') return retailer.retailerClass === 'national';
  if (view === 'specialist') return retailer.retailerClass === 'specialist';
  if (view === 'local') return ['independent', 'regional'].includes(retailer.retailerClass);
  return true;
}

function classLabel(value: string) {
  if (value === 'national') return 'Major retailer';
  if (value === 'independent') return 'Independent & local';
  if (value === 'specialist') return 'TCG specialist';
  if (value === 'regional') return 'Independent & local';
  return value.replaceAll('_', ' ');
}

function classTone(value: string) {
  if (value === 'independent' || value === 'regional') return FateDropColors.cyan;
  if (value === 'national') return FateDropColors.violetLight;
  return '#B58CFF';
}

function tcgLabel(value: string) {
  const key = value.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
  if (key === 'pokemon') return 'Pokémon';
  if (key === 'one piece') return 'One Piece';
  if (['mtg', 'magic', 'magic the gathering'].includes(key)) return 'Magic';
  if (key === 'lorcana') return 'Lorcana';
  if (key === 'yu gi oh' || key === 'yugioh') return 'Yu-Gi-Oh!';
  return key.split(/\s+/).filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function presenceLabel(retailer: NetworkRetailer) {
  if (retailer.online && retailer.physicalStores === true) return 'Online · Physical stores';
  if (retailer.physicalStores === true) return 'Physical stores';
  if (retailer.online && retailer.physicalStores === false) return 'Online';
  if (retailer.online) return 'Online · Physical status unknown';
  return 'Retail presence unknown';
}

function presenceIcon(retailer: NetworkRetailer): keyof typeof Ionicons.glyphMap {
  if (retailer.physicalStores === true) return 'storefront-outline';
  if (retailer.online) return 'globe-outline';
  return 'help-circle-outline';
}

function retailerSearchText(retailer: NetworkRetailer) {
  return `${retailer.name} ${retailer.tcgs.join(' ')} ${classLabel(retailer.retailerClass)}`.toLowerCase();
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && styles.pressed]}>
    <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={2}>{label}</Text>
  </Pressable>;
}

function TcgChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.tcgFilter, active && styles.tcgFilterActive, pressed && styles.pressed]}>
    <Ionicons name="layers-outline" size={13} color={active ? FateDropColors.goldBright : FateDropColors.secondary} />
    <Text style={[styles.tcgFilterText, active && styles.tcgFilterTextActive]}>{label}</Text>
  </Pressable>;
}

function RetailerCard({ retailer }: { retailer: NetworkRetailer }) {
  const visibleTcgs = retailer.tcgs.slice(0, 3);
  const hiddenCount = Math.max(0, retailer.tcgs.length - visibleTcgs.length);
  const tone = classTone(retailer.retailerClass);

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Open ${retailer.name} retailer storefront`}
    onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: retailer.id } })}
    style={({ pressed }) => [styles.retailerCard, pressed && styles.pressed]}
  >
    <View style={styles.logoTile}>
      <Text style={styles.logoInitials}>{retailer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text>
    </View>

    <View style={styles.retailerBody}>
      <View style={styles.nameRow}>
        <Text style={styles.retailerName} numberOfLines={1}>{retailer.name}</Text>
        {String(retailer.verification || '').toLowerCase() === 'verified' ? <Ionicons name="checkmark-circle" size={15} color={FateDropColors.mint} /> : null}
      </View>
      <Text style={[styles.retailerClass, { color: tone }]}>{classLabel(retailer.retailerClass).toUpperCase()}</Text>
      <View style={styles.presenceRow}>
        <Ionicons name={presenceIcon(retailer)} size={13} color={FateDropColors.secondary} />
        <Text style={styles.presence}>{presenceLabel(retailer)}</Text>
      </View>
    </View>

    <View style={styles.retailerRight}>
      {visibleTcgs.length ? <View style={styles.cardTcgRow}>
        {visibleTcgs.map((tcg) => <View key={tcg} style={styles.cardTcgBadge}><Text style={styles.cardTcgText}>{tcgLabel(tcg)}</Text></View>)}
        {hiddenCount > 0 ? <View style={styles.cardTcgBadge}><Text style={styles.cardTcgText}>+{hiddenCount}</Text></View> : null}
      </View> : null}
      <Ionicons name="chevron-forward" size={22} color={FateDropColors.secondary} />
    </View>
  </Pressable>;
}

export default function IndiesScreenV2() {
  const params = useLocalSearchParams<{ view?: string }>();
  const activeView = normalizedView(typeof params.view === 'string' ? params.view : undefined);
  const [directory, setDirectory] = useState<NetworkRetailer[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTcg, setSelectedTcg] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const setView = (view: RetailerView) => {
    setSelectedTcg(null);
    router.setParams({ view });
  };

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const result = await fetchRetailerDirectory();
      setDirectory(result.retailers.filter(hasRetailerStorefront));
    } catch (cause) {
      setDirectory([]);
      setDirectoryError(cause instanceof Error ? cause.message : 'Retailer network is unavailable.');
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadDirectory();
  }, [loadDirectory]));

  const storefrontRetailers = useMemo(
    () => [...directory]
      .filter((retailer) => matchesView(retailer, activeView))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [activeView, directory],
  );

  const tcgOptions = useMemo(() => [...new Set(
    storefrontRetailers.flatMap((retailer) => retailer.tcgs.map((tcg) => tcg.trim().toLowerCase()).filter(Boolean)),
  )].sort((a, b) => tcgLabel(a).localeCompare(tcgLabel(b))), [storefrontRetailers]);

  const shownRetailers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return storefrontRetailers.filter((retailer) => {
      const matchesTcg = !selectedTcg || retailer.tcgs.some((tcg) => tcg.trim().toLowerCase() === selectedTcg);
      const matchesQuery = !term || retailerSearchText(retailer).includes(term);
      return matchesTcg && matchesQuery;
    });
  }, [query, selectedTcg, storefrontRetailers]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FateDropBackground />
    <FlatList
      data={shownRetailers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={directoryLoading} onRefresh={() => void loadDirectory()} tintColor={FateDropColors.goldBright} />}
      ListHeaderComponent={<>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={24} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>Retailers</Text>
            <Text style={styles.pageSubtitle}>DISCOVER THE STORES BEHIND THE HOBBY</Text>
          </View>
          <Pressable accessibilityLabel="Toggle retailer filters" onPress={() => setFiltersOpen((value) => !value)} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
            <Ionicons name="options-outline" size={21} color={FateDropColors.ivory} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Image source={{ uri: retailerHeroUri }} style={styles.heroImage} contentFit="cover" contentPosition="center" />
          <View style={styles.heroShade} />
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>Discover the{`\n`}stores behind{`\n`}the hobby.</Text>
            <Text style={styles.heroCopy}>Browse major retailers, TCG specialists and independent or local storefronts across the Fate Network.</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/fatefind')} style={({ pressed }) => [styles.fateFindBridge, pressed && styles.pressed]}>
          <View style={styles.fateFindIcon}><Ionicons name="telescope-outline" size={22} color={FateDropColors.violetLight} /></View>
          <View style={styles.fateFindCopy}>
            <Text style={styles.fateFindTitle}>Looking for a product? Use FateFind.</Text>
            <Text style={styles.fateFindText}>Products from every connected retailer enter the same comparison pool.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={FateDropColors.secondary} />
        </Pressable>

        <View style={styles.segmented}>
          <SegmentButton label="All" active={activeView === 'all'} onPress={() => setView('all')} />
          <SegmentButton label="Major Retailers" active={activeView === 'major'} onPress={() => setView('major')} />
          <SegmentButton label="TCG Specialists" active={activeView === 'specialist'} onPress={() => setView('specialist')} />
          <SegmentButton label="Independent & Local" active={activeView === 'local'} onPress={() => setView('local')} />
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={20} color={FateDropColors.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search retailer or TCG"
            placeholderTextColor={FateDropColors.muted}
            style={styles.input}
            returnKeyType="search"
            accessibilityLabel="Search Fate Network retailers by name or trading card game"
          />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear retailer search" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={FateDropColors.secondary} /></Pressable> : null}
          <View style={styles.searchDivider} />
          <Pressable accessibilityLabel="Toggle TCG filters" onPress={() => setFiltersOpen((value) => !value)} hitSlop={8}>
            <Ionicons name="options-outline" size={20} color={filtersOpen ? FateDropColors.goldBright : FateDropColors.secondary} />
          </Pressable>
        </View>

        {filtersOpen && tcgOptions.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tcgFilters}>
          <TcgChip label="All TCGs" active={!selectedTcg} onPress={() => setSelectedTcg(null)} />
          {tcgOptions.map((tcg) => <TcgChip key={tcg} label={tcgLabel(tcg)} active={selectedTcg === tcg} onPress={() => setSelectedTcg(tcg)} />)}
        </ScrollView> : null}

        <Pressable onPress={() => router.push('/local-radar')} style={({ pressed }) => [styles.localCard, pressed && styles.pressed]}>
          <View style={styles.localIcon}><Ionicons name="location" size={25} color={FateDropColors.cyan} /></View>
          <View style={styles.localCopy}>
            <Text style={styles.localTitle}>Find physical stores near you</Text>
            <Text style={styles.localText}>Use Local Radar to discover known branches around your location. A store pin does not imply physical stock.</Text>
          </View>
          <View style={styles.radarMark}>
            <View style={styles.radarOuter}><View style={styles.radarInner}><View style={styles.radarDot} /></View></View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={FateDropColors.secondary} />
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Retailer storefronts</Text>
          <Text style={styles.sectionMeta}>A–Z · NO RANKING</Text>
        </View>

        {directoryError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><Text style={styles.errorText}>{directoryError}</Text></View> : null}
      </>}
      ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
      ListEmptyComponent={directoryLoading ? <ActivityIndicator color={FateDropColors.goldBright} style={styles.loading} /> : !directoryError ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No storefronts match</Text>
        <Text style={styles.emptyCopy}>Try another retailer name, retailer category or TCG. FateDrop does not substitute demo retailers into the live storefront directory.</Text>
      </View> : null}
      renderItem={({ item }) => <RetailerCard retailer={item} />}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050A12' },
  content: { paddingHorizontal: 14, paddingBottom: 120 },
  topBar: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 7, paddingBottom: 10 },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.bronze}AA`, backgroundColor: 'rgba(7,12,21,.9)' },
  titleBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 3 },
  pageTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 29, fontWeight: '700', letterSpacing: .2 },
  pageSubtitle: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '800', letterSpacing: 1.6, marginTop: 6, textAlign: 'center' },

  hero: { height: 244, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: `${FateDropColors.bronze}CC`, backgroundColor: FateDropColors.shell, marginBottom: 10 },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,8,15,.35)' },
  heroTextBlock: { position: 'absolute', left: 20, bottom: 20, width: '54%', paddingRight: 6 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 31, lineHeight: 34, fontWeight: '700', textShadowColor: 'rgba(0,0,0,.72)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  heroCopy: { color: '#E8DDCF', fontFamily: Fonts?.serif, fontSize: 12, lineHeight: 17, marginTop: 10, textShadowColor: 'rgba(0,0,0,.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },

  fateFindBridge: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.bronze}AA`, backgroundColor: 'rgba(12,19,31,.96)', marginBottom: 10 },
  fateFindIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.violetLight}66`, backgroundColor: `${FateDropColors.violet}20` },
  fateFindCopy: { flex: 1 },
  fateFindTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 14, fontWeight: '700' },
  fateFindText: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 11, lineHeight: 15, marginTop: 2 },

  segmented: { flexDirection: 'row', minHeight: 58, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.bronze}99`, backgroundColor: 'rgba(10,16,27,.94)', marginBottom: 10 },
  segmentButton: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 9, borderRightWidth: 1, borderRightColor: 'rgba(141,104,71,.24)' },
  segmentButtonActive: { backgroundColor: 'rgba(83,54,151,.5)', borderColor: FateDropColors.violetLight },
  segmentText: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 9.5, lineHeight: 12, textAlign: 'center' },
  segmentTextActive: { color: FateDropColors.ivory, fontWeight: '700' },

  search: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 52, paddingHorizontal: 13, borderRadius: 16, borderWidth: 1, borderColor: `${FateDropColors.bronze}88`, backgroundColor: 'rgba(10,16,27,.96)', marginBottom: 9 },
  input: { flex: 1, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 13 },
  searchDivider: { width: 1, height: 30, backgroundColor: `${FateDropColors.bronze}55` },
  tcgFilters: { gap: 8, paddingRight: 8, paddingBottom: 11 },
  tcgFilter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: `${FateDropColors.bronze}77`, backgroundColor: 'rgba(10,16,27,.9)' },
  tcgFilterActive: { borderColor: `${FateDropColors.goldBright}AA`, backgroundColor: `${FateDropColors.gold}14` },
  tcgFilterText: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 11 },
  tcgFilterTextActive: { color: FateDropColors.ivory },

  localCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.bronze}99`, backgroundColor: 'rgba(8,24,38,.94)', marginBottom: 14, overflow: 'hidden' },
  localIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}0C` },
  localCopy: { flex: 1, zIndex: 2 },
  localTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 14, fontWeight: '700' },
  localText: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 10, lineHeight: 14, marginTop: 3 },
  radarMark: { position: 'absolute', right: 35, width: 96, height: 96, opacity: .5, alignItems: 'center', justifyContent: 'center' },
  radarOuter: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: `${FateDropColors.cyan}55`, alignItems: 'center', justifyContent: 'center' },
  radarInner: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: `${FateDropColors.cyan}77`, alignItems: 'center', justifyContent: 'center' },
  radarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: FateDropColors.cyan },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingHorizontal: 2, marginBottom: 8 },
  sectionTitle: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 21, fontWeight: '700' },
  sectionMeta: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },

  retailerCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 17, borderWidth: 1, borderColor: `${FateDropColors.bronze}88`, backgroundColor: 'rgba(11,18,30,.97)' },
  logoTile: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.bronze}77`, backgroundColor: '#111A27' },
  logoInitials: { color: FateDropColors.goldBright, fontFamily: Fonts?.serif, fontSize: 18, fontWeight: '800', letterSpacing: .7 },
  retailerBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  retailerName: { flexShrink: 1, color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 18, fontWeight: '700' },
  retailerClass: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 3 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  presence: { color: FateDropColors.secondary, fontFamily: Fonts?.serif, fontSize: 10 },
  retailerRight: { width: 118, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  cardTcgRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  cardTcgBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: `${FateDropColors.violetLight}66`, backgroundColor: `${FateDropColors.violet}0E` },
  cardTcgText: { color: '#CBBEFF', fontFamily: Fonts?.serif, fontSize: 8 },

  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.amber}44`, padding: 12, marginBottom: 10 },
  errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  empty: { paddingVertical: 42, alignItems: 'center' },
  emptyTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 17, fontWeight: '700' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', maxWidth: 300, marginTop: 6 },
  loading: { marginVertical: 30 },
  pressed: { opacity: .76 },
});
