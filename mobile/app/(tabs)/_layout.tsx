import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';

import { FateDropColors } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts } from '@/services/canonical-alerts';

export default function TabLayout() {
  const { signedIn } = useFateDropId();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let active = true;
    if (!signedIn) {
      setAlertCount(0);
      return () => { active = false; };
    }
    void fetchCanonicalAlerts(100)
      .then((alerts) => { if (active) setAlertCount(alerts.length); })
      .catch(() => { if (active) setAlertCount(0); });
    return () => { active = false; };
  }, [signedIn]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: FateDropColors.violetLight,
        tabBarInactiveTintColor: FateDropColors.inactive,
        tabBarStyle: {
          position: 'absolute',
          height: 88,
          paddingTop: 10,
          paddingBottom: 24,
          backgroundColor: 'rgba(13, 15, 24, 0.98)',
          borderTopWidth: 1,
          borderTopColor: FateDropColors.border,
          elevation: 18,
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowColor: '#000000',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        sceneStyle: {
          backgroundColor: FateDropColors.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="indies"
        options={{
          title: 'Retailers',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
          tabBarBadge: alertCount > 0 ? (alertCount > 99 ? '99+' : alertCount) : undefined,
          tabBarBadgeStyle: {
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: FateDropColors.violetLight,
            color: FateDropColors.text,
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />

      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
