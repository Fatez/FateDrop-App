import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateGlassPanel, FateMetricStrip, FateSectionHeading } from '@/components/fate-polish-ui';
import { FateDropBackground } from '@/components/fatedrop-ui';
import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import { FATEDROP_WORDMARK_URI } from '@/constants/brand-wordmark-data';
import { profileAvatarSources, profileCompanionMeta, profileCompanionSources } from '@/constants/profile-customisation';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { operatorEchoConsoleAccessState } from '@/services/operator-access';
import {
  DEFAULT_PROFILE_CUSTOMISATION,
  loadProfileCustomisation,
  type ProfileAvatarId,
  type ProfileCustomisation,
} from '@/services/profile-customisation';

const companionIds = ['oru', 'fenn', 'koru', 'nyxen'] as const;
const companionColors = { oru: FateDropColors.whisper, fenn: FateDropColors.echo, koru: FateDropColors.manifested, nyxen: FateDropColors.vanished } as const;

type CommandItem = { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; status?: string; color?: string; path: Href };

export default function ProfileScreenV3() {
  const { snapshot, signedIn, signOut, loading, syncing, error } = useFateDropId();
  const operatorAccess = operatorEchoConsoleAccessState({ snapshot, signedIn, loading, syncing, error });
  const displayName = snapshot?.user.displayName || snapshot?.user.handle || 'Seeker';
  const tier = snapshot?.entitlement.effectiveTier?.toUpperCase() || 'FREE';
  const identity = snapshot?.user.fateId || 'guest';
  const activeFinds = snapshot?.fateFinds?.filter((item) => item.enabled !== false).length ?? 0;
  const recentMatches = snapshot?.fateMatches?.length ?? 0;
  const selectedTcgs = snapshot?.tcgPreferences?.selectedTcgCodes?.length ?? 1;
  const appNotifications = snapshot?.notificationPreferences?.push === true;
  const [customisation, setCustomisation] = useState<ProfileCustomisation>(DEFAULT_PROFILE_CUSTOMISATION);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadProfileCustomisation(identity).then((next) => { if (active) setCustomisation(next); });
    return () => { active = false; };
  }, [identity]));

  const requestSignOut = useCallback(() => {
    if (!signedIn || syncing) return;
    Alert.alert('Sign out of FateDrop?', 'This ends your FateDrop ID session on this device. You can sign back in from Profile at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut().catch((cause) => Alert.alert('Sign out failed', cause instanceof Error ? cause.message : 'FateDrop could not securely sign you out.')); } },
    ]);
  }, [signOut, signedIn, syncing]);

  const controlItems: CommandItem[] = [
    { icon: 'notifications-outline', title: 'Notifications', detail: 'Choose lifecycle delivery and device surfaces.', status: appNotifications ? 'PUSH ON' : 'CHECK', color: appNotifications ? FateDropColors.manifested : FateDropColors.echo, path: '/notification-preferences' },
    { icon: 'pulse-outline', title: 'Live Network', detail: 'Open public retailer coverage and monitor health.', status: 'LIVE VIEW', color: FateDropColors.cyan, path: '/(tabs)/network' },
    { icon: 'telescope-outline', title: 'FateFind & FateMatch', detail: 'Manage active hunts and successful matches.', status: `${activeFinds} ACTIVE`, color: FateDropColors.goldBright, path: '/fate-match' },
    { icon: 'bookmark-outline', title: 'Wishlist', detail: 'Saved products kept separate from active hunts.', status: `${snapshot?.wishlist?.length ?? 0} SAVED`, color: FateDropColors.violetLight, path: '/(tabs)/watchlist' },
    { icon: 'albums-outline', title: 'Fate Collections', detail: 'Your cards, binders, graded collection and pulse.', status: 'PRIVATE', color: FateDropColors.goldBright, path: '/collections' },
    { icon: 'speedometer-outline', title: 'App dashboard', detail: 'Account sync and app operational visibility.', status: syncing ? 'SYNCING' : 'READY', color: FateDropColors.mint, path: '/dashboard' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileIdentity}>
          <View style={styles.cover}>
            <ProfileWallpaperArt wallpaperId={customisation.wallpaperId} />
            <View style={styles.coverShade} />
            <View style={styles.overlayHeader}>
              <View style={styles.logoPlate}><Image source={{ uri: FATEDROP_WORDMARK_URI }} style={styles.wordmark} contentFit="contain" contentPosition="left center" /></View>
              <View style={styles.membershipPill}><Ionicons name="diamond-outline" size={12} color={FateDropColors.goldBright} /><Text style={styles.membershipText}>{tier === 'FREE' ? 'FREE MEMBER' : 'PREMIUM MEMBER'}</Text></View>
            </View>
          </View>
          <View style={styles.avatarOverlap}><AvatarVisual avatarId={customisation.avatarId} size={94} /></View>
          <View style={styles.identityBlock}>
            <Text style={styles.identityEyebrow}>FATEDROP COMMAND CENTRE</Text>
            <Text style={styles.identityTitle}>{displayName}</Text>
            <Pressable onPress={() => router.push('/account')} style={styles.fateIdPill}>
              <View style={[styles.connectionDot, { backgroundColor: signedIn ? FateDropColors.manifested : FateDropColors.echo }]} />
              <Text style={styles.fateIdText}>{signedIn ? snapshot?.user.fateId || 'ID SYNCED' : 'CONNECT FATEDROP ID'}</Text>
              <Ionicons name="chevron-forward" size={12} color={FateDropColors.secondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.heroActionRow}>
            <HeroAction icon="image-outline" label="Wallpaper" onPress={() => openCustomisation('wallpapers')} />
            <HeroAction icon="person-outline" label="Avatar" onPress={() => openCustomisation('avatar')} />
            <HeroAction icon="sparkles-outline" label="Companions" onPress={() => openCustomisation('companions')} />
          </View>

          <FateMetricStrip items={[
            { icon: signedIn ? 'cloud-done-outline' : 'cloud-offline-outline', value: signedIn ? 'CONNECTED' : 'OFFLINE', label: 'FATEDROP ID', color: signedIn ? FateDropColors.manifested : FateDropColors.echo },
            { icon: 'notifications-outline', value: appNotifications ? 'ON' : 'CHECK', label: 'PUSH ALERTS', color: appNotifications ? FateDropColors.manifested : FateDropColors.echo },
            { icon: 'telescope-outline', value: String(activeFinds), label: 'ACTIVE FINDS', color: FateDropColors.goldBright },
            { icon: 'layers-outline', value: String(selectedTcgs), label: 'TCG INTERESTS', color: FateDropColors.cyan },
          ]} />

          <FateSectionHeading eyebrow="YOUR FATEDROP" title="Everything important, in one place." copy="Identity, alerts, live network health and collector tools stay visible without turning Profile into a settings cupboard." />
          <View style={styles.commandGrid}>{controlItems.map((item) => <CommandCard key={item.title} item={item} />)}</View>

          <FateSectionHeading eyebrow="ALERT COMPANIONS" title="Your lifecycle guides." copy="The characters change the presentation, never the evidence rules behind Whisper, Echo, Manifested or Vanished." action="MANAGE" onAction={() => openCustomisation('companions')} />
          <FateGlassPanel style={styles.companionPanel}>
            <View style={styles.companions}>{companionIds.map((id) => {
              const item = profileCompanionMeta[id];
              const color = companionColors[id];
              return <View key={id} style={styles.companion}>
                <View style={[styles.companionGlow, { borderColor: `${color}66`, backgroundColor: `${color}12` }]} />
                <Image source={profileCompanionSources[id]} style={styles.companionImage} contentFit="contain" />
                <Text style={styles.companionName}>{item.name}</Text>
                <Text style={[styles.companionStage, { color }]}>{item.stage.toUpperCase()}</Text>
              </View>;
            })}</View>
          </FateGlassPanel>

          <FateSectionHeading eyebrow="DISCOVER" title="FateDrop Stories" copy="A visual guide to how the network, tools and alert lifecycle fit together." />
          <Pressable accessibilityRole="button" onPress={() => router.push('/stories' as Href)} style={({ pressed }) => [styles.storiesCard, pressed && styles.pressed]}>
            <View style={styles.storiesIcon}><Ionicons name="book-outline" size={21} color={FateDropColors.goldBright} /></View>
            <View style={styles.flex}><Text style={styles.storiesTitle}>How FateDrop works</Text><Text style={styles.storiesDetail}>Read the feature stories and collector guides.</Text></View>
            <View style={styles.storiesBadge}><Text style={styles.storiesBadgeText}>10 PAGES</Text></View>
            <Ionicons name="chevron-forward" size={17} color={FateDropColors.goldBright} />
          </Pressable>

          <FateSectionHeading eyebrow="ACCOUNT & EXPERIENCE" title="Preferences" />
          <View style={styles.panel}>
            <Preference icon="card-outline" title="Membership & FateDrop ID" detail="Server-confirmed tier, identity and cross-platform sync." onPress={() => router.push('/account')} />
            <Divider />
            <Preference icon="options-outline" title="App guide" detail="Replay onboarding and understand the core FateDrop experience." onPress={() => router.push('/onboarding')} />
            <Divider />
            <Preference icon="sparkles-outline" title="Fate Companion" detail="Open your persistent companion experience." onPress={() => router.push('/companion')} />
          </View>

          {operatorAccess === 'authorized' ? <><FateSectionHeading eyebrow="OWNER OPERATOR" title="Operator controls" /><View style={styles.operatorPanel}><Preference icon="radio-outline" title="Operator Echoes" detail="Private global Echo publication, active manual history and audited retraction." onPress={() => router.push('/manual-echo-intake')} /></View></> : null}

          {signedIn ? <Pressable accessibilityRole="button" disabled={syncing} onPress={requestSignOut} style={({ pressed }) => [styles.signOutRow, (pressed || syncing) && styles.pressed]}>
            <View style={styles.signOutIcon}><Ionicons name="log-out-outline" size={18} color={FateDropColors.coral} /></View>
            <View style={styles.flex}><Text style={styles.signOutTitle}>{syncing ? 'Signing out…' : 'Sign out'}</Text><Text style={styles.signOutDetail}>End this FateDrop ID session on this device.</Text></View>
          </Pressable> : null}

          <Text style={styles.footerTruth}>{recentMatches ? `${recentMatches} FateMatch${recentMatches === 1 ? '' : 'es'} recorded for this account · ` : ''}Profile shows account state only. Live market and monitor truth remains owned by FateDrop Cloud.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function openCustomisation(tab: 'avatar' | 'wallpapers' | 'companions') { router.push(`/profile-customisation?tab=${tab}`); }
function AvatarVisual({ avatarId, size }: { avatarId: ProfileAvatarId; size: number }) { return <View style={[styles.avatarFrame, { width: size, height: size, borderRadius: size / 2 }]}>{avatarId === 'mark' ? <FateDropNavEmblem size={Math.round(size * .58)} /> : <Image source={profileAvatarSources[avatarId]} style={{ width: size * .9, height: size * .9 }} contentFit="contain" />}</View>; }
function HeroAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}><Ionicons name={icon} size={15} color={FateDropColors.goldBright} /><Text style={styles.heroActionText}>{label}</Text></Pressable>; }
function CommandCard({ item }: { item: CommandItem }) { const color = item.color || FateDropColors.goldBright; return <Pressable onPress={() => router.push(item.path)} style={({ pressed }) => [styles.commandCard, pressed && styles.pressed]}><View style={styles.commandTop}><View style={[styles.commandIcon, { borderColor: `${color}38`, backgroundColor: `${color}0E` }]}><Ionicons name={item.icon} size={18} color={color} /></View>{item.status ? <Text style={[styles.commandStatus, { color }]}>{item.status}</Text> : null}</View><Text style={styles.commandTitle}>{item.title}</Text><Text style={styles.commandDetail}>{item.detail}</Text><Ionicons name="arrow-forward" size={14} color={FateDropColors.muted} style={styles.commandArrow} /></Pressable>; }
function Divider() { return <View style={styles.divider} />; }
function Preference({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.preference, pressed && styles.pressed]}><View style={styles.preferenceIcon}><Ionicons name={icon} size={18} color={FateDropColors.goldBright} /></View><View style={styles.flex}><Text style={styles.preferenceTitle}>{title}</Text><Text style={styles.preferenceDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={16} color={FateDropColors.muted} /></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background }, content: { paddingBottom: 124 }, body: { paddingHorizontal: 18 }, flex: { flex: 1 }, pressed: { opacity: .72, transform: [{ scale: .99 }] },
  profileIdentity: { alignItems: 'center', marginBottom: 10 }, cover: { width: '100%', height: 210, overflow: 'hidden', backgroundColor: FateDropColors.surface }, coverShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,13,.12)' }, overlayHeader: { position: 'absolute', top: 10, left: 14, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, logoPlate: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, backgroundColor: 'rgba(3,7,12,.38)' }, wordmark: { width: 174, height: 58 }, membershipPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}70`, backgroundColor: 'rgba(5,10,16,.72)' }, membershipText: { color: FateDropColors.goldBright, fontSize: 9.2, fontWeight: '900', letterSpacing: .8 },
  avatarOverlap: { marginTop: -44 }, avatarFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.96)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: .32, shadowRadius: 13, elevation: 7 }, identityBlock: { alignItems: 'center', marginTop: 6, paddingHorizontal: 18 }, identityEyebrow: { color: FateDropColors.goldBright, fontSize: 8.2, fontWeight: '900', letterSpacing: 1.2 }, identityTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 22, lineHeight: 27, textAlign: 'center', marginTop: 3 }, fateIdPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(8,14,20,.72)' }, connectionDot: { width: 6, height: 6, borderRadius: 3 }, fateIdText: { color: FateDropColors.secondary, fontSize: 9.3, fontWeight: '900', letterSpacing: .35 },
  heroActionRow: { flexDirection: 'row', gap: 8, marginBottom: 11 }, heroAction: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 13, borderWidth: 1, borderColor: `${FateDropColors.gold}4D`, backgroundColor: 'rgba(14,20,28,.88)' }, heroActionText: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '800' },
  commandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, commandCard: { width: '48.5%', minHeight: 139, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,197,141,.20)', backgroundColor: 'rgba(10,15,24,.88)' }, commandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, commandIcon: { width: 37, height: 37, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, commandStatus: { fontSize: 7, fontWeight: '900', letterSpacing: .65 }, commandTitle: { color: FateDropColors.ivory, fontSize: 13, fontWeight: '900', marginTop: 10 }, commandDetail: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 13, marginTop: 4, paddingRight: 11 }, commandArrow: { position: 'absolute', right: 11, bottom: 11 },
  companionPanel: { padding: 8 }, companions: { flexDirection: 'row', gap: 5 }, companion: { flex: 1, minWidth: 0, alignItems: 'center', paddingBottom: 7 }, companionGlow: { position: 'absolute', bottom: 31, width: '82%', height: 17, borderRadius: 999, borderWidth: 1 }, companionImage: { width: '100%', height: 74 }, companionName: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '900', marginTop: -2 }, companionStage: { fontSize: 6.8, fontWeight: '900', letterSpacing: .6, marginTop: 1 },
  storiesCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.gold}4D`, backgroundColor: 'rgba(13,16,26,.92)' }, storiesIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}45`, backgroundColor: `${FateDropColors.gold}12` }, storiesTitle: { color: FateDropColors.ivory, fontFamily: Fonts.serif, fontSize: 16 }, storiesDetail: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 15, marginTop: 3 }, storiesBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}38`, backgroundColor: `${FateDropColors.gold}0D` }, storiesBadgeText: { color: FateDropColors.goldBright, fontSize: 6.8, fontWeight: '900', letterSpacing: .55 },
  panel: { borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(13,18,26,.90)', overflow: 'hidden' }, operatorPanel: { borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.cyan}42`, backgroundColor: 'rgba(12,21,28,.94)', overflow: 'hidden' }, preference: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 }, preferenceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.gold}0F`, borderWidth: 1, borderColor: `${FateDropColors.gold}32` }, preferenceTitle: { color: FateDropColors.ivory, fontSize: 14, fontWeight: '900' }, preferenceDetail: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 15, marginTop: 2 }, divider: { height: 1, backgroundColor: FateDropColors.borderSoft, marginLeft: 62 },
  signOutRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: `${FateDropColors.coral}42`, backgroundColor: 'rgba(13,18,26,.90)', marginTop: 18 }, signOutIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${FateDropColors.coral}0F`, borderWidth: 1, borderColor: `${FateDropColors.coral}32` }, signOutTitle: { color: FateDropColors.coral, fontSize: 14, fontWeight: '900' }, signOutDetail: { color: FateDropColors.secondary, fontSize: 10.5, marginTop: 2 }, footerTruth: { color: FateDropColors.muted, fontSize: 8.5, lineHeight: 13, textAlign: 'center', paddingHorizontal: 20, marginTop: 18, marginBottom: 2 },
});
