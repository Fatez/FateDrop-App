import type { ProfileAvatarId, ProfileWallpaperId } from '@/services/profile-customisation';

export const profileAvatarSources: Record<Exclude<ProfileAvatarId, 'mark'>, number> = {
  oru: require('../assets/images/profile-avatar-oru.png'),
  fenn: require('../assets/images/profile-avatar-fenn.png'),
  koru: require('../assets/images/profile-avatar-koru.png'),
  nyxen: require('../assets/images/profile-avatar-nyxen.png'),
};

export const profileCompanionSources = {
  oru: require('../assets/images/profile-avatar-oru.png'),
  fenn: require('../assets/images/profile-avatar-fenn.png'),
  koru: require('../assets/images/profile-avatar-koru.png'),
  nyxen: require('../assets/images/profile-avatar-nyxen.png'),
} as const;

const wallpaper1 = require('../assets/images/wallpapers/wallpaper-1.png');
const wallpaper2 = require('../assets/images/wallpapers/wallpaper-2.png');
const wallpaper3 = require('../assets/images/wallpapers/wallpaper-3.png');
const wallpaper4 = require('../assets/images/wallpapers/wallpaper-4.png');
const wallpaper5 = require('../assets/images/wallpapers/wallpaper-5.png');

// Only fatedrop1..5 are selectable. Legacy IDs are retained as safe aliases so a
// stale in-memory value can never reference a removed asset while storage migrates.
export const profileWallpaperSources: Record<ProfileWallpaperId, number> = {
  fatedrop1: wallpaper1,
  fatedrop2: wallpaper2,
  fatedrop3: wallpaper3,
  fatedrop4: wallpaper4,
  fatedrop5: wallpaper5,
  koruHome: wallpaper1,
  default: wallpaper1,
  oru: wallpaper1,
  fenn: wallpaper1,
  nyxen: wallpaper1,
  fatedrop6: wallpaper1,
  fatedrop7: wallpaper1,
  fatedrop8: wallpaper1,
  fatedrop9: wallpaper1,
  fatedrop10: wallpaper1,
  fatedrop11: wallpaper1,
  fatedrop12: wallpaper1,
  fatedrop13: wallpaper1,
  fatedrop14: wallpaper1,
};

// Five full-resolution assets are intentionally reused in the picker. Expo Image
// handles resizing/caching, so we do not carry a second thumbnail asset set.
export const profileWallpaperThumbnailSources: Record<ProfileWallpaperId, number> = {
  fatedrop1: wallpaper1,
  fatedrop2: wallpaper2,
  fatedrop3: wallpaper3,
  fatedrop4: wallpaper4,
  fatedrop5: wallpaper5,
  koruHome: wallpaper1,
  default: wallpaper1,
  oru: wallpaper1,
  fenn: wallpaper1,
  nyxen: wallpaper1,
  fatedrop6: wallpaper1,
  fatedrop7: wallpaper1,
  fatedrop8: wallpaper1,
  fatedrop9: wallpaper1,
  fatedrop10: wallpaper1,
  fatedrop11: wallpaper1,
  fatedrop12: wallpaper1,
  fatedrop13: wallpaper1,
  fatedrop14: wallpaper1,
};

export const profileWallpaperMeta: Record<ProfileWallpaperId, { name: string; accent: string }> = {
  fatedrop1: { name: 'Violet Horizon', accent: '#7C6EFF' },
  fatedrop2: { name: 'Crimson Moon', accent: '#EF4D5A' },
  fatedrop3: { name: 'FateDrop Citadel', accent: '#D6BA73' },
  fatedrop4: { name: 'Twin Horizon', accent: '#9A7CFF' },
  fatedrop5: { name: 'Solix', accent: '#D6BA73' },
  koruHome: { name: 'Archived', accent: '#7C6EFF' },
  default: { name: 'Archived', accent: '#D6BA73' },
  oru: { name: 'Archived', accent: '#7C6EFF' },
  fenn: { name: 'Archived', accent: '#D9CDBB' },
  nyxen: { name: 'Archived', accent: '#EF4D5A' },
  fatedrop6: { name: 'Archived', accent: '#7C6EFF' },
  fatedrop7: { name: 'Archived', accent: '#7C6EFF' },
  fatedrop8: { name: 'Archived', accent: '#D6BA73' },
  fatedrop9: { name: 'Archived', accent: '#66D9E8' },
  fatedrop10: { name: 'Archived', accent: '#9A7CFF' },
  fatedrop11: { name: 'Archived', accent: '#D6BA73' },
  fatedrop12: { name: 'Archived', accent: '#7C6EFF' },
  fatedrop13: { name: 'Archived', accent: '#C9A96A' },
  fatedrop14: { name: 'Archived', accent: '#66D9E8' },
};

export const profileCompanionMeta = {
  oru: { name: 'Oru', stage: 'Whisper' },
  fenn: { name: 'Fenn', stage: 'Echo' },
  koru: { name: 'Koru', stage: 'Manifested' },
  nyxen: { name: 'Nyxen', stage: 'Vanished' },
} as const;
