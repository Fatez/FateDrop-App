import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts } from '@/services/canonical-alerts';

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
  const { signedIn } = useFateDropId();
  const [alertCount, setAlertCount] = useState(0);
  const [toolboxOpen, setToolboxOpen] = useState(false);

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

  const openTool = (path: '/fatefind' | '/fate-match' | '/(tabs)/search') => {
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
        <Tabs.Screen name="tools" options={{
          title: '', tabBarLabel: () => null,
          tabBarButton: () => <Pressable accessibilityRole="button" accessibilityLabel="Open FateDrop tools" onPress={() => setToolboxOpen(true)} style={({ pressed }) => [styles.emblemButton, pressed && styles.pressed]}><Image source={require('../../assets/images/fatedrop-center-emblem.png')} style={styles.emblemImage} contentFit="contain" /></Pressable>,
        }} />
        <Tabs.Screen name="network" options={{ title: 'Network', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={21} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} /> }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="indies" options={{ href: null }} />
        <Tabs.Screen name="watchlist" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
      </Tabs>

      <Modal transparent visible={toolboxOpen} animationType="fade" onRequestClose={() => setToolboxOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setToolboxOpen(false)}>
          <Pressable style={styles.toolbox} onPress={() => undefined}>
            <View style={styles.toolboxBrand}>
              <Image source={require('../../assets/images/fatedrop-center-emblem.png')} style={styles.toolboxEmblem} contentFit="contain" />
              <View style={styles.toolboxBrandCopy}>
                <Text style={styles.toolboxEyebrow}>FATEDROP TOOLS</Text>
                <Text style={styles.toolboxTitle}>What do you want FateDrop to do?</Text>
                <Text style={styles.toolboxCopy}>Search discovers. Wishlist remembers. FateFind hunts. FateMatch means it was found.</Text>
              </View>
              <Pressable accessibilityLabel="Close tools" onPress={() => setToolboxOpen(false)} style={styles.close}><Ionicons name="close" size={18} color={FateDropColors.ivory} /></Pressable>
            </View>
            <ToolChoice icon="telescope-outline" title="FateFind" copy="Find the right deal now or keep hunting under your conditions. Verified RRP, visible True Price and one Cloud Fate Verdict." onPress={() => openTool('/fatefind')} />
            <ToolChoice icon="sparkles-outline" title="FateMatches" copy="Successful results from your FateFinds, plus the active finds still searching for you." onPress={() => openTool('/fate-match')} />
            <ToolChoice icon="search-outline" title="Search live database" copy="Browse current catalogue and retailer offers without starting a hunt." onPress={() => openTool('/(tabs)/search')} />
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
  homeMark: { width: 24, height: 23, alignItems: 'center', justifyContent: 'center' },
  homeRoof: { position: 'absolute', top: 1, width: 14, height: 14, borderLeftWidth: 2, borderTopWidth: 2, transform: [{ rotate: '45deg' }], borderRadius: 1 },
  homeBody: { position: 'absolute', bottom: 1, width: 16, height: 12, borderWidth: 2, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  homeDoor: { width: 4, height: 7, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  emblemButton: { width: 70, height: 70, marginTop: -18, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', shadowColor: '#000000', shadowOpacity: .34, shadowRadius: 12, elevation: 12 },
  emblemImage: { width: 66, height: 66 }, pressed: { opacity: .76, transform: [{ scale: .985 }] },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.68)' },
  toolbox: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: FateDropColors.border, backgroundColor: FateDropColors.shell, gap: 9 },
  toolboxBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 }, toolboxEmblem: { width: 50, height: 50 }, toolboxBrandCopy: { flex: 1 },
  toolboxEyebrow: { color: NAV_GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, toolboxTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 21, fontWeight: '700', marginTop: 2 }, toolboxCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.card },
  toolChoice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${NAV_GOLD}38`, backgroundColor: `${NAV_GOLD}0E` },
  toolCopy: { flex: 1 }, toolTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900' }, toolDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
