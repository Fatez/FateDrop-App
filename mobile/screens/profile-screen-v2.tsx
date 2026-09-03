import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import { FATEDROP_WORDMARK_URI } from '@/constants/brand-wordmark-data';
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
  const { snapshot, signedIn, signOut, syncing } = useFateDropId();
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

  const requestSignOut = useCallback(() => {
    if (!signedIn || syncing) return;
    Alert.alert(
      'Sign out of FateDrop?',
      'This ends your FateDrop ID session on this device. You can sign back in from Profile at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void signOut().catch((cause) => {
              Alert.alert('Sign out failed', cause instanceof Error ? cause.message : 'FateDrop could not securely sign you out. Please try again.');
            });
          },
        },
      ],
    );
  }, [signOut, signedIn, syncing]);

  const membershipLabel = tier === 'FREE' ? 'FREE MEMBER' : 'PREMIUM MEMBER';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileIdentity}>
          <View style={styles.cover}>
            <ProfileWallpaperArt wallpaperId={customisation.wallpaperId} />
            <View style={styles.coverShade} />

            <View style={styles.overlayHeader}>
              <View style={styles.logoPlate}>
                <Image
                  source={{ uri: FATEDROP_WORDMARK_URI }}
                  style={styles.wordmark}
                  contentFit="contain"
                  contentPosition="left center"
                />
              </View>
              <MembershipPill label={membershipLabel} />
            </View>
          </View>

          <View style={styles.avatarOverlap}>
            <AvatarVisual avatarId={customisation.avatarId} size={94} />
          </View>

          <View style={styles.identityBlock}>
            <Text style={styles.identityEyebrow}>{signedIn ? `FATEDROP ID · ${tier}` : 'FATEDROP ID'}</Text>
            <Text style={styles.identityTitle}>{displayName}</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.fateIdPill}>
              <Text style={styles.fateIdText}>{signedIn ? snapshot?.user.fateId || 'ID SYNCED' : 'SIGN IN TO SYNC'}</Text>
              <Ionicons name={signedIn ? 'copy-outline' : 'arrow-forward'} size={12} color={FateDropColors.secondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.heroActionRow}>
            <HeroAction icon="image-outline" label="Change wallpaper" onPress={() => openCustomisation('wallpapers')} />
            <HeroAction icon="person-outline" label="Edit avatar" onPress={() => openCustomisation('avatar')} />
          </View>

          <SectionTitle label="ALERT COMPANIONS" />
          <Pressable onPress={() => openCustomisation('companions')} style={({ pressed }) => [styles.companionPanel, pressed && styles.pressed]}>
            <View style={styles.companions}>
              {companionIds.map((id) => {
                const item = profileCompanionMeta[id];
                const color = companionColors[id];
                return (
                  <View key={id} style={styles.companion}>
                    <View style={[styles.companionGlow, { borderColor: `${color}66`, backgroundColor: `${color}12` }]} />
                    <Image source={profileCompanionSources[id]} style={styles.companionImage} contentFit="contain" />
                    <Text style={styles.companionName}>{item.name}</Text>
                    <Text style={[styles.companionStage, { color }]}>{item.stage.toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.companionFooter}>
              <Text style={styles.companionFooterText}>Manage companions</Text>
              <Ionicons name="chevron-forward" size={15} color={FateDropColors.goldBright} />
            </View>
          </Pressable>

          <SectionTitle label="FATEDROP STORIES" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open FateDrop Stories"
            onPress={() => router.push('/stories' as Href)}
            style={({ pressed }) => [styles.storiesCard, pressed && styles.pressed]}>
            <View style={styles.storiesIcon}>
              <Ionicons name="book-outline" size={20} color={FateDropColors.goldBright} />
            </View>
            <View style={styles.flex}>
              <View style={styles.storiesTitleRow}>
                <Text style={styles.storiesTitle}>FateDrop Stories</Text>
                <View style={styles.storiesBadge}>
                  <Text style={styles.storiesBadgeText}>10 PAGES</Text>
                </View>
              </View>
              <Text style={styles.storiesDetail}>Read how FateDrop works</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={FateDropColors.goldBright} />
          </Pressable>

          <SectionTitle label="PREFERENCES" />
          <View style={styles.panel}>
            <Preference icon="pulse-outline" title="Live Network" detail="Retailer coverage, monitor health and FateDrop network activity." onPress={() => router.push('/(tabs)/network')} />
            <Divider />
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

          {signedIn ? (
            <>
              <SectionTitle label="ACCOUNT" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out of FateDrop"
                disabled={syncing}
                onPress={requestSignOut}
                style={({ pressed }) => [styles.signOutRow, (pressed || syncing) && styles.pressed]}>
                <View style={styles.signOutIcon}>
                  <Ionicons name="log-out-outline" size={18} color={FateDropColors.coral} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.signOutTitle}>{syncing ? 'Signing out…' : 'Sign out'}</Text>
                  <Text style={styles.signOutDetail}>End this FateDrop ID session on this device.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={FateDropColors.coral} />
              </Pressable>
            </>
          ) : null}
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
      <Ionicons name="diamond-outline" size={12} color={FateDropColors.goldBright} />
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

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
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
  content: { paddingBottom: 124 },
  body: { paddingHorizontal: 18 },

  profileIdentity: { alignItems: 'center', marginBottom: 10 },
  cover: { width: '100%', height: 210, overflow: 'hidden', backgroundColor: FateDropColors.surface },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,13,.04)' },
  overlayHeader: { position: 'absolute', top: 10, left: 14, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  logoPlate: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, backgroundColor: 'rgba(3,7,12,.34)' },
  wordmark: { width: 174, height: 58 },
  membershipPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}70`, backgroundColor: 'rgba(5,10,16,.68)' },
  membershipText: { color: FateDropColors.goldBright, fontSize: 9.2, fontWeight: '900', letterSpacing: .8 },

  avatarOverlap: { marginTop: -44, alignItems: 'center', justifyContent: 'center' },
  avatarFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.94)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: .3, shadowRadius: 12, elevation: 7 },
  identityBlock: { alignItems: 'center', marginTop: 6, paddingHorizontal: 18 },
  identityEyebrow: { color: FateDropColors.goldBright, fontSize: 8.2, fontWeight: '900', letterSpacing: 1.05 },
  identityTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 20, lineHeight: 24, textAlign: 'center', fontWeight: '700', marginTop: 3 },
  fateIdPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(8,14,20,.62)' },
  fateIdText: { color: FateDropColors.secondary, fontSize: 9.5, fontWeight: '800', letterSpacing: .35 },

  heroActionRow: { flexDirection: 'row', gap: 9, marginBottom: 20 },
  heroAction: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: 'rgba(18,24,32,.92)' },
  heroActionText: { color: FateDropColors.ivory, fontSize: 11.5, fontWeight: '800' },

  sectionLabel: { color: FateDropColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.35, marginBottom: 9 },
  companionPanel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.82)', overflow: 'hidden', marginBottom: 22, paddingTop: 8 },
  companions: { flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  companion: { flex: 1, minWidth: 0, alignItems: 'center', paddingBottom: 6 },
  companionGlow: { position: 'absolute', bottom: 31, width: '82%', height: 17, borderRadius: 999, borderWidth: 1 },
  companionImage: { width: '100%', height: 74 },
  companionName: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '900', marginTop: -2 },
  companionStage: { fontSize: 6.8, fontWeight: '900', letterSpacing: .6, marginTop: 1 },
  companionFooter: { minHeight: 36, marginTop: 2, borderTopWidth: 1, borderTopColor: FateDropColors.borderSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(8,14,20,.36)' },
  companionFooterText: { color: FateDropColors.goldBright, fontSize: 10.5, fontWeight: '800' },

  storiesCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 22, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.gold}4D`, backgroundColor: 'rgba(20,22,34,.94)', overflow: 'hidden' },
  storiesIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}45`, backgroundColor: `${FateDropColors.gold}12` },
  storiesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  storiesTitle: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 16, fontWeight: '800' },
  storiesDetail: { color: FateDropColors.secondary, fontSize: 11.5, marginTop: 3 },
  storiesBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}4D`, backgroundColor: `${FateDropColors.gold}0D` },
  storiesBadgeText: { color: FateDropColors.goldBright, fontSize: 7.5, fontWeight: '900', letterSpacing: .65 },

  panel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', overflow: 'hidden', marginBottom: 22 },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  preferenceIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0F`, borderWidth: 1, borderColor: `${FateDropColors.gold}32` },
  preferenceTitle: { color: FateDropColors.ivory, fontSize: 15, fontWeight: '900' },
  preferenceDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  signOutRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.coral}42`, backgroundColor: 'rgba(18,24,32,.92)', marginBottom: 22 },
  signOutIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.coral}0F`, borderWidth: 1, borderColor: `${FateDropColors.coral}32` },
  signOutTitle: { color: FateDropColors.coral, fontSize: 15, fontWeight: '900' },
  signOutDetail: { color: FateDropColors.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  divider: { height: 1, backgroundColor: FateDropColors.borderSoft, marginLeft: 62 },
  flex: { flex: 1 },
  pressed: { opacity: .72 },
});