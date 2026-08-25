import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FateDropNavEmblem } from '@/components/fatedrop-nav-emblem';
import { FateDropBackground, FateDropHeader } from '@/components/fatedrop-ui';
import { ProfileWallpaperArt } from '@/components/profile-wallpaper-art';
import {
  profileAvatarSources,
  profileCompanionMeta,
  profileCompanionSources,
  profileWallpaperMeta,
} from '@/constants/profile-customisation';
import { FateDropColors, Fonts } from '@/constants/theme';
import { useFateDropId } from '@/contexts/fatedrop-id-context';
import {
  DEFAULT_PROFILE_CUSTOMISATION,
  PROFILE_AVATAR_IDS,
  PROFILE_WALLPAPER_IDS,
  loadProfileCustomisation,
  saveProfileCustomisation,
  type ProfileAvatarId,
  type ProfileCustomisation,
  type ProfileWallpaperId,
} from '@/services/profile-customisation';

type CustomisationTab = 'avatar' | 'wallpapers' | 'companions';

const companionIds = ['oru', 'fenn', 'koru', 'nyxen'] as const;
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

  function reset() {
    setDraft(DEFAULT_PROFILE_CUSTOMISATION);
  }

  const changed = draft.avatarId !== saved.avatarId || draft.wallpaperId !== saved.wallpaperId;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FateDropBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FateDropHeader title="Profile Customisation" rightAction={<MembershipPill premium={tier !== 'FREE'} />} />

        <Text style={styles.title}>Profile Customisation</Text>

        <ProfilePreview draft={draft} />

        <View style={styles.tabs}>
          <TabButton icon="person" label="Avatar" selected={tab === 'avatar'} onPress={() => setTab('avatar')} />
          <TabButton icon="image" label="Wallpapers" selected={tab === 'wallpapers'} onPress={() => setTab('wallpapers')} />
          <TabButton icon="paw" label="Companions" selected={tab === 'companions'} onPress={() => setTab('companions')} />
        </View>

        {tab === 'avatar' ? (
          <>
            <SectionLabel label="CHOOSE AVATAR" />
            <View style={styles.avatarGrid}>
              {PROFILE_AVATAR_IDS.map((id) => (
                <AvatarChoice
                  key={id}
                  id={id}
                  selected={draft.avatarId === id}
                  onPress={() => setDraft((current) => ({ ...current, avatarId: id }))}
                />
              ))}
            </View>
          </>
        ) : null}

        {tab === 'wallpapers' ? (
          <>
            <SectionLabel label="CHOOSE WALLPAPER" />
            <View style={styles.wallpaperGrid}>
              {PROFILE_WALLPAPER_IDS.map((id) => (
                <WallpaperChoice
                  key={id}
                  id={id}
                  selected={draft.wallpaperId === id}
                  onPress={() => setDraft((current) => ({ ...current, wallpaperId: id }))}
                />
              ))}
            </View>
          </>
        ) : null}

        {tab === 'companions' ? <CompanionGallery /> : null}

        <View style={styles.actions}>
          <Pressable onPress={reset} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Ionicons name="refresh-outline" size={17} color={FateDropColors.goldBright} />
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            disabled={saving || !changed}
            onPress={() => void applyAndSave()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!changed || saving) && styles.primaryDisabled,
              pressed && changed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Apply & Save'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function normaliseTab(value?: string): CustomisationTab {
  if (value === 'wallpapers' || value === 'companions') return value;
  return 'avatar';
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
      <ProfileWallpaperArt wallpaperId={draft.wallpaperId} />
      <View style={styles.previewShade} />
      <View style={styles.previewAvatarWrap}>
        <AvatarVisual avatarId={draft.avatarId} size={98} />
        <View style={styles.previewEdit}>
          <Ionicons name="pencil" size={14} color={FateDropColors.ivory} />
        </View>
      </View>
    </View>
  );
}

function WallpaperChoice({ id, selected, onPress }: { id: ProfileWallpaperId; selected: boolean; onPress: () => void }) {
  const meta = profileWallpaperMeta[id];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wallpaperChoice, selected && styles.choiceSelected, pressed && styles.pressed]}>
      <ProfileWallpaperArt wallpaperId={id} />
      <View style={styles.wallpaperShade} />
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={15} color={FateDropColors.ivory} />
        </View>
      ) : null}
      <View style={[styles.wallpaperLabelWrap, { borderTopColor: `${meta.accent}66` }]}>
        <Text style={styles.wallpaperLabel}>{meta.name}</Text>
      </View>
    </Pressable>
  );
}

function AvatarChoice({ id, selected, onPress }: { id: ProfileAvatarId; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.avatarChoice, selected && styles.avatarChoiceSelected, pressed && styles.pressed]}>
      {id === 'mark' ? (
        <FateDropNavEmblem size={40} />
      ) : (
        <Image source={profileAvatarSources[id]} style={styles.avatarChoiceImage} contentFit="contain" />
      )}
      {selected ? (
        <View style={styles.avatarCheck}>
          <Ionicons name="checkmark" size={12} color={FateDropColors.ivory} />
        </View>
      ) : null}
    </Pressable>
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

function CompanionGallery() {
  return (
    <>
      <SectionLabel label="ALERT COMPANIONS" />
      <View style={styles.companionGallery}>
        {companionIds.map((id) => {
          const meta = profileCompanionMeta[id];
          const color = companionColors[id];
          return (
            <View key={id} style={styles.companionCard}>
              <View style={[styles.companionHalo, { borderColor: `${color}66`, backgroundColor: `${color}12` }]} />
              <Image source={profileCompanionSources[id]} style={styles.companionCardImage} contentFit="contain" />
              <Text style={styles.companionName}>{meta.name}</Text>
              <Text style={[styles.companionStage, { color }]}>{meta.stage.toUpperCase()}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.companionCopy}>Oru = Whisper · Fenn = Echo · Koru = Manifested · Nyxen = Vanished</Text>
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FateDropColors.background },
  content: { paddingHorizontal: 18, paddingBottom: 124 },
  membershipPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: 'rgba(8,14,20,.84)' },
  membershipText: { color: FateDropColors.goldBright, fontSize: 9.5, fontWeight: '900', letterSpacing: .8 },
  title: { color: FateDropColors.ivory, fontFamily: Fonts?.serif, fontSize: 20, lineHeight: 24, fontWeight: '700', textAlign: 'center', marginTop: -8, marginBottom: 7 },
  preview: { height: 225, borderRadius: 21, overflow: 'hidden', borderWidth: 1, borderColor: `${FateDropColors.gold}66`, backgroundColor: FateDropColors.surface, marginBottom: 8 },
  previewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,9,14,.12)' },
  previewAvatarWrap: { position: 'absolute', left: 0, right: 0, top: 62, alignItems: 'center' },
  previewEdit: { position: 'absolute', marginLeft: 76, bottom: 3, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.94)' },
  avatarFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.84)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: .3, shadowRadius: 10, elevation: 6 },
  tabs: { flexDirection: 'row', borderRadius: 17, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', overflow: 'hidden', marginBottom: 12 },
  tab: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 15 },
  tabSelected: { borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: `${FateDropColors.gold}10` },
  tabText: { color: FateDropColors.secondary, fontSize: 11.5, fontWeight: '800' },
  tabTextSelected: { color: FateDropColors.goldBright },
  sectionLabel: { color: FateDropColors.goldBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.35, marginBottom: 8 },
  avatarGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 14 },
  avatarChoice: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${FateDropColors.gold}55`, backgroundColor: 'rgba(12,18,26,.88)', overflow: 'hidden' },
  avatarChoiceSelected: { borderWidth: 2, borderColor: FateDropColors.goldBright },
  avatarChoiceImage: { width: '94%', height: '94%' },
  avatarCheck: { position: 'absolute', right: -1, bottom: -1, width: 21, height: 21, borderRadius: 10.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: FateDropColors.shell },
  wallpaperGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9, marginBottom: 14 },
  wallpaperChoice: { width: '48.7%', aspectRatio: 1.55, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: FateDropColors.surface, justifyContent: 'flex-end' },
  wallpaperShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,11,.04)' },
  choiceSelected: { borderColor: FateDropColors.goldBright, borderWidth: 1.5 },
  wallpaperLabelWrap: { borderTopWidth: 1, backgroundColor: 'rgba(5,9,14,.76)' },
  wallpaperLabel: { color: FateDropColors.ivory, fontSize: 10.5, fontWeight: '900', textAlign: 'center', paddingVertical: 6 },
  check: { position: 'absolute', right: 6, top: 6, width: 25, height: 25, borderRadius: 12.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: FateDropColors.goldBright, backgroundColor: 'rgba(8,14,20,.88)' },
  companionGallery: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 8 },
  companionCard: { width: '48.7%', height: 178, alignItems: 'center', justifyContent: 'flex-end', borderRadius: 18, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(12,18,26,.56)', overflow: 'hidden', paddingBottom: 10 },
  companionHalo: { position: 'absolute', bottom: 44, width: '72%', height: 24, borderRadius: 999, borderWidth: 1 },
  companionCardImage: { width: '92%', height: 128 },
  companionName: { color: FateDropColors.ivory, fontSize: 12.5, fontWeight: '900', marginTop: -2 },
  companionStage: { fontSize: 8, fontWeight: '900', letterSpacing: .75, marginTop: 1 },
  companionCopy: { color: FateDropColors.secondary, fontSize: 10.5, lineHeight: 15, textAlign: 'center', marginBottom: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 3 },
  secondaryButton: { flex: .8, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: FateDropColors.borderSoft, backgroundColor: 'rgba(18,24,32,.92)', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: FateDropColors.ivory, fontSize: 12, fontWeight: '800' },
  primaryButton: { flex: 1.35, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: FateDropColors.goldBright, borderWidth: 1, borderColor: FateDropColors.gold },
  primaryDisabled: { opacity: .48 },
  primaryButtonText: { color: FateDropColors.ink, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: .72 },
});