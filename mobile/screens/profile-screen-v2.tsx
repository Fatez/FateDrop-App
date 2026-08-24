import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { FateDropColors, FateDropTypography, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

const companionRows = [
  { name: 'Oru', stage: 'Whisper', image: require('../assets/images/alert-oru.webp'), color: FateDropColors.whisper },
  { name: 'Fenn', stage: 'Echo', image: require('../assets/images/alert-fenn.webp'), color: FateDropColors.echo },
  { name: 'Koru', stage: 'Manifested', image: require('../assets/images/alert-koru.webp'), color: FateDropColors.manifested },
  { name: 'Nyxen', stage: 'Vanished', image: require('../assets/images/alert-nyxen.webp'), color: FateDropColors.vanished },
] as const;

export default function ProfileScreenV2() {
  const { snapshot, signedIn, syncing } = useFateDropId();
  const displayName = snapshot?.user.displayName || snapshot?.user.handle || 'Seeker';
  const tier = snapshot?.entitlement.effectiveTier?.toUpperCase() || 'FREE';
  const fateFindCount = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const fateMatchCount = snapshot?.fateMatches?.length ?? 0;
  const wishlistCount = snapshot?.wishlist?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="Profile" subtitle="YOUR FATEDROP ID" />

        <View style={styles.hero}>
          <Image source={require('../assets/images/alert-fenn-hero.jpg')} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition="center" />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.avatar}><Ionicons name={signedIn ? 'person' : 'person-outline'} size={22} color={FateDropColors.goldBright} /></View>
            <Text style={styles.heroEyebrow}>{signedIn ? `FATEDROP ID · ${tier}` : 'FATEDROP ID'}</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSub}>{signedIn ? `${snapshot?.user.fateId || 'ID synced'} · ${syncing ? 'syncing now' : 'synced across FateDrop'}` : 'Connect one identity across app, Web and notification preferences.'}</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.manageButton}><Text style={styles.manageText}>{signedIn ? 'MANAGE ID' : 'SIGN IN'}</Text><Ionicons name="arrow-forward" size={14} color={FateDropColors.ivory} /></Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={signedIn ? String(fateFindCount) : '—'} label="FATEFINDS" />
          <Stat value={signedIn ? String(fateMatchCount) : '—'} label="FATEMATCHES" />
          <Stat value={signedIn ? String(wishlistCount) : '—'} label="SAVED" />
        </View>

        <SectionTitle label="PREFERENCES" />
        <View style={styles.panel}>
          <Preference icon="notifications-outline" title="Notifications" detail="Whisper, Echo, Manifested, Vanished and FateMatch delivery." onPress={() => router.push('/notification-preferences')} />
          <Divider />
          <Preference icon="pricetag-outline" title="Price & FateMatch rules" detail="Manage your hosted hunts and acceptable price thresholds." onPress={() => router.push('/fatefind')} />
          <Divider />
          <Preference icon="bookmark-outline" title="Wishlist" detail="Products you want to keep across stock and retailer changes." onPress={() => router.push('/(tabs)/watchlist')} />
          <Divider />
          <Preference icon="card-outline" title="Membership" detail="Server-confirmed tier and capabilities." onPress={() => router.push('/account')} />
        </View>

        <View style={styles.sectionHead}>
          <SectionTitle label="ALERT COMPANIONS" />
          <Pressable onPress={() => router.push('/companion')}><Text style={styles.sectionAction}>COMPANION LAB →</Text></Pressable>
        </View>
        <Text style={styles.sectionCopy}>The four lifecycle voices are fixed to the signal they represent, so a push alert and the in-app alert always speak the same language.</Text>

        <View style={styles.companions}>
          {companionRows.map((item) => (
            <View key={item.name} style={[styles.companion, { borderColor: `${item.color}55` }]}>
              <Image source={item.image} style={styles.companionImage} contentFit="cover" />
              <View style={styles.companionShade} />
              <View style={styles.companionCopy}>
                <Text style={styles.companionName}>{item.name}</Text>
                <Text style={[styles.companionStage, { color: item.color }]}>{item.stage.toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="sparkles-outline" size={20} color={FateDropColors.gold} />
          <View style={styles.flex}>
            <Text style={styles.noteTitle}>Progression can wait.</Text>
            <Text style={styles.noteCopy}>Profile is currently about identity, preferences and companions. Levels, XP or collector progression stay out until they have a real product purpose.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Preference({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.preference, pressed && styles.pressed]}>
      <View style={styles.preferenceIcon}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /></View>
      <View style={styles.flex}><Text style={styles.preferenceTitle}>{title}</Text><Text style={styles.preferenceDetail}>{detail}</Text></View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { height: 300, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface, marginBottom: 10 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,9,12,.48)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}88`, backgroundColor: 'rgba(8,14,20,.72)', marginBottom: 10 },
  heroEyebrow: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 32, fontWeight: '700', marginTop: 3 },
  heroSub: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  manageButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: 'rgba(8,14,20,.72)' },
  manageText: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900', letterSpacing: .7 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  stat: { flex: 1, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, alignItems: 'center' },
  statValue: { color: FateDropColors.ivory, fontSize: 21, fontWeight: '900' },
  statLabel: { color: FateDropColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: .7, marginTop: 3 },
  sectionLabel: { color: FateDropColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.35, marginBottom: 8 },
  panel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, overflow: 'hidden', marginBottom: 22 },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  preferenceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0F`, borderWidth: 1, borderColor: `${FateDropColors.gold}26` },
  preferenceTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  preferenceDetail: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  divider: { height: 1, backgroundColor: FateDropColors.borderSoft, marginLeft: 62 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionAction: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900' },
  sectionCopy: { color: FateDropColors.secondary, fontSize: 13, lineHeight: 19, marginBottom: 11 },
  companions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  companion: { flex: 1, aspectRatio: .78, borderRadius: 15, overflow: 'hidden', borderWidth: 1, backgroundColor: FateDropColors.card },
  companionImage: { width: '100%', height: '100%' },
  companionShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,10,.26)' },
  companionCopy: { position: 'absolute', left: 8, right: 8, bottom: 8 },
  companionName: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900' },
  companionStage: { fontSize: 9, fontWeight: '900', letterSpacing: .6, marginTop: 2 },
  note: { flexDirection: 'row', gap: 11, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: FateDropColors.surface },
  noteTitle: { color: FateDropColors.ivory, fontSize: FateDropTypography.body, fontWeight: '900' },
  noteCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  flex: { flex: 1 },
  pressed: { opacity: .75 },
});
