import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  FateDropBackground,
  FateDropHeader,
  FilterChip,
  PageNavigation,
  StatusBadge,
} from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';
import { formatEventDate, isSafeExternalUrl, loadSavedEventIds, saveEventIds } from '@/lib/encounters';
import { loadEncounters, loadLocalRadar } from '@/services/encounters';
import { ExpoLocationAdapter, type UserArea } from '@/services/location';
import type { CalendarEvent, LocalRadarShop } from '@/types/encounter';

const filters = ['UK Calendar', 'Nearby', 'Shops', 'Events', 'This Month', 'Pokémon', 'Free Entry', 'Saved'] as const;
type Filter = (typeof filters)[number];

const locationAdapter = new ExpoLocationAdapter();
const outward = (postcode?: string | null) => postcode?.replace(/\s+/g, '').slice(0, -3).toUpperCase();
const supportsPokemon = (event: CalendarEvent) => (event.supportedTcgs || []).some((value) => {
  const clean = value.toLowerCase();
  return clean === 'pokemon' || clean === 'pokémon' || clean === 'all' || clean === 'all tcg';
});

export default function EncountersScreen() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [nearbyEvents, setNearbyEvents] = useState<CalendarEvent[]>([]);
  const [shops, setShops] = useState<LocalRadarShop[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [active, setActive] = useState<Filter>('UK Calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radarNote, setRadarNote] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState(25);

  const loadCalendar = useCallback(async () => {
    try {
      setError('');
      setCalendarEvents(await loadEncounters());
    } catch {
      setCalendarEvents([]);
      setError('The hosted UK event calendar could not be loaded. FateDrop will not invent event data while the feed is unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshRadar = useCallback(async (current: UserArea, requestedRadius = radius) => {
    try {
      setRadarNote('');
      const data = await loadLocalRadar({
        latitude: current.latitude,
        longitude: current.longitude,
        postcode: current.postcode,
        radiusMiles: requestedRadius,
        types: ['shops', 'events'],
      });
      setShops(data.shops);
      setNearbyEvents(data.events);
      if (data.providers?.shops?.status === 'unconfigured') {
        setRadarNote('Nearby shop discovery is not configured on the hosted FateDrop service yet. The event calendar remains available.');
      } else if (data.providers?.shops?.status === 'unavailable') {
        setRadarNote('Nearby shop discovery is temporarily unavailable. Event data remains separate and usable.');
      }
    } catch {
      setShops([]);
      setNearbyEvents([]);
      setRadarNote('Nearby discovery could not be loaded. Your location was not turned into stock evidence or saved by this screen.');
    }
  }, [radius]);

  useEffect(() => {
    void loadCalendar();
    void loadSavedEventIds(AsyncStorage).then(setSaved);
  }, [loadCalendar]);

  const toggle = async (id: string) => {
    const next = saved.includes(id) ? saved.filter((value) => value !== id) : [...saved, id];
    setSaved(next);
    await saveEventIds(AsyncStorage, next);
  };

  const locateDevice = async () => {
    setLocationError('');
    setLocating(true);
    try {
      const current = await locationAdapter.requestCurrentArea();
      setArea(current);
      await refreshRadar(current);
      setActive('Nearby');
    } catch (cause) {
      setLocationError(
        cause instanceof Error && cause.message === 'LOCATION_DENIED'
          ? 'Location permission was denied. Enter a postcode instead.'
          : 'Location could not be determined. Enter a postcode instead.',
      );
    } finally {
      setLocating(false);
    }
  };

  const applyPostcode = async () => {
    setLocationError('');
    setLocating(true);
    try {
      const current = await locationAdapter.fromPostcode(postcode);
      setArea(current);
      await refreshRadar(current);
      setActive('Nearby');
    } catch {
      setLocationError('Enter a valid UK postcode.');
    } finally {
      setLocating(false);
    }
  };

  const changeRadius = async (value: number) => {
    setRadius(value);
    if (area) await refreshRadar(area, value);
  };

  const sourceEvents = active === 'Nearby' ? nearbyEvents : calendarEvents;
  const filteredEvents = useMemo(() => sourceEvents.filter((event) => {
    if (active === 'Shops') return false;
    if (active === 'Saved') return saved.includes(event.id);
    if (active === 'This Month') {
      const now = new Date();
      return event.startDateTime.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (active === 'Pokémon') return supportsPokemon(event);
    if (active === 'Free Entry') return /free/i.test(event.ticketPriceText || '');
    return true;
  }), [active, saved, sourceEvents]);

  const filteredShops = useMemo(() => {
    if (!['Nearby', 'Shops'].includes(active)) return [];
    return [...shops].sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
  }, [active, shops]);

  const featured = filteredEvents.find((event) => event.featured);
  const nearbyCount = nearbyEvents.length + shops.length;

  const eventCard = (event: CalendarEvent, hero = false) => (
    <Pressable
      key={event.id}
      accessibilityRole="button"
      accessibilityLabel={`Open ${event.name}`}
      onPress={() => router.push({ pathname: '/encounters/detail', params: { id: event.id, eventData: JSON.stringify(event) } })}
      style={({ pressed }) => [styles.card, hero && styles.featured, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.typeIcon}><Ionicons name="calendar" size={18} color={FateDropColors.amber} /></View>
        <View style={styles.cardCopy}>
          <Text style={styles.typeLabel}>EVENT</Text>
          <Text style={styles.cardTitle}>{event.name}</Text>
        </View>
        <Pressable
          accessibilityLabel={saved.includes(event.id) ? 'Unsave event' : 'Save event'}
          hitSlop={10}
          onPress={(pressEvent) => { pressEvent.stopPropagation(); void toggle(event.id); }}
        >
          <Ionicons name={saved.includes(event.id) ? 'bookmark' : 'bookmark-outline'} size={21} color={FateDropColors.violetLight} />
        </Pressable>
      </View>
      <Text style={styles.date}>{formatEventDate(event.startDateTime, event.endDateTime || event.startDateTime)}</Text>
      <Text style={styles.place}>{event.venueName || event.townCity || 'Venue to be confirmed'}</Text>
      <Text style={styles.price}>{event.ticketPriceText || 'Price to be confirmed'}</Text>
      {event.distanceMiles != null ? <Text style={styles.distance}>{event.distanceMiles.toFixed(1)} miles away</Text> : null}
      <View style={styles.tags}>
        {event.featured ? <StatusBadge label="Featured" color={FateDropColors.amber} /> : null}
        {event.verificationStatus === 'fatedrop_verified' ? <StatusBadge label="FateDrop verified" color={FateDropColors.mint} /> : null}
        {event.verificationStatus === 'source_verified' ? <StatusBadge label="Source verified" color={FateDropColors.cyan} /> : null}
        {event.vendorApplicationsStatus === 'open' ? <StatusBadge label="Vendor spaces" color={FateDropColors.blue} /> : null}
      </View>
    </Pressable>
  );

  const openShop = (shop: LocalRadarShop) => {
    if (shop.retailerId) {
      router.push({ pathname: '/retailers/[id]', params: { id: shop.retailerId } });
      return;
    }
    if (shop.websiteUrl && isSafeExternalUrl(shop.websiteUrl)) void Linking.openURL(shop.websiteUrl);
  };

  const shopCard = (shop: LocalRadarShop) => {
    const connected = shop.networkStatus === 'live_connected';
    const onlineOffers = shop.onlineCatalogue?.availableOffers ?? 0;
    return (
      <Pressable
        key={shop.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${shop.name}`}
        onPress={() => openShop(shop)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeIcon, styles.shopIcon]}><Ionicons name="storefront" size={18} color={FateDropColors.cyan} /></View>
          <View style={styles.cardCopy}>
            <Text style={[styles.typeLabel, styles.shopLabel]}>LOCAL SHOP</Text>
            <Text style={styles.cardTitle}>{shop.name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={FateDropColors.muted} />
        </View>
        <Text style={styles.place}>{shop.address || 'Independent TCG retailer'}</Text>
        {shop.distanceMiles != null ? <Text style={styles.distance}>{shop.distanceMiles.toFixed(1)} miles away</Text> : null}
        {connected && onlineOffers > 0 ? (
          <View style={styles.stockContext}>
            <Ionicons name="pulse" size={15} color={FateDropColors.mint} />
            <View style={styles.cardCopy}>
              <Text style={styles.stockTitle}>{onlineOffers} online catalogue offers detected</Text>
              <Text style={styles.stockText}>Online catalogue evidence only — FateDrop is not claiming those items are stocked at this physical branch.</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.tags}>
          <StatusBadge label={connected ? 'Live connected' : 'Local indie'} color={connected ? FateDropColors.violetLight : FateDropColors.cyan} />
          {shop.verificationStatus === 'fatedrop_verified' ? <StatusBadge label="FateDrop verified" color={FateDropColors.mint} /> : null}
          {shop.provider === 'google_places' ? <StatusBadge label="Google Places discovery" color={FateDropColors.blue} /> : null}
        </View>
      </Pressable>
    );
  };

  const noNearbySelection = (active === 'Nearby' || active === 'Shops') && !area;

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadCalendar().then(() => area ? refreshRadar(area) : undefined);
            }}
            tintColor={FateDropColors.violetLight}
          />
        )}
      >
        <PageNavigation />
        <FateDropHeader title="Fate Encounters" />

        <View style={styles.intro}>
          <Text style={styles.introEyebrow}>LOCAL RADAR + UK CALENDAR</Text>
          <Text style={styles.introTitle}>Find the TCG scene around you — and across the UK.</Text>
          <Text style={styles.introText}>Nearby indie shops, connected retailers, trade nights, tournaments, prereleases, card shows and conventions live in one discovery layer.</Text>
        </View>

        <View style={styles.radarPanel}>
          <View style={styles.radarHeader}>
            <View style={styles.radarIcon}><Ionicons name="navigate" size={19} color={FateDropColors.cyan} /></View>
            <View style={styles.radarCopy}>
              <Text style={styles.radarTitle}>Nearby discovery</Text>
              <Text style={styles.radarText}>Location is optional and requested only when you choose it. A UK postcode can be used without turning a discovered shop into stock evidence.</Text>
            </View>
          </View>
          <Pressable disabled={locating} onPress={() => void locateDevice()} style={styles.locationButton}>
            <Ionicons name="locate" size={17} color={FateDropColors.text} />
            <Text style={styles.locationButtonText}>{locating ? 'Locating…' : 'Use my location'}</Text>
          </Pressable>
          <View style={styles.postcodeRow}>
            <TextInput
              value={postcode}
              onChangeText={setPostcode}
              autoCapitalize="characters"
              placeholder="UK postcode"
              placeholderTextColor={FateDropColors.muted}
              style={styles.postcodeInput}
            />
            <Pressable disabled={locating} onPress={() => void applyPostcode()} style={styles.postcodeButton}><Text style={styles.postcodeButtonText}>Set</Text></Pressable>
          </View>
          {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}
          {area ? (
            <View style={styles.areaRow}>
              <StatusBadge label={area.source === 'DEVICE' ? 'Device distance enabled' : `Postcode ${outward(area.postcode)}`} color={FateDropColors.mint} />
              <Text style={styles.areaCount}>{nearbyCount} nearby matches</Text>
            </View>
          ) : null}
          {area ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusFilters}>
              {[10, 25, 50, 100].map((value) => (
                <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => void changeRadius(value)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((filter) => <FilterChip key={filter} label={filter} active={active === filter} onPress={() => setActive(filter)} />)}
        </ScrollView>

        {loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : null}
        {error ? <Text style={styles.feedNote}>{error}</Text> : null}
        {radarNote && (active === 'Nearby' || active === 'Shops') ? <Text style={styles.feedNote}>{radarNote}</Text> : null}
        {noNearbySelection ? <Text style={styles.feedNote}>Choose “Use my location” or enter a UK postcode to load nearby shops and events.</Text> : null}

        {active === 'UK Calendar' ? (
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.heading}>UK card event calendar</Text>
            <StatusBadge label={`${filteredEvents.length} upcoming`} color={FateDropColors.amber} />
          </View>
        ) : null}

        {featured && active !== 'Shops' ? (
          <>
            <Text style={styles.heading}>Featured encounter</Text>
            {eventCard(featured, true)}
          </>
        ) : null}

        {filteredShops.length ? (
          <>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.heading}>Independent shops</Text>
              <StatusBadge label={`${filteredShops.length} found`} color={FateDropColors.cyan} />
            </View>
            {filteredShops.map(shopCard)}
          </>
        ) : null}

        {filteredEvents.filter((event) => event.id !== featured?.id).length ? (
          <>
            {active !== 'UK Calendar' ? (
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.heading}>{active === 'Nearby' ? 'Events near you' : 'Upcoming events'}</Text>
                <StatusBadge label={`${filteredEvents.length} events`} color={FateDropColors.amber} />
              </View>
            ) : null}
            {filteredEvents.filter((event) => event.id !== featured?.id).map((event) => eventCard(event))}
          </>
        ) : null}

        {!loading && !noNearbySelection && !filteredShops.length && !filteredEvents.length ? (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={28} color={FateDropColors.violetLight} />
            <Text style={styles.emptyTitle}>Nothing matches this view yet</Text>
            <Text style={styles.emptyText}>Try a wider radius or another filter. Empty data stays empty rather than being filled with demo shops or events.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 90 },
  intro: { marginBottom: 14, padding: 17, borderRadius: 20, backgroundColor: 'rgba(19,17,31,.88)', borderWidth: 1, borderColor: `${FateDropColors.violetLight}33` },
  introEyebrow: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.35 },
  introTitle: { color: FateDropColors.text, fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 6 },
  introText: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 19, marginTop: 7 },
  radarPanel: { padding: 15, borderRadius: 19, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: `${FateDropColors.cyan}35`, marginBottom: 14 },
  radarHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  radarIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.cyan}12` },
  radarCopy: { flex: 1 },
  radarTitle: { color: FateDropColors.text, fontSize: 14, fontWeight: '900' },
  radarText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  locationButton: { minHeight: 43, marginTop: 13, borderRadius: 13, backgroundColor: FateDropColors.violet, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  locationButtonText: { color: FateDropColors.text, fontWeight: '900', fontSize: 11 },
  postcodeRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  postcodeInput: { flex: 1, color: FateDropColors.text, padding: 11, borderRadius: 12, backgroundColor: FateDropColors.cardElevated },
  postcodeButton: { justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: FateDropColors.cardElevated },
  postcodeButtonText: { color: FateDropColors.text, fontWeight: '900' },
  locationError: { color: FateDropColors.coral, fontSize: 10, lineHeight: 15, marginTop: 8 },
  areaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  areaCount: { flex: 1, color: FateDropColors.muted, fontSize: 9, textAlign: 'right' },
  radiusFilters: { gap: 8, paddingTop: 11 },
  filters: { gap: 8, paddingBottom: 10 },
  heading: { color: FateDropColors.text, fontSize: 20, fontWeight: '900', letterSpacing: -.35, marginVertical: 14 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  card: { backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, borderRadius: 22, padding: 17, marginBottom: 12, shadowColor: '#000', shadowOpacity: .24, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  featured: { borderColor: `${FateDropColors.violetLight}88`, backgroundColor: 'rgba(38,24,57,0.94)', shadowColor: FateDropColors.violet, shadowOpacity: .3 },
  cardTop: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardCopy: { flex: 1 },
  typeIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.amber}12` },
  shopIcon: { backgroundColor: `${FateDropColors.cyan}12` },
  typeLabel: { color: FateDropColors.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  shopLabel: { color: FateDropColors.cyan },
  cardTitle: { color: FateDropColors.text, fontSize: 17, fontWeight: '900', lineHeight: 22, marginTop: 2 },
  date: { color: FateDropColors.cyan, fontWeight: '800', marginTop: 10 },
  place: { color: FateDropColors.secondary, marginTop: 7, lineHeight: 18 },
  price: { color: FateDropColors.text, fontWeight: '800', marginTop: 7 },
  distance: { color: FateDropColors.mint, fontSize: 10, fontWeight: '900', marginTop: 7 },
  stockContext: { flexDirection: 'row', gap: 9, padding: 10, borderRadius: 12, backgroundColor: `${FateDropColors.mint}08`, borderWidth: 1, borderColor: `${FateDropColors.mint}25`, marginTop: 10 },
  stockTitle: { color: FateDropColors.mint, fontSize: 10, fontWeight: '900' },
  stockText: { color: FateDropColors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  state: { marginTop: 35 },
  feedNote: { color: FateDropColors.amber, fontSize: 10, lineHeight: 16, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.amber}30`, backgroundColor: `${FateDropColors.amber}08`, marginTop: 4, marginBottom: 8 },
  empty: { alignItems: 'center', padding: 26, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginTop: 18 },
  emptyTitle: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 10 },
  emptyText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 6 },
  pressed: { opacity: .8, transform: [{ scale: .99 }] },
});
