import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { fetchNetworkPulse, type NetworkPulse, type NetworkSignalState } from '@/services/network-signals';

const stageMeta: Record<NetworkSignalState, { label: string; companion: string; color: string }> = {
  whisper: { label: 'Whisper', companion: 'Oru', color: FateDropColors.whisper },
  echo: { label: 'Echo', companion: 'Fenn', color: FateDropColors.echo },
  manifested: { label: 'Manifested', companion: 'Koru', color: FateDropColors.manifested },
  vanished: { label: 'Vanished', companion: 'Nyxen', color: FateDropColors.vanished },
};
const stageOrder: NetworkSignalState[] = ['whisper', 'echo', 'manifested', 'vanished'];
const emptyPulse: NetworkPulse = { whisper: 0, echo: 0, manifested: 0, vanished: 0 };

export default function HomeScreenV3() {
  const insets = useSafeAreaInsets();
  const { snapshot, signedIn, refresh } = useFateDropId();
  const [pulse, setPulse] = useState<NetworkPulse>(emptyPulse);
  const [pulseError, setPulseError] = useState(false);

  const load = useCallback(async () => {
    const [nextPulse] = await Promise.all([
      fetchNetworkPulse(7).catch(() => null),
      signedIn ? refresh().catch(() => null) : Promise.resolve(null),
    ]);
    if (nextPulse) {
      setPulse(nextPulse);
      setPulseError(false);
    } else {
      setPulseError(true);
    }
  }, [refresh, signedIn]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeFinds = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const recentMatches = useMemo(() => {
    const floor = Math.floor(Date.now() / 1000) - 7 * 86_400;
    return snapshot?.fateMatches?.filter((item) => item.matchedAt >= floor).length ?? 0;
  }, [snapshot?.fateMatches]);
  const saved = snapshot?.wishlist?.length ?? 0;

  return (
    <View style={styles.safe}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={require('../assets/images/home-koru-hero.webp')} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" />
          <View style={styles.heroShade} />
          <View style={styles.heroFadeUpper} />
          <View style={styles.heroFadeLower} />
          <Image source={require('../assets/images/fatedrop-wordmark.png')} style={[styles.wordmark, { top: insets.top + 8 }]} contentFit="contain" contentPosition="left center" />
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={[styles.profileButton, { top: insets.top + 13 }]}>
            <Ionicons name={signedIn ? 'person' : 'person-outline'} size={18} color={FateDropColors.ivory} />
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>THE FATE NETWORK IS LIVE</Text>
            <Text style={styles.heroTitle}>Know what moved. Hunt what matters.</Text>
            <Text style={styles.heroSubtitle}>Network intelligence, verified RRP, True Price and personal FateFinds in one place.</Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>NETWORK PULSE</Text>
            <Text style={styles.sectionTitle}>Last 7 days</Text>
          </View>
          <Text style={styles.sectionHint}>{pulseError ? 'Refresh pending' : 'Live network totals'}</Text>
        </View>
        <View style={styles.pulseGrid}>
          {stageOrder.map((state) => {
            const meta = stageMeta[state];
            return (
              <Pressable key={state} onPress={() => router.push({ pathname: '/(tabs)/alerts', params: { stage: state.toUpperCase() } })} style={styles.pulseCard}>
                <View style={[styles.pulseDot, { backgroundColor: meta.color }]} />
                <Text style={styles.pulseValue}>{pulse[state]}</Text>
                <Text style={[styles.pulseLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                <Text style={styles.pulseCompanion}>{meta.companion}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR FATEDROP</Text>
            <Text style={styles.sectionTitle}>{signedIn ? 'Your current picture' : 'Connect your FateDrop ID'}</Text>
          </View>
        </View>
        <View style={styles.personalGrid}>
          <MiniStat value={signedIn ? String(activeFinds) : '—'} label="ACTIVE FATEFINDS" icon="telescope-outline" onPress={() => router.push('/fate-match')} />
          <MiniStat value={signedIn ? String(recentMatches) : '—'} label="7D FATEMATCHES" icon="sparkles-outline" onPress={() => router.push('/fate-match')} />
          <MiniStat value={signedIn ? String(saved) : '—'} label="WISHLIST" icon="bookmark-outline" onPress={() => router.push('/(tabs)/watchlist')} />
        </View>

        <Text style={styles.sectionEyebrow}>QUICK ACTIONS</Text>
        <View style={styles.actions}>
          <Action title="Search" detail="See what is available" icon="search-outline" onPress={() => router.push('/(tabs)/search')} />
          <Action title="FateFind" detail="Find it now or keep hunting" icon="telescope-outline" onPress={() => router.push('/fatefind')} />
          <Action title="Local Radar" detail="Find shops and events near you" icon="navigate-outline" onPress={() => router.push('/local-radar')} />
          <Action title="How FateDrop works" detail="See the whole flow" icon="play-circle-outline" onPress={() => router.push('/demo')} />
        </View>

        <View style={styles.explainer}>
          <Ionicons name="sparkles-outline" size={20} color={FateDropColors.goldBright} />
          <View style={styles.flex}>
            <Text style={styles.explainerTitle}>Search → Wishlist → FateFind → FateMatch</Text>
            <Text style={styles.explainerCopy}>Browse it. Remember it. Ask FateFind to hunt it. Get a FateMatch when your conditions line up.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function MiniStat({ value, label, icon, onPress }: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.miniStat}><Ionicons name={icon} size={17} color={FateDropColors.goldBright} /><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></Pressable>;
}
function Action({ title, detail, icon, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.action}><View style={styles.actionIcon}><Ionicons name={icon} size={19} color={FateDropColors.goldBright} /></View><View style={styles.flex}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingBottom: 118 },
  hero: { height: 390, overflow: 'hidden', backgroundColor: FateDropColors.background, marginBottom: 18 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,6,11,.20)' },
  heroFadeUpper: { position: 'absolute', left: 0, right: 0, top: 0, height: 72, backgroundColor: 'rgba(4,5,11,.26)' },
  heroFadeLower: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 100, backgroundColor: 'rgba(4,5,11,.72)' },
  wordmark: { position: 'absolute', left: 18, width: 150, height: 44 },
  profileButton: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,7,12,.58)', borderWidth: 1, borderColor: FateDropColors.border },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  heroEyebrow: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.35 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 33, fontWeight: '700', maxWidth: 330, marginTop: 5 },
  heroSubtitle: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, maxWidth: 340, marginTop: 7 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 6, marginBottom: 10 },
  sectionEyebrow: { color: FateDropColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.25, paddingHorizontal: 18, marginBottom: 7 },
  sectionTitle: { color: FateDropColors.ivory, fontSize: 20, fontWeight: '900', marginTop: 2 },
  sectionHint: { color: FateDropColors.muted, fontSize: 10, paddingBottom: 2 },
  pulseGrid: { flexDirection: 'row', gap: 7, paddingHorizontal: 18, marginBottom: 22 },
  pulseCard: { flex: 1, minHeight: 108, padding: 11, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  pulseDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 9 },
  pulseValue: { color: FateDropColors.ivory, fontSize: 26, fontWeight: '900' },
  pulseLabel: { fontSize: 8, fontWeight: '900', letterSpacing: .5, marginTop: 3 },
  pulseCompanion: { color: FateDropColors.muted, fontSize: 9, marginTop: 4 },
  personalGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 25 },
  miniStat: { flex: 1, padding: 12, minHeight: 108, borderRadius: 16, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  miniValue: { color: FateDropColors.ivory, fontSize: 22, fontWeight: '900', marginTop: 9 },
  miniLabel: { color: FateDropColors.muted, fontSize: 8, fontWeight: '900', lineHeight: 12, marginTop: 3 },
  actions: { paddingHorizontal: 18, gap: 8, marginBottom: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface },
  actionIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}10` },
  actionTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' },
  actionDetail: { color: FateDropColors.secondary, fontSize: 11, marginTop: 2 },
  explainer: { flexDirection: 'row', gap: 11, marginHorizontal: 18, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  explainerTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },
  explainerCopy: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  flex: { flex: 1 },
});
