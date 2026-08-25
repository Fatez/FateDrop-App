import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { profileAvatarSources, profileCompanionMeta, profileWallpaperSources } from '@/constants/profile-customisation';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  DEFAULT_PROFILE_CUSTOMISATION,
  PROFILE_AVATAR_IDS,
  PROFILE_WALLPAPER_IDS,
  loadProfileCustomisation,
  resetProfileCustomisation,
  saveProfileCustomisation,
  type ProfileAvatarId,
  type ProfileCustomisation,
  type ProfileWallpaperId,
} from '@/services/profile-customisation';

type CustomisationTab = 'avatar' | 'wallpapers' | 'companions';

const companionColors = {
  oru: FateDropColors.whisper,
  fenn: FateDropColors.echo,
  koru: FateDropColors.manifested,
  nyxen: FateDropColors.vanished,
} as const;

export default function ProfileCustomisationScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { snapshot } = useFateDropId();
  const identity = snapshot?.user.fateId || 'guest';
  const tier = snapshot?.entitlement.effectiveTier?.toUpperCase() || 'FREE';
  const [saved, setSaved] = useState<ProfileCustomisation>(DEFAULT_PROFILE_CUSTOMISATION);
  const [draft, setDraft] = useState<ProfileCustomisation>(DEFAULT_PROFILE_CUSTOMISATION);
  const [saving, setSaving] = useState(false);
  const initialTab = useMemo<CustomisationTab>(() => normaliseTab(params.tab), [params.tab]);
  const [tab, setTab] = useState<CustomisationTab>(initialTab);

  useEffect(() => {
    let active = true;
    void loadProfileCustomisation(identity).then((next) => {
      if (!active) return;
      setSaved(next);
      setDraft(next);
    });
    return () => {
      active = false;
    };
  }, [identity]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function applyAndSave() {
    if (saving) return;
    setSaving(true);
    try {
      await saveProfileCustomisation(identity, draft);
      setSaved(draft);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const next = await resetProfileCustomisation(identity);
    setSaved(next);
    setDraft(next);
  }

  const changed = draft.avatarId !== saved.avatarId || draft.wallpaperId !== saved.wallpaperId;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="Profile Customisation" rightAction={<MembershipPill premium={tier !== 'FREE'} />} />

        <Text style={styles.title}>Profile Customisation</Text>
        <Text style={styles.subtitle}>Personalise your profile with avatars and wallpapers.</Text>

        <View style={styles.tabs}>
          <TabButton icon="person" label="Avatar" selected={tab === 'avatar'} onPress={() => setTab('avatar')} />
          <TabButton icon="image" label="Wallpapers" selected={tab === 'wallpapers'} onPress={() => setTab('wallpapers')} />
          <TabButton icon="paw" label="Companions" selected={tab === 'companions'} onPress={() => setTab('companions')} />
        </View>

        <ProfilePreview draft={draft} />

        {tab === 'companions' ? (
          <CompanionGallery />
        ) : (
          <>
            {tab === 'wallpapers' ? (
              <>
                <SectionLabel label="CHOOSE WALLPAPER" />
                <View style={styles.wallpaperGrid}>
                  {PROFILE_WALLPAPER_IDS.map((id) => (
                    <WallpaperChoice key={id} id={id} selected={draft.wallpaperId === id} onPress={() => setDraft((current) => ({ ...current, wallpaperId: id }))} />
                  ))}
                </View>
              </>
            ) : null}

            <SectionLabel label="CHOOSE AVATAR" />
            <View style={styles.avatarGrid}>
              {PROFILE_AVATAR_IDS.map((id) => (
                <AvatarChoice key={id} id={id} selected={draft.avatarId === id} onPress={() => setDraft((current) => ({ ...current, avatarId: id }))} />
              ))}
            </View>

            {tab === 'avatar' ? (
              <>
                <SectionLabel label="MATCH A WALLPAPER" />
                <View style={styles.wallpaperStrip}>
                  {PROFILE_WALLPAPER_IDS.map((id) => (
                    <CompactWallpaperChoice key={id} id={id} selected={draft.wallpaperId === id} onPress={() => setDraft((current) => ({ ...current, wallpaperId: id }))} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        <View style={styles.actions}>
          <Pressable onPress={() => setDraft(saved)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Ionicons name="eye-outline" size={17} color={FateDropColors.goldBright} />
            <Text style={styles.secondaryButtonText}>Preview</Text>
          </Pressable>
          <Pressable onPress={() => void reset()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Ionicons name="refresh-outline" size={17} color={FateDropColors.goldBright} />
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable disabled={saving || !changed} onPress={() => void applyAndSave()} style={({ pressed }) => [styles.primaryButton, (!changed || saving) && styles.primaryDisabled, pressed && changed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Apply & Save'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function normaliseTab(value?: string): CustomisationTab {
  if (value === 'avatar' || value === 'companions') return value;
  return 'wallpapers';
}

function MembershipPill({ premium }: { premium: boolean }) {
  return (
    <View style={styles.membershipPill}>
      <Ionicons name={premium ? 'diamond-outline' : 'person-outline'} size={13} color={FateDropColors.goldBright} />
      <Text style={styles.membershipText}>{premium ? 'PREMIUM MEMBER' : 'FREE MEMBER'}</Text>
    </View>
  );
}

function TabButton({ icon, label, selected, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.pressed]}>
      <Ionicons name={icon} size={17} color={selected ? FateDropColors.goldBright : FateDropColors.secondary} />
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ProfilePreview({ draft }: { draft: ProfileCustomisation }) {
  return (
    <View style={styles.preview}>
      <Image source={profileWallpaperSources[draft.wallpaperId]} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={styles.previewShade} />
      <View style={styles.previewAvatar}>
        <AvatarVisual avatarId={draft.avatarId} size={104} />
        <View style={styles.previewEdit}><Ionicons name="pencil" size={14} color={FateDropColors.ivory} /></View>
      </View>
      {draft.avatarId !== 'mark' ? <Image source={profileAvatarSources[draft.avatarId]} style={styles.previewCharacter} contentFit="contain" contentPosition="center bottom" /> : null}
    </View>
  );
}

function WallpaperChoice({ id, selected, onPress }: { id: ProfileWallpaperId; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wallpaperChoice, selected && styles.choiceSelected, pressed && styles.pressed]}>
      <Image source={profileWallpaperSources[id]} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={styles.wallpaperShade} />
      {selected ? <View style={styles.check}><Ionicons name="checkmark" size={16} color={FateDropColors.ivory} /></View> : null}
      <Text style={styles.wallpaperLabel}>{profileCompanionMeta[id].name}</Text>
    </Pressable>
  );
}

function CompactWallpaperChoice({ id, selected, onPress }: { id: ProfileWallpaperId; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.compactWallpaper, selected && styles.choiceSelected, pressed && styles.pressed]}>
      <Image source={profileWallpaperSources[id]} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={styles.wallpaperShade} />
      <Text style={styles.compactWallpaperText}>{profileCompanionMeta[id].name}</Text>
    </Pressable>
  );
}

function AvatarChoice({ id, selected, onPress }: { id: ProfileAvatarId; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.avatarChoice, selected && styles.avatarChoiceSelected, pressed && styles.pressed]}>
      {id === 'mark' ? <FateDropNavEmblem size={42} /> : <Image source={profileAvatarSources[id]} style={styles.avatarChoiceImage} contentFit="contain" />}
      {selected ? <View style={styles.avatarCheck}><Ionicons name="checkmark" size={12} color={FateDropColors.ivory} /></View> : null}
    </Pressable>
  );
}

function AvatarVisual({ avatarId, size }: { avatarId: ProfileAvatarId; size: number }) {
  return (
    <View style={[styles.avatarFrame, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarId === 'mark' ? <FateDropNavEmblem size={Math.round(size * .58)} /> : <Image source={profileAvatarSources[avatarId]} style={{ width: size * .92, height: size * .92 }} contentFit="contain" />}
    </View>
  );
}

function CompanionGallery() {
  return (
    <>
      <SectionLabel label="ALERT COMPANIONS" />
      <Text style={styles.companionCopy}>The lifecycle voices stay fixed: Oru = Whisper, Fenn = Echo, Koru = Manifested and Nyxen = Vanished. This gallery changes presentation only; it never rewrites Cloud lifecycle truth.</Text>
      <View style={styles.companionGallery}>
        {PROFILE_WALLPAPER_IDS.map((id) => {
          const meta = profileCompanionMeta[id];
          const color = companionColors[id];
          return (
            <View key={id} style={styles.companionCard}>
              <View style={[styles.companionHalo, { borderColor: `${color}66`, backgroundColor: `${color}10` }]} />
              <Image source={profileAvatarSources[id]} style={styles.companionCardImage} contentFit="contain" contentPosition="center bottom" />
              <Text style={styles.companionName}>{meta.name}</Text>
              <Text style={[styles.companionStage, { color }]}>{meta.stage.toUpperCase()}</Text>
            </View>
          );
        })}
      </View>
      <Pressable onPress={() => router.push('/companion')} style={({ pressed }) => [styles.manageCompanionButton, pressed && styles.pressed]}>
        <Ionicons name="paw-outline" size={17} color={FateDropColors.goldBright} />
        <Text style={styles.manageCompanionText}>Open companion preview</Text>
        <Ionicons name="chevron-forward" size={15} color={FateDropColors.muted} />
      </Pressable>
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  membershipPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: 'rgba(8,14,20,.84)' },
  membershipText: { color: FateDropColors.goldBright, fontSize: 9.5, fontWeight: '900', letterSpacing: .8 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 29, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  subtitle: { color: FateDropColors.secondary, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 5, marginBottom: 16 },
  tabs: { flexDirection: 'row', borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', overflow: 'hidden', marginBottom: 12 },
  tab: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 15 },
  tabSelected: { borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: `${FateDropColors.gold}10` },
  tabText: { color: FateDropColors.secondary, fontSize: 12, fontWeight: '800' },
  tabTextSelected: { color: FateDropColors.goldBright },

  preview: { height: 266, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: FateDropColors.surface, marginBottom: 20 },
  previewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,9,14,.28)' },
  previewAvatar: { position: 'absolute', left: '36%', top: 62 },
  previewEdit: { position: 'absolute', right: -3, bottom: 4, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.94)' },
  previewCharacter: { position: 'absolute', right: 8, bottom: -5, width: '42%', height: '82%' },
  avatarFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.8)' },

  sectionLabel: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.35, marginBottom: 9, marginTop: 2 },
  wallpaperGrid: { flexDirection: 'row', gap: 7, marginBottom: 20 },
  wallpaperChoice: { flex: 1, aspectRatio: .62, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, justifyContent: 'flex-end' },
  wallpaperShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,11,.12)' },
  choiceSelected: { borderColor: FateDropColors.goldBright, borderWidth: 1.5 },
  wallpaperLabel: { color: FateDropColors.ivory, fontSize: 11, fontWeight: '900', textAlign: 'center', paddingVertical: 7, backgroundColor: 'rgba(5,9,14,.7)' },
  check: { position: 'absolute', right: 6, top: 6, width: 27, height: 27, borderRadius: 13.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.85)' },

  avatarGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 7, marginBottom: 20 },
  avatarChoice: { flex: 1, maxWidth: 70, aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: 'rgba(12,18,26,.88)', overflow: 'hidden' },
  avatarChoiceSelected: { borderWidth: 2, borderColor: FateDropColors.goldBright },
  avatarChoiceImage: { width: '92%', height: '92%' },
  avatarCheck: { position: 'absolute', right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: FateDropColors.shell },

  wallpaperStrip: { flexDirection: 'row', gap: 7, marginBottom: 20 },
  compactWallpaper: { flex: 1, aspectRatio: 1.3, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: FateDropColors.borderSoft, justifyContent: 'flex-end' },
  compactWallpaperText: { color: FateDropColors.ivory, fontSize: 9.5, fontWeight: '900', textAlign: 'center', paddingVertical: 5, backgroundColor: 'rgba(5,9,14,.68)' },

  companionCopy: { color: FateDropColors.secondary, fontSize: 12, lineHeight: 18, marginBottom: 13 },
  companionGallery: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  companionCard: { flex: 1, alignItems: 'center', minWidth: 0 },
  companionHalo: { position: 'absolute', bottom: 33, width: '82%', height: 18, borderRadius: 999, borderWidth: 1 },
  companionCardImage: { width: '100%', aspectRatio: .76 },
  companionName: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '900', marginTop: -4 },
  companionStage: { fontSize: 7.5, fontWeight: '900', letterSpacing: .7, marginTop: 1 },
  manageCompanionButton: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', marginBottom: 20 },
  manageCompanionText: { flex: 1, color: FateDropColors.ivory, fontSize: 13, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 3 },
  secondaryButton: { flex: .75, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '800' },
  primaryButton: { flex: 1.3, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright, borderWidth: 1, borderColor: FateDropColors.gold },
  primaryDisabled: { opacity: .48 },
  primaryButtonText: { color: FateDropColors.ink, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: .72 },
});
