import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { countUnreadCanonicalAlerts, subscribeCanonicalAlertReadState } from '@/services/canonical-alerts';
import {
  peekCanonicalAlertReadBasis,
  queryCanonicalAlertReadBasis,
  revalidateStaleCanonicalAlertQueries,
  subscribeCanonicalAlertQueryCache,
  type CanonicalAlertReadBasisQuery,
} from '@/services/canonical-alert-query';

const NAV_GOLD = FateDropColors.goldBright;

type NetworkPath = '/fatefind' | '/fate-match' | '/fate-trader' | '/local-radar' | '/(tabs)/indies' | '/(tabs)/watchlist';

export default function TabLayout() {
  const { signedIn, snapshot } = useFateDropId();
  const [alertCount, setAlertCount] = useState(0);
  const [compassOpen, setCompassOpen] = useState(false);
  const userId = snapshot?.user?.id ?? null;
  const selectedTcgCodes = useMemo(() => snapshot?.tcgPreferences?.selectedTcgCodes ?? ['pokemon'], [snapshot?.tcgPreferences?.selectedTcgCodes]);
  const alertFilterKey = useMemo(() => JSON.stringify({
    notificationUpdatedAt: snapshot?.notificationPreferences?.updatedAt ?? 0,
    tcgAlertPreferences: snapshot?.tcgPreferences?.alertPreferences ?? null,
  }), [snapshot?.notificationPreferences?.updatedAt, snapshot?.tcgPreferences?.alertPreferences]);
  const readBasisQuery = useMemo<CanonicalAlertReadBasisQuery | null>(() => userId ? ({
    accountId: userId,
    selectedTcgCodes,
    filterKey: alertFilterKey,
  }) : null, [alertFilterKey, selectedTcgCodes, userId]);

  const refreshAlertCount = useCallback(async (allowNetwork = true) => {
    if (!signedIn || !userId || !readBasisQuery) {
      setAlertCount(0);
      return;
    }
    const cached = peekCanonicalAlertReadBasis(readBasisQuery);
    if (cached.data) setAlertCount(await countUnreadCanonicalAlerts(userId, cached.data));
    if (!allowNetwork || (cached.data !== undefined && cached.fresh)) return;
    try {
      const basis = await queryCanonicalAlertReadBasis(readBasisQuery);
      setAlertCount(await countUnreadCanonicalAlerts(userId, basis));
    } catch {
      if (cached.data === undefined) setAlertCount(0);
    }
  }, [readBasisQuery, signedIn, userId]);

  useEffect(() => {
    if (!signedIn || !userId || !readBasisQuery) {
      return;
    }

    void Promise.resolve().then(() => refreshAlertCount(true));
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void revalidateStaleCanonicalAlertQueries(userId).then(() => refreshAlertCount(false));
    });
    const unsubscribeReadState = subscribeCanonicalAlertReadState((changedUserId) => {
      if (changedUserId === userId) void refreshAlertCount(false);
    });
    const unsubscribeCache = subscribeCanonicalAlertQueryCache(() => { void refreshAlertCount(false); });

    return () => {
      appStateSubscription.remove();
      unsubscribeReadState();
      unsubscribeCache();
    };
  }, [readBasisQuery, refreshAlertCount, signedIn, userId]);

  const visibleAlertCount = signedIn && userId && readBasisQuery ? alertCount : 0;

  const openTool = (path: NetworkPath) => {
    setCompassOpen(false);
    router.push(path);
  };

  return (
    <>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: NAV_GOLD,
        tabBarInactiveTintColor: NAV_GOLD,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: { paddingVertical: 0 },
        sceneStyle: { backgroundColor: FateDropColors.background },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home-sharp" size={20} color={color} /> }} />
        <Tabs.Screen name="alerts" options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={20} color={color} />,
          tabBarBadge: visibleAlertCount > 0 ? (visibleAlertCount > 99 ? '99+' : visibleAlertCount) : undefined,
          tabBarBadgeStyle: styles.badge,
        }} />
        <Tabs.Screen
          name="tools"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setCompassOpen(true);
            },
          }}
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarAccessibilityLabel: 'Open Fate Network compass',
            tabBarIcon: () => <View style={styles.emblemSlot}><FateDropNavEmblem size={48} /></View>,
          }}
        />
        <Tabs.Screen name="market" options={{ title: 'Fate Market', tabBarIcon: ({ color }) => <Ionicons name="analytics-outline" size={20} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={20} color={color} /> }} />
        <Tabs.Screen name="network" options={{ href: null }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="indies" options={{ href: null }} />
        <Tabs.Screen name="watchlist" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
      </Tabs>

      <Modal transparent visible={compassOpen} animationType="fade" onRequestClose={() => setCompassOpen(false)}>
        <Pressable style={styles.compassBackdrop} onPress={() => setCompassOpen(false)}>
          <View style={styles.compassHeader} pointerEvents="none">
            <Text style={styles.compassEyebrow}>FATE NETWORK</Text>
            <Text style={styles.compassTitle}>Choose your direction</Text>
          </View>

          <Pressable style={styles.compassStage} onPress={() => undefined}>
            <View pointerEvents="none" style={styles.outerRing} />
            <View pointerEvents="none" style={styles.innerRing} />
            <View pointerEvents="none" style={styles.northLine} />
            <View pointerEvents="none" style={styles.westLine} />
            <View pointerEvents="none" style={styles.eastLine} />

            <View style={styles.nodeNorth}>
              <CompassNode icon="notifications-outline" title="FateMatch" detail="Monitor" onPress={() => openTool('/fate-match')} />
            </View>
            <View style={styles.nodeNorthWest}>
              <CompassNode icon="swap-horizontal-outline" title="Trader" detail="Trade" onPress={() => openTool('/fate-trader')} />
            </View>
            <View style={styles.nodeNorthEast}>
              <CompassNode icon="navigate-outline" title="Local Radar" detail="Nearby" onPress={() => openTool('/local-radar')} />
            </View>
            <View style={styles.nodeWest}>
              <CompassNode icon="storefront-outline" title="Retailers" detail="Discover" onPress={() => openTool('/(tabs)/indies')} />
            </View>
            <View style={styles.nodeEast}>
              <CompassNode icon="bookmark-outline" title="Wishlist" detail="Save" onPress={() => openTool('/(tabs)/watchlist')} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open FateFind"
              onPress={() => openTool('/fatefind')}
              style={({ pressed }) => [styles.fateFindCenter, pressed && styles.pressed]}>
              <View style={styles.fateFindGlow} />
              <FateDropNavEmblem size={58} />
              <Text style={styles.fateFindEyebrow}>MAIN FEATURE</Text>
              <Text style={styles.fateFindTitle}>FateFind</Text>
              <Text style={styles.fateFindDetail}>Find it now</Text>
            </Pressable>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel="Close Fate Network compass" onPress={() => setCompassOpen(false)} style={styles.closeCompass}>
            <Ionicons name="close" size={18} color={FateDropColors.ivory} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function CompassNode({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.compassNode, pressed && styles.pressed]}>
      <View style={styles.compassNodeIcon}><Ionicons name={icon} size={20} color={NAV_GOLD} /></View>
      <Text style={styles.compassNodeTitle}>{title}</Text>
      <Text style={styles.compassNodeDetail}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', height: 88, paddingTop: 9, paddingBottom: 22, backgroundColor: 'rgba(8,14,20,.985)', borderTopWidth: 1, borderTopColor: FateDropColors.border, elevation: 18, shadowOpacity: .38, shadowRadius: 20, shadowColor: '#000000' },
  tabLabel: { fontSize: 9, fontWeight: '800', letterSpacing: .35 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: FateDropColors.vanished, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  emblemSlot: { width: 74, height: 68, marginTop: -18, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: .76, transform: [{ scale: .97 }] },

  compassBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(2,5,9,.82)' },
  compassHeader: { position: 'absolute', bottom: 388, alignItems: 'center', paddingHorizontal: 24 },
  compassEyebrow: { color: NAV_GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  compassTitle: { color: FateDropColors.ivory, fontSize: 18, fontWeight: '900', marginTop: 4 },
  compassStage: { width: '100%', maxWidth: 420, height: 372, overflow: 'hidden' },
  outerRing: { position: 'absolute', width: 330, height: 330, borderRadius: 165, borderWidth: 1, borderColor: `${NAV_GOLD}35`, left: '50%', bottom: -84, transform: [{ translateX: -165 }], backgroundColor: 'rgba(10,16,24,.34)' },
  innerRing: { position: 'absolute', width: 234, height: 234, borderRadius: 117, borderWidth: 1, borderColor: `${FateDropColors.manifested}30`, left: '50%', bottom: -35, transform: [{ translateX: -117 }] },
  northLine: { position: 'absolute', width: 1, height: 190, backgroundColor: `${NAV_GOLD}28`, left: '50%', bottom: 92 },
  westLine: { position: 'absolute', width: 150, height: 1, backgroundColor: `${NAV_GOLD}20`, left: 26, bottom: 121, transform: [{ rotate: '18deg' }] },
  eastLine: { position: 'absolute', width: 150, height: 1, backgroundColor: `${NAV_GOLD}20`, right: 26, bottom: 121, transform: [{ rotate: '-18deg' }] },

  nodeNorth: { position: 'absolute', top: 17, left: '50%', transform: [{ translateX: -42 }] },
  nodeNorthWest: { position: 'absolute', top: 77, left: 45 },
  nodeNorthEast: { position: 'absolute', top: 77, right: 45 },
  nodeWest: { position: 'absolute', top: 177, left: 15 },
  nodeEast: { position: 'absolute', top: 177, right: 15 },
  compassNode: { width: 84, alignItems: 'center' },
  compassNodeIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${NAV_GOLD}55`, backgroundColor: 'rgba(15,22,31,.96)', alignItems: 'center', justifyContent: 'center', shadowColor: NAV_GOLD, shadowOpacity: .16, shadowRadius: 10 },
  compassNodeTitle: { color: FateDropColors.ivory, fontSize: 10, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  compassNodeDetail: { color: FateDropColors.muted, fontSize: 8, fontWeight: '700', textAlign: 'center', marginTop: 1 },

  fateFindCenter: { position: 'absolute', width: 116, height: 116, borderRadius: 58, left: '50%', bottom: 26, transform: [{ translateX: -58 }], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${NAV_GOLD}88`, backgroundColor: 'rgba(8,14,20,.99)', shadowColor: NAV_GOLD, shadowOpacity: .28, shadowRadius: 20, elevation: 18 },
  fateFindGlow: { position: 'absolute', width: 136, height: 136, borderRadius: 68, borderWidth: 1, borderColor: `${FateDropColors.manifested}30` },
  fateFindEyebrow: { color: NAV_GOLD, fontSize: 6.5, fontWeight: '900', letterSpacing: .8, marginTop: -2 },
  fateFindTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900', marginTop: 1 },
  fateFindDetail: { color: FateDropColors.secondary, fontSize: 8, fontWeight: '700', marginTop: 1 },
  closeCompass: { position: 'absolute', right: 18, bottom: 352, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
});
