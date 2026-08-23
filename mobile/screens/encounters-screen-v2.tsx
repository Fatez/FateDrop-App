import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader, FilterChip } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { FateDropColors } from '@/constants/theme';
import { formatEventDate, loadSavedEventIds, saveEventIds } from '@/lib/encounters';
import type { CalendarEvent } from '@/types/encounter';

type Filter = 'All' | 'This month' | 'Pokémon' | 'Free' | 'Vendor spaces' | 'Saved';
const filters: Filter[] = ['All', 'This month', 'Pokémon', 'Free', 'Vendor spaces', 'Saved'];

function eventTown(event: CalendarEvent) {
  return event.townCity || event.region || 'UK';
}

function EventCard({ event, saved, onToggle, featured = false }: { event: CalendarEvent; saved: boolean; onToggle: () => void; featured?: boolean }) {
  return <Pressable
    onPress={() => router.push({ pathname: '/encounters/detail', params: { id: event.id, eventData: JSON.stringify(event) } })}
    style={({ pressed }) => [styles.card, featured && styles.featuredCard, pressed && styles.pressed]}
  >
    <View style={styles.cardTop}>
      <View style={styles.cardCopy}>
        <View style={styles.badgeRow}>
          {featured ? <View style={[styles.badge, styles.featuredBadge]}><Text style={styles.featuredBadgeText}>FEATURED</Text></View> : null}
          {event.verificationStatus === 'verified' ? <View style={[styles.badge, styles.verifiedBadge]}><Text style={styles.verifiedBadgeText}>VERIFIED</Text></View> : null}
          {event.vendorApplicationsStatus === 'open' ? <View style={[styles.badge, styles.vendorBadge]}><Text style={styles.vendorBadgeText}>VENDOR SPACES</Text></View> : null}
        </View>
        <Text style={styles.cardTitle}>{event.name}</Text>
      </View>
      <Pressable hitSlop={10} onPress={(pressEvent) => { pressEvent.stopPropagation(); onToggle(); }} style={styles.saveButton}>
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? FateDropColors.violetLight : FateDropColors.text} />
      </Pressable>
    </View>

    <View style={styles.eventFacts}>
      <View style={styles.fact}><Ionicons name="calendar-outline" size={15} color={FateDropColors.cyan} /><Text style={styles.factText}>{formatEventDate(event.startDateTime, event.endDateTime)}</Text></View>
      <View style={styles.fact}><Ionicons name="location-outline" size={15} color={FateDropColors.violetLight} /><Text style={styles.factText}>{event.venueName || eventTown(event)}</Text></View>
      <View style={styles.fact}><Ionicons name="ticket-outline" size={15} color={FateDropColors.mint} /><Text style={styles.factText}>{event.ticketPriceText || 'Price to be confirmed'}</Text></View>
    </View>

    <View style={styles.cardFooter}>
      <Text style={styles.tcgText}>{event.supportedTcgs?.length ? event.supportedTcgs.join(' · ') : 'TCG event'}</Text>
      <View style={styles.openRow}><Text style={styles.openText}>VIEW EVENT</Text><Ionicons name="arrow-forward" size={13} color={FateDropColors.text} /></View>
    </View>
  </Pressable>;
}

export default function EncountersScreenV2() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendar-events`);
      const payload = await response.json().catch(() => null) as { events?: CalendarEvent[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || `Events HTTP ${response.status}`);
      setEvents(Array.isArray(payload?.events) ? payload.events : []);
      setSaved(await loadSavedEventIds(AsyncStorage));
    } catch (cause) {
      setEvents([]);
      setError(cause instanceof Error ? cause.message : 'Fate Encounters could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toggleSaved = async (id: string) => {
    const next = saved.includes(id) ? saved.filter((value) => value !== id) : [...saved, id];
    setSaved(next);
    await saveEventIds(AsyncStorage, next);
  };

  const filtered = useMemo(() => events.filter((event) => {
    if (filter === 'Saved') return saved.includes(event.id);
    if (filter === 'Pokémon') return event.supportedTcgs?.some((tcg) => /pok[eé]mon/i.test(tcg));
    if (filter === 'Free') return /free/i.test(event.ticketPriceText || '');
    if (filter === 'Vendor spaces') return event.vendorApplicationsStatus === 'open';
    if (filter === 'This month') {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return event.startDateTime.slice(0, 7) === month;
    }
    return true;
  }), [events, filter, saved]);

  const featured = filtered.find((event) => event.featured) || null;
  const upcoming = featured ? filtered.filter((event) => event.id !== featured.id) : filtered;

  const header = <>
    <FateDropHeader title="Fate Encounters" subtitle="SHOWS · TOURNAMENTS · TRADE NIGHTS" />
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.eyebrow}>COLLECT BEYOND THE SCREEN</Text>
      <Text style={styles.heroTitle}>Find where the community is meeting next.</Text>
      <Text style={styles.heroCopy}>FateDrop keeps events secondary to live stock intelligence, but makes shows, tournaments and vendor opportunities easy to discover when you want them.</Text>
      <View style={styles.heroStats}>
        <View><Text style={styles.statValue}>{events.length}</Text><Text style={styles.statLabel}>UPCOMING</Text></View>
        <View><Text style={styles.statValue}>{saved.length}</Text><Text style={styles.statLabel}>SAVED</Text></View>
        <View><Text style={styles.statValue}>{events.filter((event) => event.vendorApplicationsStatus === 'open').length}</Text><Text style={styles.statLabel}>VENDOR OPENINGS</Text></View>
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((value) => <FilterChip key={value} label={value} active={filter === value} onPress={() => setFilter(value)} />)}</ScrollView>
    {error ? <View style={styles.error}><Ionicons name="warning-outline" size={18} color={FateDropColors.amber} /><View style={styles.flex}><Text style={styles.errorTitle}>Events feed unavailable</Text><Text style={styles.errorCopy}>{error}</Text></View><Pressable onPress={() => void load()}><Text style={styles.retry}>RETRY</Text></Pressable></View> : null}
    {featured ? <><View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>FEATURED</Text><Text style={styles.sectionTitle}>Worth a look</Text></View></View><EventCard event={featured} saved={saved.includes(featured.id)} onToggle={() => void toggleSaved(featured.id)} featured /></> : null}
    <View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>CALENDAR</Text><Text style={styles.sectionTitle}>{filter === 'All' ? 'Upcoming encounters' : filter}</Text></View><Text style={styles.sectionMeta}>{filtered.length} MATCHES</Text></View>
  </>;

  return <SafeAreaView style={styles.safe} edges={['top']}><FateDropBackground /><FlatList
    data={upcoming}
    keyExtractor={(event) => event.id}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={FateDropColors.violetLight} />}
    ListHeaderComponent={header}
    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    ListEmptyComponent={loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.loading} /> : !error ? <View style={styles.empty}><Ionicons name="calendar-outline" size={23} color={FateDropColors.secondary} /><Text style={styles.emptyTitle}>No encounters match</Text><Text style={styles.emptyCopy}>Try a different event filter. FateDrop does not fill the calendar with fictional listings.</Text></View> : null}
    renderItem={({ item }) => <EventCard event={item} saved={saved.includes(item.id)} onToggle={() => void toggleSaved(item.id)} />}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingHorizontal: 18, paddingBottom: 90 }, flex: { flex: 1 },
  hero: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(246,185,74,.16)', backgroundColor: 'rgba(9,10,17,.94)', marginBottom: 11 }, heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -80, top: -95, backgroundColor: 'rgba(246,185,74,.07)' }, eyebrow: { color: FateDropColors.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: FateDropColors.text, fontSize: 25, lineHeight: 28, fontWeight: '900', letterSpacing: -0.65, marginTop: 7, maxWidth: 330 }, heroCopy: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 16, marginTop: 8 }, heroStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: FateDropColors.border, marginTop: 15, paddingTop: 12 }, statValue: { color: FateDropColors.text, fontSize: 18, fontWeight: '900' }, statLabel: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: .7, marginTop: 2 },
  filters: { gap: 7, paddingBottom: 14 }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, marginBottom: 9 }, sectionEyebrow: { color: FateDropColors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, sectionTitle: { color: FateDropColors.text, fontSize: 20, fontWeight: '900', letterSpacing: -.3, marginTop: 3 }, sectionMeta: { color: FateDropColors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  card: { padding: 15, borderRadius: 19, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: 'rgba(13,15,24,.92)' }, featuredCard: { borderColor: `${FateDropColors.amber}40`, backgroundColor: 'rgba(24,19,16,.94)' }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, cardCopy: { flex: 1 }, badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7 }, badge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, borderWidth: 1 }, featuredBadge: { borderColor: `${FateDropColors.amber}45`, backgroundColor: `${FateDropColors.amber}0D` }, featuredBadgeText: { color: FateDropColors.amber, fontSize: 6, fontWeight: '900', letterSpacing: .7 }, verifiedBadge: { borderColor: `${FateDropColors.mint}45`, backgroundColor: `${FateDropColors.mint}0D` }, verifiedBadgeText: { color: FateDropColors.mint, fontSize: 6, fontWeight: '900', letterSpacing: .7 }, vendorBadge: { borderColor: `${FateDropColors.blue}45`, backgroundColor: `${FateDropColors.blue}0D` }, vendorBadgeText: { color: FateDropColors.blue, fontSize: 6, fontWeight: '900', letterSpacing: .7 }, cardTitle: { color: FateDropColors.text, fontSize: 15, lineHeight: 19, fontWeight: '900' }, saveButton: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.cardElevated },
  eventFacts: { gap: 7, marginTop: 13 }, fact: { flexDirection: 'row', alignItems: 'center', gap: 8 }, factText: { flex: 1, color: FateDropColors.secondary, fontSize: 9, lineHeight: 14 }, cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: FateDropColors.border, marginTop: 13, paddingTop: 10 }, tcgText: { color: FateDropColors.muted, fontSize: 7, fontWeight: '800' }, openRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, openText: { color: FateDropColors.text, fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  error: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: `${FateDropColors.amber}45`, backgroundColor: `${FateDropColors.amber}0A`, marginBottom: 10 }, errorTitle: { color: FateDropColors.amber, fontSize: 9, fontWeight: '900' }, errorCopy: { color: FateDropColors.secondary, fontSize: 8, lineHeight: 13, marginTop: 3 }, retry: { color: FateDropColors.amber, fontSize: 7, fontWeight: '900' }, empty: { alignItems: 'center', padding: 25, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.glass }, emptyTitle: { color: FateDropColors.text, fontSize: 13, fontWeight: '900', marginTop: 8 }, emptyCopy: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 }, loading: { margin: 30 }, pressed: { opacity: .78, transform: [{ scale: .99 }] },
});
