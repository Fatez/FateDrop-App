import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbstractHero, FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { isFeatureEnabled, type FeatureFlag } from '@/constants/features';
import { FateDropColors } from '@/constants/theme';

interface Destination {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href;
  color: string;
  feature?: FeatureFlag;
}

const destinations: Destination[] = [
  {
    title: 'Wishlist',
    subtitle: 'Products you want to keep across the network',
    icon: 'bookmark',
    path: '/(tabs)/watchlist',
    color: FateDropColors.violetLight,
  },
  {
    title: 'FateFind',
    subtitle: 'Create active product hunts with price and stock rules',
    icon: 'telescope',
    path: '/fatefind',
    color: FateDropColors.violetLight,
  },
  {
    title: 'True Price',
    subtitle: 'Compare known delivered cost and RRP context',
    icon: 'pricetags',
    path: '/true-price',
    color: FateDropColors.cyan,
  },
  {
    title: 'Local Radar',
    subtitle: 'Nearby shops, shows and trade nights',
    icon: 'navigate',
    path: '/local-radar',
    color: FateDropColors.blue,
    feature: 'localRadar',
  },
  {
    title: 'Fate Encounters',
    subtitle: 'Shows, tournaments and trade nights',
    icon: 'calendar',
    path: '/encounters',
    color: FateDropColors.amber,
  },
];

export default function MoreScreen() {
  const visible = destinations.filter((item) => !item.feature || isFeatureEnabled(item.feature));

  return (
    <SafeAreaView style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <FateDropHeader title="More" />
        <AbstractHero
          eyebrow="Your FateDrop"
          title="Everything secondary, kept out of the way."
          subtitle="Wishlist, active hunts, local discovery and events live here so Search, Indies and Alerts stay focused."
          icon="options"
        />

        <View style={styles.destinations}>
          {visible.map((item) => (
            <Pressable key={item.title} onPress={() => router.push(item.path)} style={styles.destination}>
              <View style={[styles.icon, { backgroundColor: `${item.color}14` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={FateDropColors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="layers-outline" size={18} color={FateDropColors.cyan} />
          <View style={styles.copy}>
            <Text style={styles.noteTitle}>Advanced systems stay behind the scenes</Text>
            <Text style={styles.noteText}>
              Retailer analytics, catalogue imports, monitor health, experimental scoring and future basket optimisation are not collector navigation items.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  destinations: { gap: 9 },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 17,
    backgroundColor: FateDropColors.glass,
    borderWidth: 1,
    borderColor: FateDropColors.border,
  },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: FateDropColors.text, fontWeight: '900', fontSize: 14 },
  subtitle: { color: FateDropColors.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  note: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: FateDropColors.border,
    backgroundColor: FateDropColors.glass,
    marginTop: 18,
  },
  noteTitle: { color: FateDropColors.text, fontSize: 12, fontWeight: '900' },
  noteText: { color: FateDropColors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
});
