import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';

export default function ToolsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Image source={require('../assets/images/fatedrop-center-emblem.png')} style={styles.emblem} contentFit="contain" />
          <Text style={styles.eyebrow}>FATE NETWORK</Text>
          <Text style={styles.title}>What do you want FateDrop to do?</Text>
          <Text style={styles.copy}>One network, five clear jobs: FateFind finds value, FateMatch monitors, Fate Trader handles trading, Local Radar watches the physical world and Stores helps you discover retailers.</Text>
        </View>
        <Tool icon="telescope-outline" title="FateFind" detail="Find the strongest qualifying place to buy this product." onPress={() => router.push('/fatefind')} />
        <Tool icon="notifications-outline" title="FateMatch" detail="Monitor the products and conditions you care about." onPress={() => router.push('/fate-match')} />
        <Tool icon="swap-horizontal-outline" title="Fate Trader" detail="Manage structured HAVE / WANT trading intentions and compatible trade opportunities." onPress={() => router.push('/fate-trader')} />
        <Tool icon="navigate-outline" title="Local Radar" detail="Explore nearby physical-store intelligence and collector events." onPress={() => router.push('/local-radar')} />
        <Tool icon="radio-outline" title="Manual Echo intake" detail="Prepare an authorised Echo from credible retailer, influencer or physical-branch intelligence. Never creates Manifested." onPress={() => router.push('/manual-echo-intake')} />
        <Tool icon="storefront-outline" title="Stores" detail="Discover the retailer network, including major retailers and independents." onPress={() => router.push('/(tabs)/indies')} />
        <Tool icon="search-outline" title="Search live database" detail="Browse the current network without starting monitoring." onPress={() => router.push('/(tabs)/search')} />
        <Tool icon="bookmark-outline" title="Wishlist" detail="Remember products without turning monitoring on." onPress={() => router.push('/(tabs)/watchlist')} />
      </ScrollView>
    </SafeAreaView>
  );
}
function Tool({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.tool}><View style={styles.toolIcon}><Ionicons name={icon} size={21} color={FateDropColors.goldBright} /></View><View style={styles.flex}><Text style={styles.toolTitle}>{title}</Text><Text style={styles.toolDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={17} color={FateDropColors.goldBright} /></Pressable>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { padding: 18, paddingBottom: 130, gap: 9 },
  brand: { alignItems: 'center', paddingVertical: 18, marginBottom: 4 }, emblem: { width: 80, height: 80 },
  eyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 8 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 25, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  copy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 340, marginTop: 7 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}10` },
  toolTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' }, toolDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 }, flex: { flex: 1 },
});
