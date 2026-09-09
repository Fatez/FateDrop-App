import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropColors, Fonts } from '@/constants/theme';

const DESTINATIONS: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; route: Href }[] = [
  { title: 'Wishlist', detail: 'Saved products', icon: 'bookmark-outline', route: '/(tabs)/watchlist' },
  { title: 'Retailers', detail: 'Discover shops', icon: 'storefront-outline', route: '/(tabs)/indies' },
  { title: 'FateFind', detail: 'Find a deal', icon: 'telescope-outline', route: '/fatefind' },
  { title: 'FateMatch', detail: 'Watch your hunt', icon: 'notifications-outline', route: '/fate-match' },
  { title: 'Local Radar', detail: 'Stock & events', icon: 'navigate-outline', route: '/local-radar' },
];

export function FateNetworkCompass({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stageWidth = Math.min(width - 16, 420);
  const nodeWidth = Math.min(88, stageWidth * .24);
  const radius = (stageWidth - nodeWidth) / 2 - 4;
  const verticalRadius = Math.max(170, 150 * fontScale);
  const baseline = verticalRadius + 35;
  const centreHeight = Math.max(116, 90 * fontScale);
  const open = (route: Href) => { onClose(); router.navigate(route); };
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Close Fate Network" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View accessibilityViewIsModal style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>FATE NETWORK</Text>
            <Text accessibilityRole="header" style={styles.title}>Choose your direction</Text>
            <Text style={styles.copy}>Find a deal, follow a hunt, or explore nearby.</Text>
          </View>
          <View style={[styles.stage, { width: stageWidth, height: baseline + centreHeight + 45 }]}>
            <View pointerEvents="none" style={[styles.aura, { left: stageWidth / 2 - 110 }]} />
            <View pointerEvents="none" style={[styles.ring, { width: radius * 2, height: verticalRadius * 2, borderRadius: 999, left: stageWidth / 2 - radius, top: baseline - verticalRadius + 24 }]} />
            <View pointerEvents="none" style={[styles.ring, { width: radius * 1.45, height: verticalRadius * 1.45, borderRadius: 999, left: stageWidth / 2 - radius * .725, top: baseline - verticalRadius * .725 + 24, borderColor: 'rgba(124,110,255,.25)' }]} />
            {DESTINATIONS.map((item, index) => {
              const angle = Math.PI - index * Math.PI / 4;
              return <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`${item.title}: ${item.detail}`} onPress={() => open(item.route)} style={({ pressed }) => [styles.node, { width: nodeWidth, left: stageWidth / 2 + radius * Math.cos(angle) - nodeWidth / 2, top: baseline - verticalRadius * Math.sin(angle) }, pressed && styles.pressed]}>
                <View style={styles.nodeIcon}><Ionicons name={item.icon} size={23} color={FateDropColors.goldBright} /></View>
                <Text style={styles.nodeTitle}>{item.title}</Text><Text style={styles.nodeDetail}>{item.detail}</Text>
              </Pressable>;
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="Close Fate Network" accessibilityState={{ expanded: true }} onPress={onClose} style={({ pressed }) => [styles.center, { left: stageWidth / 2 - 53, top: baseline + 12, height: centreHeight }, pressed && styles.pressed]}>
              <FateDropNavEmblem size={53} /><Text style={styles.centerTitle}>Network</Text><Text style={styles.nodeDetail}>Tap to close</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Fate Network" onPress={onClose} style={styles.close}><Ionicons name="close" size={20} color={FateDropColors.ivory} /><Text style={styles.closeText}>Close</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,5,12,.94)' },
  scroll: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' }, panel: { alignItems: 'center' },
  header: { paddingHorizontal: 24, alignItems: 'center' },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  title: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 27, textAlign: 'center', marginTop: 9 },
  copy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  stage: { height: 355, overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(226,197,141,.28)' },
  aura: { position: 'absolute', top: 140, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,110,255,.055)' },
  node: { position: 'absolute', width: 88, minHeight: 96, alignItems: 'center' },
  nodeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,197,141,.5)', backgroundColor: '#111b29' },
  nodeTitle: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 7 },
  nodeDetail: { color: FateDropColors.secondary, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 3 },
  center: { position: 'absolute', top: 222, width: 106, height: 116, alignItems: 'center', justifyContent: 'center', borderRadius: 53, backgroundColor: '#0c1420', borderWidth: 1, borderColor: FateDropColors.goldBright },
  centerTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 18 },
  close: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 48, paddingHorizontal: 20 },
  closeText: { color: FateDropColors.secondary, fontSize: 13 }, pressed: { opacity: .7 },
});
