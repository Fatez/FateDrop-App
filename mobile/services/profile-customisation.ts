import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_AVATAR_IDS = ['oru', 'fenn', 'koru', 'nyxen', 'mark'] as const;

// Canonical selectable wallpaper set. Keep this list deliberately small: Koru plus
// the seven current FateDrop wallpapers are the only wallpapers exposed in Profile Customisation.
export const PROFILE_WALLPAPER_IDS = [
  'koruHome',
  'fatedrop1',
  'fatedrop2',
  'fatedrop3',
  'fatedrop4',
  'fatedrop5',
  'fatedrop6',
  'fatedrop7',
] as const;

// Historical IDs remain in the type so older persisted/profile state can be read
// safely during migration, but they are not selectable and fail closed to the
// canonical default when loaded from storage.
const LEGACY_PROFILE_WALLPAPER_IDS = [
  'default',
  'oru',
  'fenn',
  'nyxen',
  'fatedrop8',
  'fatedrop9',
  'fatedrop10',
  'fatedrop11',
  'fatedrop12',
  'fatedrop13',
  'fatedrop14',
] as const;

export type ProfileAvatarId = (typeof PROFILE_AVATAR_IDS)[number];
export type ProfileWallpaperId =
  | (typeof PROFILE_WALLPAPER_IDS)[number]
  | (typeof LEGACY_PROFILE_WALLPAPER_IDS)[number];

export type ProfileCustomisation = {
  avatarId: ProfileAvatarId;
  wallpaperId: ProfileWallpaperId;
};

export const DEFAULT_PROFILE_CUSTOMISATION: ProfileCustomisation = {
  avatarId: 'oru',
  wallpaperId: 'koruHome',
};

const STORAGE_PREFIX = 'fatedrop:profile-customisation:v1';

function storageKey(identity?: string | null) {
  return `${STORAGE_PREFIX}:${identity?.trim() || 'guest'}`;
}

function isAvatarId(value: unknown): value is ProfileAvatarId {
  return typeof value === 'string' && PROFILE_AVATAR_IDS.includes(value as ProfileAvatarId);
}

function isWallpaperId(value: unknown): value is (typeof PROFILE_WALLPAPER_IDS)[number] {
  return typeof value === 'string' && PROFILE_WALLPAPER_IDS.includes(value as (typeof PROFILE_WALLPAPER_IDS)[number]);
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
