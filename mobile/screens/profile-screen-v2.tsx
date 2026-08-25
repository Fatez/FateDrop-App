import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import { profileAvatarSources, profileCompanionMeta, profileCompanionSources } from '@/constants/profile-customisation';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  DEFAULT_PROFILE_CUSTOMISATION,
  loadProfileCustomisation,
  type ProfileAvatarId,
  type ProfileCustomisation,
} from '@/services/profile-customisation';

const companionIds = ['oru', 'fenn', 'koru', 'nyxen'] as const;

const companionColors = {
  oru: FateDropColors.whisper,
  fenn: FateDropColors.echo,
  koru: FateDropColors.manifested,
  nyxen: FateDropColors.vanished,
} as const;

export default function ProfileScreenV2() {
  const { snapshot, signedIn } = useFateDropId();
  const displayName = snapshot?.user.displayName || snapshot?.user.handle || 'Seeker';
  const tier = snapshot?.entitlement.effectiveTier?.toUpperCase() || 'FREE';
  const identity = snapshot?.user.fateId || 'guest';
  const [customisation, setCustomisation] = useState<ProfileCustomisation>(DEFAULT_PROFILE_CUSTOMISATION);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadProfileCustomisation(identity).then((next) => {
        if (active) setCustomisation(next);
      });
      return () => {
        active = false;
      };
    }, [identity]),
  );

  const membershipLabel = tier === 'FREE' ? 'FREE MEMBER' : 'PREMIUM MEMBER';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="Profile" rightAction={<MembershipPill label={membershipLabel} />} />

        <View style={styles.hero}>
          <ProfileWallpaperArt wallpaperId={customisation.wallpaperId} />
          <View style={styles.heroShade} />
          <View style={styles.heroTopGlow} />

          <View style={styles.heroAvatarWrap}>
            <AvatarVisual avatarId={customisation.avatarId} size={102} />
          </View>

          <View style={styles.heroIdentity}>
            <Text style={styles.heroEyebrow}>{signedIn ? `FATEDROP ID · ${tier}` : 'FATEDROP ID'}</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.fateIdPill}>
              <Text style={styles.fateIdText}>{signedIn ? snapshot?.user.fateId || 'ID SYNCED' : 'SIGN IN TO SYNC'}</Text>
              <Ionicons name={signedIn ? 'copy-outline' : 'arrow-forward'} size={13} color={FateDropColors.secondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <HeroAction icon="image-outline" label="Change wallpaper" onPress={() => openCustomisation('wallpapers')} />
          <HeroAction icon="person-outline" label="Edit avatar" onPress={() => openCustomisation('avatar')} />
        </View>

        <SectionTitle label="CUSTOMISATION" />
        <View style={styles.customisationRow}>
          <CustomisationTile icon="person" title="Avatar" detail="Profile image" onPress={() => openCustomisation('avatar')} />
          <CustomisationTile icon="image" title="Wallpapers" detail="Profile backdrop" onPress={() => openCustomisation('wallpapers')} />
          <CustomisationTile icon="paw" title="Companions" detail="Lifecycle cast" onPress={() => openCustomisation('companions')} />
        </View>

        <SectionTitle label="PREFERENCES" />
        <View style={styles.panel}>
          <Preference icon="notifications-outline" title="Notifications" detail="Whisper, Echo, Manifested, Vanished and FateMatch delivery." onPress={() => router.push('/notification-preferences')} />
          <Divider />
          <Preference icon="pricetag-outline" title="Price & FateMatch rules" detail="Manage hosted hunts, RRP tolerance and budget thresholds." onPress={() => router.push('/fate-match')} />
          <Divider />
          <Preference icon="bookmark-outline" title="Wishlist" detail="Products you want to keep across stock and retailer changes." onPress={() => router.push('/(tabs)/watchlist')} />
          <Divider />
          <Preference icon="speedometer-outline" title="App dashboard" detail="Live monitor health, account sync and optimisation visibility." onPress={() => router.push('/dashboard')} />
          <Divider />
          <Preference icon="card-outline" title="Membership" detail="Server-confirmed tier and capabilities." onPress={() => router.push('/account')} />
        </View>

        <View style={styles.companionHeadingRow}>
          <SectionTitle label="ALERT COMPANIONS" compact />
          <Pressable onPress={() => openCustomisation('companions')} style={styles.lifecycleInfo}>
            <Ionicons name="information-circle-outline" size={14} color={FateDropColors.secondary} />
            <Text style={styles.lifecycleInfoText}>Lifecycle voices</Text>
          </Pressable>
        </View>

        <View style={styles.companions}>
          {companionIds.map((id) => {
            const item = profileCompanionMeta[id];
            const color = companionColors[id];
            return (
              <Pressable key={id} onPress={() => openCustomisation('companions')} style={({ pressed }) => [styles.companion, pressed && styles.pressed]}>
                <View style={[styles.companionGlow, { borderColor: `${color}66`, backgroundColor: `${color}12` }]} />
                <Image source={profileCompanionSources[id]} style={styles.companionImage} contentFit="contain" />
                <Text style={styles.companionName}>{item.name}</Text>
                <Text style={[styles.companionStage, { color }]}>{item.stage.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function openCustomisation(tab: 'avatar' | 'wallpapers' | 'companions') {
  router.push(`/profile-customisation?tab=${tab}`);
}

function MembershipPill({ label }: { label: string }) {
  return (
    <View style={styles.membershipPill}>
      <Ionicons name="diamond-outline" size={13} color={FateDropColors.goldBright} />
      <Text style={styles.membershipText}>{label}</Text>
    </View>
  );
}

function AvatarVisual({ avatarId, size }: { avatarId: ProfileAvatarId; size: number }) {
  return (
    <View style={[styles.avatarFrame, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarId === 'mark' ? (
        <FateDropNavEmblem size={Math.round(size * 0.58)} />
      ) : (
        <Image source={profileAvatarSources[avatarId]} style={{ width: size * 0.9, height: size * 0.9 }} contentFit="contain" />
      )}
    </View>
  );
}

function HeroAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={FateDropColors.goldBright} />
      <Text style={styles.heroActionText}>{label}</Text>
    </Pressable>
  );
}

function CustomisationTile({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.customisationTile, pressed && styles.pressed]}>
      <View style={styles.customisationIcon}>
        <Ionicons name={icon} size={19} color={FateDropColors.goldBright} />
      </View>
      <Text style={styles.customisationTitle}>{title}</Text>
      <Text style={styles.customisationDetail}>{detail}</Text>
      <Ionicons name="chevron-forward" size={14} color={FateDropColors.muted} />
    </Pressable>
  );
}

function SectionTitle({ label, compact = false }: { label: string; compact?: boolean }) {
  return <Text style={[styles.sectionLabel, compact && styles.sectionLabelCompact]}>{label}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Preference({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.preference, pressed && styles.pressed]}>
      <View style={styles.preferenceIcon}>
        <Ionicons name={icon} size={18} color={FateDropColors.goldBright} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 124 },
  membershipPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: 'rgba(8,14,20,.82)' },
  membershipText: { color: FateDropColors.goldBright, fontSize: 10, fontWeight: '900', letterSpacing: .9 },
  hero: { height: 330, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: FateDropColors.surface, marginBottom: 10 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,13,.12)' },
  heroTopGlow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 175, backgroundColor: 'rgba(5,11,18,.72)' },
  heroAvatarWrap: { position: 'absolute', top: 78, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  avatarFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.78)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: .3, shadowRadius: 12, elevation: 7 },
  heroIdentity: { position: 'absolute', left: 18, right: 18, bottom: 18, alignItems: 'center' },
  heroEyebrow: { color: FateDropColors.goldBright, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.25 },
  heroTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 22, lineHeight: 27, textAlign: 'center', fontWeight: '700', marginTop: 3 },
  fateIdPill: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(8,14,20,.68)' },
  fateIdText: { color: FateDropColors.secondary, fontSize: 10.5, fontWeight: '800', letterSpacing: .4 },
  heroActionRow: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  heroAction: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: 'rgba(18,24,32,.92)' },
  heroActionText: { color: FateDropColors.ivory, fontSize: 11.5, fontWeight: '800' },
  sectionLabel: { color: FateDropColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.35, marginBottom: 9 },
  sectionLabelCompact: { marginBottom: 0 },
  customisationRow: { flexDirection: 'row', gap: 8, marginBottom: 23 },
  customisationTile: { flex: 1, minHeight: 92, padding: 9, borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.9)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  customisationIcon: { width: 35, height: 35, borderRadius: 17.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}40`, backgroundColor: `${FateDropColors.gold}0D` },
  customisationTitle: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  customisationDetail: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 12, textAlign: 'center' },
  panel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', overflow: 'hidden', marginBottom: 22 },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  preferenceIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0F`, borderWidth: 1, borderColor: `${FateDropColors.gold}32` },
  preferenceTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  preferenceDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  divider: { height: 1, backgroundColor: FateDropColors.borderSoft, marginLeft: 62 },
  companionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 },
  lifecycleInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lifecycleInfoText: { color: FateDropColors.secondary, fontSize: 9.5 },
  companions: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  companion: { flex: 1, minWidth: 0, alignItems: 'center', paddingTop: 0, paddingBottom: 5 },
  companionGlow: { position: 'absolute', bottom: 34, width: '84%', height: 18, borderRadius: 999, borderWidth: 1 },
  companionImage: { width: '100%', height: 92 },
  companionName: { color: FateDropColors.ivory, fontSize: 11.5, fontWeight: '900', marginTop: -3 },
  companionStage: { fontSize: 7.2, fontWeight: '900', letterSpacing: .65, marginTop: 1 },
  flex: { flex: 1 },
  pressed: { opacity: .72 },
});
