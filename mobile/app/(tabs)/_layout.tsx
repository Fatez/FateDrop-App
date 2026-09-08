import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { FateNetworkCompass } from '@/components/fate-network-compass';
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

      <FateNetworkCompass visible={compassOpen} onClose={() => setCompassOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', height: 88, paddingTop: 9, paddingBottom: 22, backgroundColor: 'rgba(8,14,20,.985)', borderTopWidth: 1, borderTopColor: FateDropColors.border, elevation: 18, shadowOpacity: .38, shadowRadius: 20, shadowColor: '#000000' },
  tabLabel: { fontSize: 9, fontWeight: '800', letterSpacing: .35 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: FateDropColors.vanished, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  emblemSlot: { width: 74, height: 68, marginTop: -18, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: .76, transform: [{ scale: .97 }] },
});
