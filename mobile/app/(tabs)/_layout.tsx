import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchCanonicalAlerts } from '@/services/canonical-alerts';

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
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: FateDropColors.goldBright,
          tabBarInactiveTintColor: FateDropColors.inactive,
          tabBarStyle: {
            position: 'absolute',
            height: 88,
            paddingTop: 9,
            paddingBottom: 22,
            backgroundColor: 'rgba(8, 14, 20, 0.985)',
            borderTopWidth: 1,
            borderTopColor: FateDropColors.border,
            elevation: 18,
            shadowOpacity: 0.38,
            shadowRadius: 20,
            shadowColor: '#000000',
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 0.35,
          },
          tabBarItemStyle: { paddingVertical: 3 },
          sceneStyle: { backgroundColor: FateDropColors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={21} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={21} color={color} />
            ),
            tabBarBadge: alertCount > 0 ? (alertCount > 99 ? '99+' : alertCount) : undefined,
            tabBarBadgeStyle: {
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: FateDropColors.vanished,
              color: '#FFFFFF',
              fontSize: 9,
              fontWeight: '800',
            },
          }}
        />

        <Tabs.Screen
          name="tools"
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarButton: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open FateDrop tools"
                onPress={() => setToolboxOpen(true)}
                style={({ pressed }) => [styles.emblemButton, pressed && styles.pressed]}
              >
                <View style={styles.emblemHalo}>
                  <Image
                    source={require('../../assets/images/fatedrop-emblem.webp')}
                    style={styles.emblemImage}
                    contentFit="contain"
                  />
                </View>
              </Pressable>
            ),
          }}
        />

        <Tabs.Screen
          name="network"
          options={{
            title: 'Network',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={21} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} />
            ),
          }}
        />

        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="indies" options={{ href: null }} />
        <Tabs.Screen name="watchlist" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
      </Tabs>

      <Modal transparent visible={toolboxOpen} animationType="fade" onRequestClose={() => setToolboxOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setToolboxOpen(false)}>
          <Pressable style={styles.toolbox} onPress={() => undefined}>
            <View style={styles.toolboxBrand}>
              <Image
                source={require('../../assets/images/fatedrop-emblem.webp')}
                style={styles.toolboxEmblem}
                contentFit="contain"
              />
              <View style={styles.toolboxBrandCopy}>
                <Text style={styles.toolboxEyebrow}>FATEDROP TOOLS</Text>
                <Text style={styles.toolboxTitle}>What do you want FateDrop to do?</Text>
                <Text style={styles.toolboxCopy}>Choose the job. The intelligence stays shared underneath.</Text>
              </View>
              <Pressable accessibilityLabel="Close tools" onPress={() => setToolboxOpen(false)} style={styles.close}>
                <Ionicons name="close" size={18} color={FateDropColors.ivory} />
              </Pressable>
            </View>

            <ToolChoice
              icon="telescope-outline"
              title="FateFind"
              copy="Search live offers, compare value and get the Fate Verdict for the strongest deal now."
              onPress={() => openTool('/fatefind')}
            />
            <ToolChoice
              icon="radio-outline"
              title="FateMatch"
              copy="Set your product and price rules. FateDrop watches until an offer genuinely qualifies."
              onPress={() => openTool('/fate-match')}
            />
            <ToolChoice
              icon="search-outline"
              title="Search live database"
              copy="Browse the current FateDrop catalogue and retailer offers without starting a hunt."
              onPress={() => openTool('/(tabs)/search')}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ToolChoice({
  icon,
  title,
  copy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toolChoice, pressed && styles.pressed]}>
      <View style={styles.toolIcon}>
        <Ionicons name={icon} size={21} color={FateDropColors.goldBright} />
      </View>
      <View style={styles.toolCopy}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolDetail}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={FateDropColors.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emblemButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  emblemHalo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginTop: -17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FateDropColors.ink,
    borderWidth: 1,
    borderColor: FateDropColors.gold,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  emblemImage: { width: 47, height: 47 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,.68)',
  },
  toolbox: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: FateDropColors.border,
    backgroundColor: FateDropColors.shell,
    gap: 9,
  },
  toolboxBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  toolboxEmblem: { width: 50, height: 50 },
  toolboxBrandCopy: { flex: 1 },
  toolboxEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  toolboxTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 21, fontWeight: '700', marginTop: 2 },
  toolboxCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: FateDropColors.borderSoft,
    backgroundColor: FateDropColors.card,
  },
  toolChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: FateDropColors.borderSoft,
    backgroundColor: FateDropColors.surface,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${FateDropColors.gold}38`,
    backgroundColor: `${FateDropColors.gold}0E`,
  },
  toolCopy: { flex: 1 },
  toolTitle: { color: FateDropColors.ivory, fontSize: 16, fontWeight: '900' },
  toolDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
