import { DEFAULT_PROFILE_WALLPAPER_SOURCE } from '@/constants/profile-default-wallpaper';
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

export const profileWallpaperSources: Record<ProfileWallpaperId, number | { uri: string }> = {
  koruHome: require('../assets/images/home-koru-hero.webp'),
  default: DEFAULT_PROFILE_WALLPAPER_SOURCE,
  oru: require('../assets/images/alert-oru-hero-final.webp'),
  fenn: require('../assets/images/alert-fenn-hero-final.webp'),
  koru: require('../assets/images/alert-koru-hero-final.webp'),
  nyxen: require('../assets/images/alert-nyxen-hero-final.webp'),
  fatedrop1: require('../assets/images/fatedrop-app-wallpaper1.png'),
};

export const profileWallpaperMeta: Record<ProfileWallpaperId, { name: string; accent: string }> = {
  koruHome: { name: 'Koru · Network', accent: '#7C6EFF' },
  default: { name: 'Default', accent: '#D6BA73' },
  oru: { name: 'Oru', accent: '#A5B46D' },
  fenn: { name: 'Fenn', accent: '#C3A361' },
  koru: { name: 'Koru', accent: '#7BDCF4' },
  nyxen: { name: 'Nyxen', accent: '#EF4D5A' },
  fatedrop1: { name: 'FateDrop', accent: '#D6BA73' },
};

export const profileCompanionMeta = {
  oru: { name: 'Oru', stage: 'Whisper' },
  fenn: { name: 'Fenn', stage: 'Echo' },
  koru: { name: 'Koru', stage: 'Manifested' },
  nyxen: { name: 'Nyxen', stage: 'Vanished' },
} as const;
