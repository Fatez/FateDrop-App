import type { ProfileAvatarId, ProfileWallpaperId } from '@/services/profile-customisation';

export const profileAvatarSources: Record<Exclude<ProfileAvatarId, 'mark'>, number> = {
  oru: require('../assets/images/profile-oru.png'),
  fenn: require('../assets/images/profile-fenn.png'),
  koru: require('../assets/images/profile-koru.png'),
  nyxen: require('../assets/images/profile-nyxen.png'),
};

export const profileWallpaperSources: Record<ProfileWallpaperId, number> = {
  oru: require('../assets/images/profile-wallpaper-oru.jpg'),
  fenn: require('../assets/images/profile-wallpaper-fenn.jpg'),
  koru: require('../assets/images/profile-wallpaper-koru.jpg'),
  nyxen: require('../assets/images/profile-wallpaper-nyxen.jpg'),
};

export const profileCompanionMeta = {
  oru: { name: 'Oru', stage: 'Whisper' },
  fenn: { name: 'Fenn', stage: 'Echo' },
  koru: { name: 'Koru', stage: 'Manifested' },
  nyxen: { name: 'Nyxen', stage: 'Vanished' },
} as const;
