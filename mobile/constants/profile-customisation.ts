import type { ProfileAvatarId, ProfileWallpaperId } from '@/services/profile-customisation';

export const profileAvatarSources: Record<Exclude<ProfileAvatarId, 'mark'>, number> = {
  oru: require('../assets/images/alert-oru-hero-final.webp'),
  fenn: require('../assets/images/alert-fenn-hero-final.webp'),
  koru: require('../assets/images/alert-koru-hero-final.webp'),
  nyxen: require('../assets/images/alert-nyxen-hero-final.webp'),
};

export const profileWallpaperBase = require('../assets/images/FDwallpaper.png');

export const profileWallpaperMeta: Record<ProfileWallpaperId, { name: string; accent: string; glow: string }> = {
  oru: { name: 'Oru', accent: '#D6BA73', glow: 'rgba(99, 116, 55, .42)' },
  fenn: { name: 'Fenn', accent: '#C3A361', glow: 'rgba(86, 111, 68, .42)' },
  koru: { name: 'Koru', accent: '#7BDCF4', glow: 'rgba(72, 86, 198, .42)' },
  nyxen: { name: 'Nyxen', accent: '#EF4D5A', glow: 'rgba(150, 26, 48, .42)' },
};

export const profileCompanionMeta = {
  oru: { name: 'Oru', stage: 'Whisper' },
  fenn: { name: 'Fenn', stage: 'Echo' },
  koru: { name: 'Koru', stage: 'Manifested' },
  nyxen: { name: 'Nyxen', stage: 'Vanished' },
} as const;
