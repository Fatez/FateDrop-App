import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader, FilterChip } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
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
  if (value === 'independent') return 'Independent store';
  if (value === 'specialist') return 'TCG specialist';
  if (value === 'regional') return 'Regional store';
  return value.replaceAll('_', ' ');
}

function tcgLabel(value: string) {
  const key = value.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
  if (key === 'pokemon') return 'Pokémon';
  if (key === 'one piece') return 'One Piece';
  if (['mtg', 'magic', 'magic the gathering'].includes(key)) return 'Magic: The Gathering';
  if (key === 'lorcana') return 'Disney Lorcana';
  if (key === 'yu gi oh' || key === 'yugioh') return 'Yu-Gi-Oh!';
  return key.split(/\s+/).filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function presenceLabel(retailer: NetworkRetailer) {
  if (retailer.online && retailer.physicalStores === true) {
    return retailer.physicalLocations && retailer.physicalLocations > 0
      ? `Online · ${retailer.physicalLocations} physical location${retailer.physicalLocations === 1 ? '' : 's'}`
      : 'Online · Physical stores';
  }
  if (retailer.physicalStores === true) return 'Physical stores';
  if (retailer.online && retailer.physicalStores === false) return 'Online';
  if (retailer.online) return 'Online · Physical status unknown';
  return 'Retail presence unknown';
}

function retailerSearchText(retailer: NetworkRetailer) {
  return `${retailer.name} ${retailer.tcgs.join(' ')} ${classLabel(retailer.retailerClass)}`.toLowerCase();
}

function RetailerCard({ retailer }: { retailer: NetworkRetailer }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Open ${retailer.name} retailer storefront`}
    onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: retailer.id } })}
    style={({ pressed }) => [styles.retailerCard, pressed && styles.pressed]}
  >
    <View style={styles.retailerTop}>
      <View style={styles.retailerMark}>
        <Text style={styles.retailerInitials}>{retailer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text>
      </View>
      <View style={styles.retailerCopy}>
        <View style={styles.retailerNameRow}>
          <Text style={styles.retailerName}>{retailer.name}</Text>
          {String(retailer.verification || '').toLowerCase() === 'verified' ? <Ionicons name="checkmark-circle" size={15} color={FateDropColors.mint} /> : null}
        </View>
        <Text style={styles.retailerClass}>{classLabel(retailer.retailerClass).toUpperCase()}</Text>
        <Text style={styles.presence}>{presenceLabel(retailer)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.secondary} />
    </View>

    {retailer.tcgs.length ? <View style={styles.tcgRow}>
      {retailer.tcgs.map((tcg) => <View key={tcg} style={styles.tcgBadge}><Text style={styles.tcgBadgeText}>{tcgLabel(tcg)}</Text></View>)}
    </View> : null}
  </Pressable>;
}

function CategoryCard({ icon, title, copy, active, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  active: boolean;
  onPress: () => void;
}) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryCard, active && styles.categoryCardActive, pressed && styles.pressed]}>
    <View style={[styles.categoryIcon, active && styles.categoryIconActive]}><Ionicons name={icon} size={20} color={active ? FateDropColors.goldBright : FateDropColors.cyan} /></View>
    <View style={styles.categoryCopy}><Text style={styles.categoryTitle}>{title}</Text><Text style={styles.categoryText}>{copy}</Text></View>
    <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={17} color={active ? FateDropColors.goldBright : FateDropColors.secondary} />
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

  const sectionLabel = activeView === 'major'
    ? 'Major retailers'
    : activeView === 'specialist'
      ? 'TCG specialists'
      : activeView === 'local'
        ? 'Independent & local stores'
        : 'All retailer storefronts';

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <FateDropBackground />
    <FlatList
      data={shownRetailers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={directoryLoading} onRefresh={() => void loadDirectory()} tintColor={FateDropColors.violetLight} />}
      ListHeaderComponent={<>
        <FateDropHeader title="Retailers" subtitle="DISCOVER THE STORES BEHIND THE HOBBY" />
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>FATE NETWORK · RETAILERS</Text>
          <Text style={styles.heroTitle}>One retailer network. Different reasons to shop.</Text>
          <Text style={styles.heroCopy}>Browse major retailers, TCG specialists and independent or local stores. Every connected retailer catalogue feeds the same FateFind offer pool.</Text>
        </View>

        <Pressable onPress={() => router.push('/fatefind')} style={({ pressed }) => [styles.fateFindBridge, pressed && styles.pressed]}>
          <View style={styles.fateFindIcon}><Ionicons name="telescope-outline" size={21} color={FateDropColors.violetLight} /></View>
          <View style={styles.fateFindCopy}><Text style={styles.fateFindTitle}>Looking for a product?</Text><Text style={styles.fateFindText}>Use FateFind. Products from every connected retailer enter the same comparison pool.</Text></View>
          <Ionicons name="chevron-forward" size={16} color={FateDropColors.violetLight} />
        </Pressable>

        <View style={styles.browseHead}>
          <View><Text style={styles.browseEyebrow}>BROWSE RETAILERS</Text><Text style={styles.browseTitle}>Choose the kind of store</Text></View>
          {activeView !== 'all' ? <Pressable onPress={() => setView('all')}><Text style={styles.showAll}>SHOW ALL</Text></Pressable> : null}
        </View>

        <View style={styles.categories}>
          <CategoryCard icon="business-outline" title="Major Retailers" copy="National and major retail chains connected to FateDrop." active={activeView === 'major'} onPress={() => setView('major')} />
          <CategoryCard icon="albums-outline" title="TCG Specialists" copy="Hobby-focused retailers specialising in trading cards and related products." active={activeView === 'specialist'} onPress={() => setView('specialist')} />
          <CategoryCard icon="heart-outline" title="Independent & Local Stores" copy="Discover and support smaller businesses, regional shops and local stores." active={activeView === 'local'} onPress={() => setView('local')} />
        </View>

        <Pressable onPress={() => router.push('/local-radar')} style={({ pressed }) => [styles.localCard, pressed && styles.pressed]}>
          <View style={styles.localIcon}><Ionicons name="location-outline" size={22} color={FateDropColors.goldBright} /></View>
          <View style={styles.localCopy}><Text style={styles.localTitle}>Find physical stores near you</Text><Text style={styles.localText}>Local Radar maps known branches and local intelligence. A store pin never implies physical stock on its own.</Text></View>
          <Ionicons name="chevron-forward" size={16} color={FateDropColors.secondary} />
        </Pressable>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={FateDropColors.muted} />
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
        </View>

        {tcgOptions.length ? <View style={styles.filters}>
          <FilterChip label="All TCGs" active={!selectedTcg} onPress={() => setSelectedTcg(null)} />
          {tcgOptions.map((tcg) => <FilterChip key={tcg} label={tcgLabel(tcg)} active={selectedTcg === tcg} onPress={() => setSelectedTcg(tcg)} />)}
        </View> : null}

        <View style={styles.sectionHead}>
          <View><Text style={styles.sectionEyebrow}>{sectionLabel.toUpperCase()}</Text><Text style={styles.sectionTitle}>{shownRetailers.length} storefront{shownRetailers.length === 1 ? '' : 's'}</Text></View>
          <Text style={styles.sectionMeta}>A–Z · NO RANKING</Text>
        </View>

        {directoryError ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><Text style={styles.errorText}>{directoryError}</Text></View> : null}
      </>}
      ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
      ListEmptyComponent={directoryLoading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.loading} /> : !directoryError ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No storefronts match</Text>
        <Text style={styles.emptyCopy}>Try another retailer name, category or TCG. FateDrop does not substitute demo retailers into the live storefront directory.</Text>
      </View> : null}
      renderItem={({ item }) => <RetailerCard retailer={item} />}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(103,232,249,.16)', backgroundColor: 'rgba(9,10,17,.94)', marginBottom: 11 },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -80, top: -95, backgroundColor: 'rgba(103,232,249,.08)' },
  eyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: FateDropColors.text, fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.65, marginTop: 7, maxWidth: 330 },
  heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 },
  fateFindBridge: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.violetLight}2D`, backgroundColor: `${FateDropColors.violetLight}0A`, marginBottom: 14 },
  fateFindIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}12` },
  fateFindCopy: { flex: 1 },
  fateFindTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  fateFindText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  browseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 8 },
  browseEyebrow: { color: FateDropColors.goldBright, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  browseTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900', marginTop: 2 },
  showAll: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  categories: { gap: 8, marginBottom: 12 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass },
  categoryCardActive: { borderColor: `${FateDropColors.goldBright}55`, backgroundColor: `${FateDropColors.goldBright}08` },
  categoryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}0D` },
  categoryIconActive: { backgroundColor: `${FateDropColors.goldBright}10` },
  categoryCopy: { flex: 1 },
  categoryTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  categoryText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  localCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.gold}22`, backgroundColor: `${FateDropColors.gold}08`, marginBottom: 10 },
  localIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}12` },
  localCopy: { flex: 1 },
  localTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  localText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass, marginBottom: 10 },
  input: { flex: 1, color: FateDropColors.text, fontSize: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginVertical: 8 },
  sectionEyebrow: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  sectionTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900', marginTop: 2 },
  sectionMeta: { color: FateDropColors.cyan, fontSize: 7, fontWeight: '900', letterSpacing: .9 },
  retailerCard: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' },
  retailerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retailerMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.violetLight}12`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}28` },
  retailerInitials: { color: FateDropColors.violetLight, fontSize: 11, fontWeight: '900' },
  retailerCopy: { flex: 1 },
  retailerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  retailerName: { color: FateDropColors.text, fontSize: 13, fontWeight: '900' },
  retailerClass: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '800', letterSpacing: .7, marginTop: 3 },
  presence: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '800', marginTop: 4 },
  tcgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: FateDropColors.border },
  tcgBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: `${FateDropColors.violetLight}0E`, borderWidth: 1, borderColor: `${FateDropColors.violetLight}20` },
  tcgBadgeText: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '800' },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.amber}33`, padding: 12, marginBottom: 10 },
  errorText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 15 },
  empty: { paddingVertical: 42, alignItems: 'center' },
  emptyTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900' },
  emptyCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', maxWidth: 300, marginTop: 6 },
  loading: { marginVertical: 30 },
  pressed: { opacity: .76 },
});