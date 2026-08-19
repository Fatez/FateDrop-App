import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const FateDropColors = {
  background: '#070810',
  card: '#11131D',
  cardElevated: '#181B29',
  border: '#292D40',
  shell: '#0D0F18',
  text: '#F5F7FA',
  secondary: '#8A8E9D',
  muted: '#666B7A',
  violet: '#7C3AED',
  violetLight: '#A855F7',
  mint: '#49E6B1',
  coral: '#FF647C',
  amber: '#F6B94A',
  blue: '#58A6FF',
  inactive: '#666B7A',
  cyan: '#67E8F9',
  glass: 'rgba(17, 19, 29, 0.88)',
} as const;

export const FateDropSpacing = {
  page: 20,
  section: 24,
  cardGap: 10,
  cardRadius: 18,
  heroRadius: 22,
  inputRadius: 12,
  borderWidth: 1,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
