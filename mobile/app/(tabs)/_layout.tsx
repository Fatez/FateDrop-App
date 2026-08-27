import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { countUnreadCanonicalAlerts, fetchCanonicalAlerts, subscribeCanonicalAlertReadState } from '@/services/canonical-alerts';

const NAV_GOLD = FateDropColors.goldBright;

function HomeMark({ focused }: { focused: boolean }) {
  return (
    <View style={styles.homeMark}>
      <View style={[styles.homeRoof, { borderColor: NAV_GOLD, opacity: focused ? 1 : .82 }]} />
      <View style={[styles.homeBody, { borderColor: NAV_GOLD, opacity: focused ? 1 : .82 }]}>
        <View style={[styles.homeDoor, { backgroundColor: NAV_GOLD }]} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { signedIn, snapshot } = useFateDropId();
  const [alertCount, setAlertCount] = useStateCompat(0);
  const userId = snapshot?.user?.id ?? null;

  const refreshAlertCount = useCallback(async () => {
    if (!signedIn || !userId) {
      setAlertCount(0);
      return;
    }
    try {
      const alerts = await fetchCanonicalAlerts(100);
      setAlertCount(await countUnreadCanonicalAlerts(userId, alerts));
    } catch {
      setAlertCount(0);
    }
  }, [signedIn, userId]);

  useEffect(() => {
    if (!signedIn || !userId) {
      setAlertCount(0);
      return;
    }

    void refreshAlertCount();
    const interval = setInterval(() => { void refreshAlertCount(); }, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAlertCount();
    });
    const unsubscribeReadState = subscribeCanonicalAlertReadState((changedUserId) => {
      if (changedUserId === userId) void refreshAlertCount();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      unsubscribeReadState();
    };
  }, [refreshAlertCount, signedIn, userId]);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: NAV_GOLD,
      tabBarInactiveTintColor: NAV_GOLD,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
      tabBarItemStyle: { paddingVertical: 3 },
      sceneStyle: { backgroundColor: FateDropColors.background },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <HomeMark focused={focused} /> }} />
      <Tabs.Screen name="alerts" options={{
        title: 'Alerts',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={21} color={color} />,
        tabBarBadge: alertCount > 0 ? (alertCount > 99 ? '99+' : alertCount) : undefined,
        tabBarBadgeStyle: styles.badge,
      }} />
      <Tabs.Screen
        name="tools"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push('/tools');
          },
        }}
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => <View style={styles.emblemSlot}><FateDropNavEmblem size={62} /></View>,
        }}
      />
      <Tabs.Screen name="network" options={{ title: 'Live Network', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={21} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} /> }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="indies" options={{ href: null }} />
      <Tabs.Screen name="watchlist" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}

// Keep the unread-alert state local to the tab shell while avoiding a second
// Fate Network menu implementation. This wrapper exists only to keep the
// component's state declaration compact.
function useStateCompat(initialValue: number) {
  const React = require('react') as typeof import('react');
  return React.useState(initialValue);
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', height: 88, paddingTop: 9, paddingBottom: 22, backgroundColor: 'rgba(8,14,20,.985)', borderTopWidth: 1, borderTopColor: FateDropColors.border, elevation: 18, shadowOpacity: .38, shadowRadius: 20, shadowColor: '#000000' },
  tabLabel: { fontSize: 9, fontWeight: '800', letterSpacing: .35 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: FateDropColors.vanished, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  homeMark: { width: 24, height: 23, alignItems: 'center', justifyContent: 'center' },
  homeRoof: { position: 'absolute', top: 1, width: 14, height: 14, borderLeftWidth: 2, borderTopWidth: 2, transform: [{ rotate: '45deg' }], borderRadius: 1 },
  homeBody: { position: 'absolute', bottom: 1, width: 16, height: 12, borderWidth: 2, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  homeDoor: { width: 4, height: 7, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  emblemSlot: { width: 76, height: 76, marginTop: -24, alignItems: 'center', justifyContent: 'center' },
});
