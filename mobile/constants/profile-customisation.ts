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

export const profileWallpaperSources: Record<ProfileWallpaperId, number> = {
  koruHome: require('../assets/images/home-koru-hero.png.png'),
  default: require('../assets/images/default-image.png'),
  oru: require('../assets/images/profile-wallpaper-oru.jpeg'),
  fenn: require('../assets/images/profile-wallpaper-fenn.jpeg'),
  nyxen: require('../assets/images/profile-wallpaper-nyxen.jpeg'),
  fatedrop1: require('../assets/images/fatedrop-app-wallpaper1.png'),
  fatedrop2: require('../assets/images/fdwallpaper2.png'),
  fatedrop3: require('../assets/images/fdwallpaper3.png'),
  fatedrop4: require('../assets/images/fdwallpaper4.png'),
  fatedrop5: require('../assets/images/fdwallpaper5.png'),
  fatedrop6: require('../assets/images/fdwallpaper6.png'),
  fatedrop7: require('../assets/images/fdwallpaper7.png'),
  fatedrop8: require('../assets/images/fdwallpaper8.png'),
  fatedrop9: require('../assets/images/fdwallpaper9.png'),
  fatedrop10: require('../assets/images/fdwallpaper10.png'),
  fatedrop11: require('../assets/images/fdwallpaper11.png'),
  fatedrop12: require('../assets/images/fdwallpaper12.png'),
  fatedrop13: require('../assets/images/fdwallpaper13.jpg'),
  fatedrop14: require('../assets/images/fdwallpaper14.png'),
};

export const profileWallpaperMeta: Record<ProfileWallpaperId, { name: string; accent: string }> = {
  koruHome: { name: 'Koru', accent: '#7C6EFF' },
  default: { name: 'Default', accent: '#D6BA73' },
  oru: { name: 'Oru', accent: '#A5B46D' },
  fenn: { name: 'Fenn', accent: '#D9CDBB' },
  nyxen: { name: 'Nyxen', accent: '#EF4D5A' },
  fatedrop1: { name: 'FateDrop', accent: '#D6BA73' },
  fatedrop2: { name: 'FateDrop · Cavern', accent: '#C9A96A' },
  fatedrop3: { name: 'FateDrop · Crystal', accent: '#7C6EFF' },
  fatedrop4: { name: 'FateDrop · Starlight', accent: '#D6BA73' },
  fatedrop5: { name: 'FateDrop · Tide', accent: '#66D9E8' },
  fatedrop6: { name: 'FateDrop · Ember', accent: '#9A7CFF' },
  fatedrop7: { name: 'FateDrop · 07', accent: '#7C6EFF' },
  fatedrop8: { name: 'FateDrop · 08', accent: '#D6BA73' },
  fatedrop9: { name: 'FateDrop · 09', accent: '#66D9E8' },
  fatedrop10: { name: 'FateDrop · 10', accent: '#9A7CFF' },
  fatedrop11: { name: 'FateDrop · 11', accent: '#D6BA73' },
  fatedrop12: { name: 'FateDrop · 12', accent: '#7C6EFF' },
  fatedrop13: { name: 'FateDrop · 13', accent: '#C9A96A' },
  fatedrop14: { name: 'FateDrop · 14', accent: '#66D9E8' },
};

export const profileCompanionMeta = {
  oru: { name: 'Oru', stage: 'Whisper' },
  fenn: { name: 'Fenn', stage: 'Echo' },
  koru: { name: 'Koru', stage: 'Manifested' },
  nyxen: { name: 'Nyxen', stage: 'Vanished' },
} as const;
