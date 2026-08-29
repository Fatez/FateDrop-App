import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { countUnreadCanonicalAlerts, fetchCanonicalAlerts, subscribeCanonicalAlertInboxChanged, subscribeCanonicalAlertReadState } from '@/services/canonical-alerts';

const NAV_GOLD = FateDropColors.goldBright;

export default function TabLayout() {
  const { signedIn, snapshot } = useFateDropId();
  const [alertCount, setAlertCount] = useState(0);
  const [toolboxOpen, setToolboxOpen] = useState(false);
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
      // Keep the last known unread count through a transient inbox failure.
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
    const unsubscribeInbox = subscribeCanonicalAlertInboxChanged(() => {
      void refreshAlertCount();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      unsubscribeReadState();
      unsubscribeInbox();
    };
  }, [refreshAlertCount, signedIn, userId]);

  const openTool = (path: '/fatefind' | '/fate-match' | '/fate-trader' | '/local-radar' | '/(tabs)/indies' | '/(tabs)/search' | '/(tabs)/watchlist') => {
    setToolboxOpen(false);
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
          tabBarBadge: alertCount > 0 ? (alertCount > 99 ? '99+' : alertCount) : undefined,
          tabBarBadgeStyle: styles.badge,
        }} />
        <Tabs.Screen
          name="tools"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setToolboxOpen(true);
            },
          }}
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarIcon: () => <View style={styles.emblemSlot}><FateDropNavEmblem size={48} /></View>,
          }}
        />
        <Tabs.Screen name="network" options={{ title: 'Live Network', tabBarIcon: ({ color }) => <Ionicons name="pulse-outline" size={20} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={20} color={color} /> }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="indies" options={{ href: null }} />
        <Tabs.Screen name="watchlist" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
      </Tabs>

      <Modal transparent visible={toolboxOpen} animationType="fade" onRequestClose={() => setToolboxOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setToolboxOpen(false)}>
          <Pressable style={styles.toolbox} onPress={() => undefined}>
            <View style={styles.toolboxBrand}>
              <FateDropNavEmblem size={52} />
              <View style={styles.toolboxBrandCopy}>
                <Text style={styles.toolboxEyebrow}>FATE NETWORK</Text>
                <Text style={styles.toolboxTitle}>What do you want FateDrop to do?</Text>
                <Text style={styles.toolboxCopy}>Value finder, monitoring, trading, local intelligence and retailer discovery — one network, one Cloud truth.</Text>
              </View>
              <Pressable accessibilityLabel="Close Fate Network" onPress={() => setToolboxOpen(false)} style={styles.close}><Ionicons name="close" size={18} color={FateDropColors.ivory} /></Pressable>
            </View>
            <ToolChoice icon="telescope-outline" title="FateFind" copy="Find the strongest qualifying place to buy this product." onPress={() => openTool('/fatefind')} />
            <ToolChoice icon="notifications-outline" title="FateMatch" copy="Monitor products and the conditions you care about." onPress={() => openTool('/fate-match')} />
            <ToolChoice icon="swap-horizontal-outline" title="Fate Trader" copy="Manage HAVE / WANT trade intentions and compatible collector opportunities." onPress={() => openTool('/fate-trader')} />
            <ToolChoice icon="navigate-outline" title="Local Radar" copy="See what is happening physically around you, including branch intelligence and events." onPress={() => openTool('/local-radar')} />
            <ToolChoice icon="storefront-outline" title="Retailers" copy="Browse major retailers, TCG specialists and independent or local storefronts." onPress={() => openTool('/(tabs)/indies')} />
            <ToolChoice icon="search-outline" title="Search live database" copy="Browse the current network without starting monitoring." onPress={() => openTool('/(tabs)/search')} />
            <ToolChoice icon="bookmark-outline" title="Wishlist" copy="Remember products without turning monitoring on." onPress={() => openTool('/(tabs)/watchlist')} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ToolChoice({ icon, title, copy, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.toolChoice, pressed && styles.pressed]}><View style={styles.toolIcon}><Ionicons name={icon} size={21} color={NAV_GOLD} /></View><View style={styles.toolCopy}><Text style={styles.toolTitle}>{title}</Text><Text style={styles.toolDetail}>{copy}</Text></View><Ionicons name="chevron-forward" size={17} color={NAV_GOLD} /></Pressable>;
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', height: 88, paddingTop: 9, paddingBottom: 22, backgroundColor: 'rgba(8,14,20,.985)', borderTopWidth: 1, borderTopColor: FateDropColors.border, elevation: 18, shadowOpacity: .38, shadowRadius: 20, shadowColor: '#000000' },
  tabLabel: { fontSize: 9, fontWeight: '800', letterSpacing: .35 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: FateDropColors.vanished, color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  emblemSlot: { width: 74, height: 68, marginTop: -18, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: .76, transform: [{ scale: .985 }] },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.68)' },
  toolbox: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: FateDropColors.border, backgroundColor: FateDropColors.shell, gap: 9 },
  toolboxBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 }, toolboxBrandCopy: { flex: 1 },
  toolboxEyebrow: { color: NAV_GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, toolboxTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 21, fontWeight: '700', marginTop: 2 }, toolboxCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  toolChoice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${NAV_GOLD}38`, backgroundColor: `${NAV_GOLD}0E` },
  toolCopy: { flex: 1 }, toolTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900' }, toolDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
