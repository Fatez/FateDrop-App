import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FilterChip, StatusBadge } from '@/components/fatedrop-ui';
import { API_BASE_URL } from '@/constants/api';
import { retailers } from '@/constants/retailers';
import { FateDropColors } from '@/constants/theme';
import { fateFindSummary, LocalFateFindRepository } from '@/services/fatefind';
import type { ProductCategory, ProductCondition, SavedSearch } from '@/types/domain';

const repository = new LocalFateFindRepository();
const categories: ProductCategory[] = ['SEALED', 'SINGLE', 'GRADED', 'ACCESSORY', 'PREORDER'];
const conditions: ProductCondition[] = ['NEW', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'GRADED'];
const frequencies: SavedSearch['frequency'][] = ['IMMEDIATE', 'DAILY', 'WEEKLY'];
const numberOrUndefined = (value: string) => {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
};
const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function FateFindScreen() {
  const params = useLocalSearchParams<{ query?: string | string[]; maxDelivered?: string | string[]; maxItem?: string | string[] }>();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dependencies, setDependencies] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string>();
  const [query, setQuery] = useState('');
  const [maxItem, setMaxItem] = useState('');
  const [maxDelivered, setMaxDelivered] = useState('');
  const [distance, setDistance] = useState('');
  const [category, setCategory] = useState<ProductCategory>();
  const [condition, setCondition] = useState<ProductCondition>();
  const [preferred, setPreferred] = useState<string[]>([]);
  const [includePreorders, setIncludePreorders] = useState(false);
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [frequency, setFrequency] = useState<SavedSearch['frequency']>('IMMEDIATE');

  useEffect(() => {
    const incomingQuery = firstParam(params.query);
    const incomingDelivered = firstParam(params.maxDelivered);
    const incomingItem = firstParam(params.maxItem);
    if (incomingQuery) setQuery(incomingQuery);
    if (incomingDelivered) setMaxDelivered(incomingDelivered);
    if (incomingItem) setMaxItem(incomingItem);
  }, [params.maxDelivered, params.maxItem, params.query]);

  const reset = () => {
    setEditingId(undefined);
    setQuery('');
    setMaxItem('');
    setMaxDelivered('');
    setDistance('');
    setCategory(undefined);
    setCondition(undefined);
    setPreferred([]);
    setIncludePreorders(false);
    setCollectionOnly(false);
    setInStockOnly(true);
    setNotifications(true);
    setFrequency('IMMEDIATE');
  };

  const calculate = async (search: SavedSearch) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fatefind/matches`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(search),
      });
      const data = await response.json();
      setCounts((current) => ({ ...current, [search.id]: data.total || 0 }));
      setDependencies((current) => ({ ...current, [search.id]: data.missingDependencies || [] }));
    } catch {
      setCounts((current) => ({ ...current, [search.id]: 0 }));
    }
  };

  const load = useCallback(() => {
    void repository.list().then((saved) => {
      setItems(saved);
      saved.forEach((item) => void calculate(item));
    });
  }, []);

  useFocusEffect(load);

  const edit = (item: SavedSearch) => {
    setEditingId(item.id);
    setQuery(item.query || '');
    setMaxItem(item.maximumItemPriceGbp?.toString() || '');
    setMaxDelivered(item.maximumDeliveredPriceGbp?.toString() || '');
    setDistance(item.maximumDistanceMiles?.toString() || '');
    setCategory(item.category);
    setCondition(item.condition);
    setPreferred(item.preferredRetailerIds);
    setIncludePreorders(item.includePreorders);
    setCollectionOnly(item.collectionOnly);
    setInStockOnly(item.inStockOnly);
    setNotifications(item.notificationsEnabled);
    setFrequency(item.frequency);
  };

  const save = async () => {
    if (!query.trim()) return;
    const existing = items.find((item) => item.id === editingId);
    const now = new Date().toISOString();
    const search: SavedSearch = {
      id: editingId || `ff-${Date.now()}`,
      name: query.trim(),
      query: query.trim(),
      maximumItemPriceGbp: numberOrUndefined(maxItem),
      maximumDeliveredPriceGbp: numberOrUndefined(maxDelivered),
      preferredRetailerIds: preferred,
      ukOnly: true,
      maximumDistanceMiles: numberOrUndefined(distance),
      condition,
      category,
      includePreorders,
      collectionOnly,
      inStockOnly,
      notificationsEnabled: notifications,
      frequency,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await repository.save(search);
    // Product Spec v1: FateFind is an active hunt, not a Wishlist row.
    reset();
    load();
  };

  const toggleRetailer = (id: string) => setPreferred((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={FateDropColors.text} /><Text style={styles.backText}>Back</Text></Pressable>
        <AbstractHero eyebrow="FateFind" title="Tell FateDrop what to find." subtitle="Create an active hunt using product, True Price, retailer, condition and availability rules." icon="telescope" />
        <View style={styles.local}><Ionicons name="information-circle" size={17} color={FateDropColors.amber} /><Text style={styles.localText}>Current match counts are calculated on request. Persistent hosted FateFind monitoring will replace this local foundation when FateDrop ID/app authentication is connected.</Text></View>

        <Text style={styles.heading}>{editingId ? 'Edit FateFind' : 'Create FateFind'}</Text>
        <View style={styles.form}>
          <Field value={query} onChange={setQuery} placeholder="Product or search term" />
          <View style={styles.two}>
            <Field value={maxItem} onChange={setMaxItem} placeholder="Max item £" numeric />
            <Field value={maxDelivered} onChange={setMaxDelivered} placeholder="Max True Price £" numeric />
          </View>
          <Field value={distance} onChange={setDistance} placeholder="Maximum distance miles" numeric />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>{categories.map((value) => <FilterChip key={value} label={value.replaceAll('_', ' ')} active={category === value} onPress={() => setCategory(category === value ? undefined : value)} />)}</View>

          <Text style={styles.label}>Condition</Text>
          <View style={styles.chips}>{conditions.map((value) => <FilterChip key={value} label={value.replaceAll('_', ' ')} active={condition === value} onPress={() => setCondition(condition === value ? undefined : value)} />)}</View>

          <Text style={styles.label}>Preferred retailers</Text>
          <View style={styles.chips}>{retailers.filter((item) => !item.isDemo).map((item) => <FilterChip key={item.id} label={item.name} active={preferred.includes(item.id)} onPress={() => toggleRetailer(item.id)} />)}</View>

          <Text style={styles.label}>Options</Text>
          <View style={styles.chips}>
            <FilterChip label="UK sellers" active />
            <FilterChip label="In stock" active={inStockOnly} onPress={() => setInStockOnly((value) => !value)} />
            <FilterChip label="Collection only" active={collectionOnly} onPress={() => setCollectionOnly((value) => !value)} />
            <FilterChip label="Include preorders" active={includePreorders} onPress={() => setIncludePreorders((value) => !value)} />
            <FilterChip label="Notifications" active={notifications} onPress={() => setNotifications((value) => !value)} />
          </View>

          <Text style={styles.label}>Notification frequency</Text>
          <View style={styles.chips}>{frequencies.map((value) => <FilterChip key={value} label={value} active={frequency === value} onPress={() => setFrequency(value)} />)}</View>

          <View style={styles.formActions}>
            <Pressable onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>{editingId ? 'Update FateFind' : 'Save FateFind'}</Text></Pressable>
            {editingId ? <Pressable onPress={reset} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable> : null}
          </View>
        </View>

        <Text style={styles.heading}>Saved hunts</Text>
        {items.length ? items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.summary}>{fateFindSummary(item)}</Text>
              <Text style={styles.source}>{counts[item.id] ?? '…'} current matches · on-request evaluation</Text>
              {dependencies[item.id]?.length ? <Text style={styles.dependency}>Cannot evaluate: {dependencies[item.id].join(', ')}</Text> : null}
            </View>
            {item.notificationsEnabled ? <StatusBadge label="Alerts on" color={FateDropColors.mint} /> : null}
            <View style={styles.cardActions}>
              <Pressable accessibilityLabel={`Edit ${item.name}`} onPress={() => edit(item)}><Ionicons name="create-outline" size={18} color={FateDropColors.cyan} /></Pressable>
              <Pressable accessibilityLabel={`Delete ${item.name}`} onPress={() => void repository.remove(item.id).then(load)}><Ionicons name="trash-outline" size={18} color={FateDropColors.coral} /></Pressable>
            </View>
          </View>
        )) : <Text style={styles.empty}>No FateFind hunts yet.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ value, onChange, placeholder, numeric = false }: { value: string; onChange: (value: string) => void; placeholder: string; numeric?: boolean }) {
  return <TextInput value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={placeholder} placeholderTextColor={FateDropColors.muted} style={styles.input} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 80 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 },
  backText: { color: FateDropColors.text, fontWeight: '800' },
  local: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 15, backgroundColor: `${FateDropColors.amber}10`, borderWidth: 1, borderColor: `${FateDropColors.amber}33` },
  localText: { flex: 1, color: FateDropColors.secondary, fontSize: 10, lineHeight: 16 },
  heading: { color: FateDropColors.text, fontSize: 19, fontWeight: '900', marginVertical: 16 },
  form: { gap: 9, padding: 14, borderRadius: 18, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border },
  two: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, color: FateDropColors.text, padding: 12, borderRadius: 13, backgroundColor: FateDropColors.cardElevated },
  label: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  save: { flex: 1, alignItems: 'center', padding: 13, borderRadius: 13, backgroundColor: FateDropColors.violet },
  saveText: { color: FateDropColors.text, fontWeight: '900' },
  cancel: { padding: 13, borderRadius: 13, borderWidth: 1, borderColor: FateDropColors.border },
  cancelText: { color: FateDropColors.secondary, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, backgroundColor: FateDropColors.glass, borderWidth: 1, borderColor: FateDropColors.border, marginBottom: 9 },
  name: { color: FateDropColors.text, fontWeight: '900' },
  summary: { color: FateDropColors.secondary, fontSize: 11, marginTop: 4 },
  source: { color: FateDropColors.amber, fontSize: 9, marginTop: 5 },
  dependency: { color: FateDropColors.coral, fontSize: 9, marginTop: 4 },
  cardActions: { gap: 12 },
  empty: { color: FateDropColors.muted, textAlign: 'center', margin: 30 },
});
