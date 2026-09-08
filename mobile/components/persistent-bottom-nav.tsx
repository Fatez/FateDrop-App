import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, useSegments } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateNetworkCompass } from '@/components/fate-network-compass';
import { FateDropColors } from '@/constants/theme';

const ROOT_DOCK_PREFIXES = [
  '/fatefind', '/fate-match', '/fate-trader', '/fate-pulse', '/local-radar', '/encounters', '/retailers/',
  '/notification-preferences', '/dashboard', '/demo', '/tools',
  '/collections', '/collection', '/binders', '/binder/', '/graded-collection', '/fate-price',
  '/account', '/profile-customisation', '/stories', '/pokemon-center-uk', '/retailer-dashboard', '/retailer-partners',
  '/event-vendors', '/manual-echo-intake', '/fatescore', '/reserve-demo', '/basket-breaker', '/fatebounty', '/demand-signal', '/true-price',
];

function DockItem({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.item}>
      <Ionicons name={icon} size={20} color={FateDropColors.goldBright} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function PersistentBottomNav() {
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [compassOpen, setCompassOpen] = useState(false);
  if (segments[0] === '(tabs)' || !ROOT_DOCK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return null;

  return (
    <><View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 13) }]}>
      <DockItem label="Home" icon="home-sharp" onPress={() => router.replace('/')} />
      <DockItem label="Alerts" icon="notifications-outline" onPress={() => router.replace('/(tabs)/alerts')} />
      <Pressable accessibilityRole="button" accessibilityLabel="Open Fate Network" onPress={() => setCompassOpen(true)} style={styles.emblemButton}>
        <FateDropNavEmblem size={48} />
      </Pressable>
      <DockItem label="Fate Market" icon="analytics-outline" onPress={() => router.replace({ pathname: '/(tabs)/market', params: { area: 'pulse' } })} />
      <DockItem label="Profile" icon="person-outline" onPress={() => router.replace('/(tabs)/profile')} />
    </View><FateNetworkCompass visible={compassOpen} onClose={() => setCompassOpen(false)} /></>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 88, paddingTop: 9, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(8,14,20,.985)', borderTopWidth: 1, borderTopColor: FateDropColors.border, zIndex: 100 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 50 },
  label: { color: FateDropColors.goldBright, fontSize: 9, fontWeight: '800', letterSpacing: .35 },
  emblemButton: { width: 74, height: 68, marginTop: -18, alignItems: 'center', justifyContent: 'center' },
});
