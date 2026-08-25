import type { ProfileAvatarId, ProfileWallpaperId } from '@/services/profile-customisation';

export const profileAvatarSources: Record<Exclude<ProfileAvatarId, 'mark'>, number> = {
  oru: require('../assets/images/alert-oru.webp'),
  fenn: require('../assets/images/alert-fenn.webp'),
  koru: require('../assets/images/alert-koru.webp'),
  nyxen: require('../assets/images/alert-nyxen.webp'),
};

export const profileCompanionSources = {
  oru: require('../assets/images/alert-oru.webp'),
  fenn: require('../assets/images/alert-fenn.webp'),
  koru: require('../assets/images/alert-koru.webp'),
  nyxen: require('../assets/images/alert-nyxen.webp'),
} as const;

export const profileWallpaperSources: Record<ProfileWallpaperId, number> = {
  default: require('../assets/images/FDwallpaper.png'),
  oru: require('../assets/images/alert-oru-hero-final.webp'),
  fenn: require('../assets/images/alert-fenn-hero-final.webp'),
  koru: require('../assets/images/alert-koru-hero-final.webp'),
  nyxen: require('../assets/images/alert-nyxen-hero-final.webp'),
};

export const profileWallpaperMeta: Record<ProfileWallpaperId, { name: string; accent: string }> = {
  default: { name: 'Default', accent: '#D6BA73' },
  oru: { name: 'Oru', accent: '#A5B46D' },
  fenn: { name: 'Fenn', accent: '#C3A361' },
  koru: { name: 'Koru', accent: '#7BDCF4' },
  nyxen: { name: 'Nyxen', accent: '#EF4D5A' },
};

export const profileCompanionMeta = {
  oru: { name: 'Oru', stage: 'Whisper' },
  fenn: { name: 'Fenn', stage: 'Echo' },
  koru: { name: 'Koru', stage: 'Manifested' },
  nyxen: { name: 'Nyxen', stage: 'Vanished' },
} as const;
