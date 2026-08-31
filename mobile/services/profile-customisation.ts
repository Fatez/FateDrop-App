import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_AVATAR_IDS = ['oru', 'fenn', 'koru', 'nyxen', 'mark'] as const;
export const PROFILE_WALLPAPER_IDS = ['default', 'oru', 'fenn', 'koru', 'nyxen', 'fatedrop1'] as const;

export type ProfileAvatarId = (typeof PROFILE_AVATAR_IDS)[number];
export type ProfileWallpaperId = (typeof PROFILE_WALLPAPER_IDS)[number];

export type ProfileCustomisation = {
  avatarId: ProfileAvatarId;
  wallpaperId: ProfileWallpaperId;
};

export const DEFAULT_PROFILE_CUSTOMISATION: ProfileCustomisation = {
  avatarId: 'oru',
  wallpaperId: 'default',
};

const STORAGE_PREFIX = 'fatedrop:profile-customisation:v1';

function storageKey(identity?: string | null) {
  return `${STORAGE_PREFIX}:${identity?.trim() || 'guest'}`;
}

function isAvatarId(value: unknown): value is ProfileAvatarId {
  return typeof value === 'string' && PROFILE_AVATAR_IDS.includes(value as ProfileAvatarId);
}

function isWallpaperId(value: unknown): value is ProfileWallpaperId {
  return typeof value === 'string' && PROFILE_WALLPAPER_IDS.includes(value as ProfileWallpaperId);
}

export async function loadProfileCustomisation(identity?: string | null): Promise<ProfileCustomisation> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(identity));
    if (!raw) return DEFAULT_PROFILE_CUSTOMISATION;
    const parsed = JSON.parse(raw) as Partial<ProfileCustomisation>;
    return {
      avatarId: isAvatarId(parsed.avatarId) ? parsed.avatarId : DEFAULT_PROFILE_CUSTOMISATION.avatarId,
      wallpaperId: isWallpaperId(parsed.wallpaperId) ? parsed.wallpaperId : DEFAULT_PROFILE_CUSTOMISATION.wallpaperId,
    };
  } catch {
    return DEFAULT_PROFILE_CUSTOMISATION;
  }
}

export async function saveProfileCustomisation(identity: string | null | undefined, value: ProfileCustomisation): Promise<void> {
  await AsyncStorage.setItem(storageKey(identity), JSON.stringify(value));
}

export async function resetProfileCustomisation(identity?: string | null): Promise<ProfileCustomisation> {
  await AsyncStorage.removeItem(storageKey(identity));
  return DEFAULT_PROFILE_CUSTOMISATION;
}
