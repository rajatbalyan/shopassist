import { Platform, type TextStyle } from 'react-native';

/**
 * ShopAssist design tokens. Text/background pairs are chosen for WCAG AA contrast
 * in both themes.
 */
export const Colors = {
  light: {
    background: '#F7F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EFEEF8',
    text: '#14131F',
    textSecondary: '#5F5D70',
    border: '#E2E1EC',
    primary: '#5B4CF0',
    primaryText: '#FFFFFF',
    primarySoft: '#ECEAFE',
    success: '#1A7F4B',
    warning: '#A35B00',
    danger: '#C62839',
    sponsoredBg: '#FFF3D6',
    sponsoredText: '#7A4A00',
    star: '#E8A317',
    skeleton: '#E6E5EF',
    skeletonHighlight: '#F4F3FA',
    overlay: 'rgba(20, 19, 31, 0.45)',
  },
  dark: {
    background: '#0E0D16',
    surface: '#1A1926',
    surfaceAlt: '#252336',
    text: '#F3F2FA',
    textSecondary: '#A9A7BC',
    border: '#2F2D42',
    primary: '#8B80FF',
    primaryText: '#0E0D16',
    primarySoft: '#2B2752',
    success: '#4CC38A',
    warning: '#F2B24C',
    danger: '#FF6B78',
    sponsoredBg: '#3A2E12',
    sponsoredText: '#FFD58A',
    star: '#F5C04A',
    skeleton: '#232134',
    skeletonHighlight: '#2E2C42',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof ThemeColors;

/** 4-pt spacing scale. */
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Minimum touch target (spec: ≥ 44 pt). */
export const TouchTarget = 44;

export const Typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  price: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});
