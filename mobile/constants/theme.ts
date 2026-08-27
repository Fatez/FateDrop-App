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

/**
 * FateDrop mobile brand tokens.
 *
 * The warm collector palette is the default frame. Lifecycle colours are owned
 * by the companion assigned to each alert stage so App and Web teach one visual
 * language: Oru/Whisper gold, Fenn/Echo warm beige, Koru/Manifested violet,
 * Nyxen/Vanished crimson.
 * Legacy aliases remain while older screens are migrated onto the shared tokens.
 */
export const FateDropColors = {
  ink: '#080E14',
  background: '#080E14',
  shell: '#0D131B',
  surface: '#121820',
  card: '#181C27',
  cardElevated: '#202633',
  border: '#3A3429',
  borderSoft: '#2B3038',
  text: '#F2E9DA',
  ivory: '#F2E9DA',
  secondary: '#B9AD9A',
  muted: '#80776A',
  inactive: '#69655F',
  gold: '#C7A66A',
  goldBright: '#E2C58D',
  bronze: '#8D6847',
  bronzeDeep: '#5E4938',

  // Lifecycle / companion semantics.
  whisper: '#D2B66F', // Oru · gold
  echo: '#D9CDBB', // Fenn · warm ivory / beige
  manifested: '#7C6EFF', // Koru · violet
  vanished: '#EF4D5A', // Nyxen · crimson

  success: '#6ECF8B',
  warning: '#E0A65A',
  error: '#EF4D5A',

  // Transitional aliases used by existing screens.
  violet: '#7C6EFF',
  violetLight: '#A899FF',
  cyan: '#63E1FF',
  mint: '#6ECF8B',
  coral: '#EF4D5A',
  amber: '#E0A65A',
  blue: '#70A9FF',
  glass: 'rgba(18, 24, 32, 0.92)',
} as const;

export const FateDropLifecycleColors = {
  WHISPER: FateDropColors.whisper,
  ECHO: FateDropColors.echo,
  MANIFESTED: FateDropColors.manifested,
  VANISHED: FateDropColors.vanished,
} as const;

export const FateDropSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  page: 18,
  section: 24,
  cardGap: 10,
  cardRadius: 18,
  heroRadius: 24,
  inputRadius: 13,
  borderWidth: 1,
} as const;

export const FateDropTypography = {
  metadata: 12,
  small: 13,
  body: 15,
  cardTitle: 17,
  sectionTitle: 21,
  screenTitle: 30,
  display: 34,
} as const;

export const FateDropRadii = {
  chip: 999,
  control: 12,
  card: 18,
  hero: 24,
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
