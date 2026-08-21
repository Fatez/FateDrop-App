import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { API_BASE_URL } from '@/constants/api';
import { retailers } from '@/constants/retailers';
import { FateDropColors } from '@/constants/theme';
import { formatEventDate, loadSavedEventIds, saveEventIds } from '@/lib/encounters';
import {
  distanceMiles,
  ExpoLocationAdapter,
  geocodeEventLocation,
  type UserArea,
} from '@/services/location';
import type { CalendarEvent } from '@/types/encounter';

const filters = ['All', 'Nearby', 'Shops', 'Events', 'This Month', 'Pokémon', 'Free Entry', 'Saved'] as const;
type Filter = (typeof filters)[number];

type NearbyEvent = CalendarEvent & { distanceMiles?: number };
type NearbyShop = {
  id: string;
  retailerId: string;
  name: string;
  venueName?: string;
  townCity?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  verificationStatus: string;
  catalogueConnected: boolean;
};

const locationAdapter = new ExpoLocationAdapter();
const outward = (postcode?: string | null) => postcode?.replace(/\s+/g, '').slice(0, -3).toUpperCase();

export default function EncountersScreen() {
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [active, setActive] = useState<Filter>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [area, setArea] = useState<UserArea>();
  const [postcode, setPostcode] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState(25);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`${API_BASE_URL}/api/calendar-events`);
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEvents([]);
      setError('Upcoming event data is not connected to the hosted FateDrop feed yet. Nearby shops can still be explored.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadSavedEventIds(AsyncStorage).then(setSaved);
  }, [load]);

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
      const enriched = await Promise.all(events.map(async (event) => {
        if (!event.postcode) return event;
        try {
          const coordinates = await geocodeEventLocation(event.postcode);
          if (!coordinates || current.latitude === undefined || current.longitude === undefined) return event;
          return {
            ...event,
            distanceMiles: distanceMiles(
              { latitude: current.latitude, longitude: current.longitude },
              coordinates,
            ),
          };
        } catch {
          return event;
        }
      }));
      setEvents(enriched);
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
    try {
      setArea(await locationAdapter.fromPostcode(postcode));
      setActive('Nearby');
    } catch {
      setLocationError('Enter a valid UK postcode.');
    }
  };

  const shops = useMemo<NearbyShop[]>(() => retailers.flatMap((retailer) => {
    if (retailer.isDemo || retailer.id === 'pokemon-center-uk') return [];
    return retailer.locations.map((location) => ({
      id: `shop:${location.id}`,
      retailerId: retailer.id,
      name: retailer.name,
      venueName: location.name,
      townCity: location.townCity,
      postcode: location.postcode,
      latitude: location.latitude,
      longitude: location.longitude,
      verificationStatus: retailer.verification.status,
      catalogueConnected: true,
      distanceMiles:
        area?.source === 'DEVICE'
        && area.latitude !== undefined
        && area.longitude !== undefined
        && location.latitude !== undefined
        && location.longitude !== undefined
          ? distanceMiles(
              { latitude: area.latitude, longitude: area.longitude },
              { latitude: location.latitude, longitude: location.longitude },
            )
          : undefined,
    }));
  }), [area]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    if (active === 'Shops') return false;
    if (active === 'Saved') return saved.includes(event.id);
    if (active === 'This Month') {
      const now = new Date();
      return event.startDateTime.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (active === 'Pokémon') return event.supportedTcgs?.includes('Pokémon') ?? false;
    if (active === 'Free Entry') return /free/i.test(event.ticketPriceText || '');
    if (active === 'Nearby' && area?.source === 'DEVICE') {
      return event.distanceMiles !== undefined && event.distanceMiles <= radius;
    }
    if (active === 'Nearby' && area?.source === 'POSTCODE') {
      return outward(event.postcode) === outward(area.postcode);
    }
    return true;
  }), [active, area, events, radius, saved]);

  const filteredShops = useMemo(() => shops.filter((shop) => {
    if (['Events', 'This Month', 'Pokémon', 'Free Entry', 'Saved'].includes(active)) return false;
    if (active === 'Nearby' && area?.source === 'DEVICE') {
      return shop.distanceMiles !== undefined && shop.distanceMiles <= radius;
    }
    if (active === 'Nearby' && area?.source === 'POSTCODE') {
      return outward(shop.postcode) === outward(area.postcode);
    }
    return true;
  }).sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity)), [active, area, radius, shops]);

  const featured = filteredEvents.find((event) => event.featured);
  const nearbyCount = filteredEvents.length + filteredShops.length;

  const eventCard = (event: NearbyEvent, hero = false) => (
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
      <Text style={styles.date}>{formatEventDate(event.startDateTime, event.endDateTime)}</Text>
      <Text style={styles.place}>{event.venueName || event.townCity || 'Venue to be confirmed'}</Text>
      <Text style={styles.price}>{event.ticketPriceText || 'Price to be confirmed'}</Text>
      {event.distanceMiles !== undefined ? <Text style={styles.distance}>{event.distanceMiles.toFixed(1)} miles away</Text> : null}
      <View style={styles.tags}>
        {event.featured ? <StatusBadge label="Featured" color={FateDropColors.amber} /> : null}
        {event.verificationStatus === 'verified' ? <StatusBadge label="Verified" color={FateDropColors.mint} /> : null}
        {event.vendorApplicationsStatus === 'open' ? <StatusBadge label="Vendor spaces" color={FateDropColors.blue} /> : null}
      </View>
    </Pressable>
  );

  const shopCard = (shop: NearbyShop) => (
    <Pressable
      key={shop.id}
      accessibilityRole="button"
      accessibilityLabel={`Open ${shop.name}`}
      onPress={() => router.push({ pathname: '/retailers/[id]', params: { id: shop.retailerId } })}
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
      <Text style={styles.place}>{shop.venueName || shop.townCity || 'Independent TCG retailer'}</Text>
      <Text style={styles.price}>{[shop.townCity, shop.postcode].filter(Boolean).join(' · ') || 'Location details pending'}</Text>
      {shop.distanceMiles !== undefined ? <Text style={styles.distance}>{shop.distanceMiles.toFixed(1)} miles away</Text> : null}
      <View style={styles.tags}>
        <StatusBadge label={shop.catalogueConnected ? 'Live connected' : 'Local indie'} color={FateDropColors.cyan} />
        {shop.verificationStatus === 'VERIFIED' ? <StatusBadge label="Verified" color={FateDropColors.mint} /> : null}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={FateDropColors.violetLight}
          />
        )}
      >
        <PageNavigation />
        <FateDropHeader title="Fate Encounters" />

        <View style={styles.intro}>
          <Text style={styles.introEyebrow}>LOCAL RADAR + EVENTS</Text>
          <Text style={styles.introTitle}>Find the TCG scene around you.</Text>
          <Text style={styles.introText}>Discover independent card shops, trade nights, tournaments, prereleases, card shows and conventions in one place.</Text>
        </View>

        <View style={styles.radarPanel}>
          <View style={styles.radarHeader}>
            <View style={styles.radarIcon}><Ionicons name="navigate" size={19} color={FateDropColors.cyan} /></View>
            <View style={styles.radarCopy}>
              <Text style={styles.radarTitle}>Nearby discovery</Text>
              <Text style={styles.radarText}>Location is optional and requested only when you choose to use it. A UK postcode works too.</Text>
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
            <Pressable onPress={() => void applyPostcode()} style={styles.postcodeButton}><Text style={styles.postcodeButtonText}>Set</Text></Pressable>
          </View>
          {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}
          {area ? (
            <View style={styles.areaRow}>
              <StatusBadge label={area.source === 'DEVICE' ? 'Device distance enabled' : `Postcode ${outward(area.postcode)}`} color={FateDropColors.mint} />
              <Text style={styles.areaCount}>{nearbyCount} matching places/events</Text>
            </View>
          ) : null}
          {area?.source === 'DEVICE' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusFilters}>
              {[10, 25, 50, 100].map((value) => (
                <FilterChip key={value} label={`${value} miles`} active={radius === value} onPress={() => setRadius(value)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((filter) => <FilterChip key={filter} label={filter} active={active === filter} onPress={() => setActive(filter)} />)}
        </ScrollView>

        {loading ? <ActivityIndicator color={FateDropColors.violetLight} style={styles.state} /> : null}
        {error ? <Text style={styles.feedNote}>{error}</Text> : null}

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
              <StatusBadge label={`${filteredShops.length} nearby/listed`} color={FateDropColors.cyan} />
            </View>
            {filteredShops.map(shopCard)}
          </>
        ) : null}

        {filteredEvents.filter((event) => event.id !== featured?.id).length ? (
          <>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.heading}>Upcoming events</Text>
              <StatusBadge label={`${filteredEvents.length} events`} color={FateDropColors.amber} />
            </View>
            {filteredEvents.filter((event) => event.id !== featured?.id).map((event) => eventCard(event))}
          </>
        ) : null}

        {!loading && !filteredShops.length && !filteredEvents.length ? (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={28} color={FateDropColors.violetLight} />
            <Text style={styles.emptyTitle}>Nothing matches this view yet</Text>
            <Text style={styles.emptyText}>Try a wider radius or another filter. FateDrop will add smaller independent shops and upcoming event sources as the hosted Local Radar feed expands.</Text>
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  state: { marginTop: 35 },
  feedNote: { color: FateDropColors.amber, fontSize: 10, lineHeight: 16, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.amber}30`, backgroundColor: `${FateDropColors.amber}08`, marginTop: 4 },
  empty: { alignItems: 'center', padding: 26, borderRadius: 20, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginTop: 18 },
  emptyTitle: { color: FateDropColors.text, fontSize: 15, fontWeight: '900', marginTop: 10 },
  emptyText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 6 },
  pressed: { opacity: .8, transform: [{ scale: .99 }] },
});
