import { TextStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export type ColorToken =
  | 'bg/canvas'
  | 'bg/surface'
  | 'bg/surface-raised'
  | 'bg/sunken'
  | 'border/subtle'
  | 'border/strong'
  | 'text/primary'
  | 'text/secondary'
  | 'text/tertiary'
  | 'text/inverse'
  | 'accent/default'
  | 'accent/pressed'
  | 'accent/tint'
  | 'accent/on-accent'
  | 'semantic/success'
  | 'semantic/warning'
  | 'semantic/danger'
  | 'wellness/bg'
  | 'wellness/surface'
  | 'wellness/accent'
  | 'wellness/accent-secondary'
  | 'wellness/text-primary';

export const colors: Record<ThemeMode, Record<ColorToken, string>> = {
  light: {
    'bg/canvas': '#FAFAF9',
    'bg/surface': '#FFFFFF',
    'bg/surface-raised': '#FFFFFF',
    'bg/sunken': '#F2F1ED',
    'border/subtle': '#E7E5DF',
    'border/strong': '#CFCCC3',
    'text/primary': '#1C1B1F',
    'text/secondary': '#5B5A63',
    'text/tertiary': '#9C9AA3',
    'text/inverse': '#FFFFFF',
    'accent/default': '#4B3FE4',
    'accent/pressed': '#3C31C2',
    'accent/tint': '#EDEBFC',
    'accent/on-accent': '#FFFFFF',
    'semantic/success': '#1E9E6B',
    'semantic/warning': '#C97C1D',
    'semantic/danger': '#D53F3F',
    'wellness/bg': '#FBF3EC',
    'wellness/surface': '#FFFFFF',
    'wellness/accent': '#E0714B',
    'wellness/accent-secondary': '#7A9B7E',
    'wellness/text-primary': '#2B211B',
  },
  dark: {
    'bg/canvas': '#0F0F13',
    'bg/surface': '#1A1A20',
    'bg/surface-raised': '#22222A',
    'bg/sunken': '#15151A',
    'border/subtle': '#2E2E38',
    'border/strong': '#3D3D48',
    'text/primary': '#F5F4F2',
    'text/secondary': '#B4B2BC',
    'text/tertiary': '#78767F',
    'text/inverse': '#0F0F13',
    'accent/default': '#7A70F0',
    'accent/pressed': '#9089F4',
    'accent/tint': '#241F3D',
    'accent/on-accent': '#0F0F13',
    'semantic/success': '#3DDB9A',
    'semantic/warning': '#F0A64B',
    'semantic/danger': '#F26E6E',
    'wellness/bg': '#201A17',
    'wellness/surface': '#2A211C',
    'wellness/accent': '#F0916D',
    'wellness/accent-secondary': '#93B597',
    'wellness/text-primary': '#F3EAE4',
  },
};

export const fontFamily = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extrabold: 'Manrope-ExtraBold',
} as const;

export type TypeToken =
  | 'type/display'
  | 'type/h1'
  | 'type/h2'
  | 'type/h3'
  | 'type/body-l'
  | 'type/body-m'
  | 'type/body-m-medium'
  | 'type/caption'
  | 'type/overline'
  | 'type/numeral-display';

export const typography: Record<TypeToken, TextStyle> = {
  'type/display': { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 41 },
  'type/h1': { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34 },
  'type/h2': { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28 },
  'type/h3': { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
  'type/body-l': { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  'type/body-m': { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  'type/body-m-medium': { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  'type/caption': { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  'type/overline': {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  'type/numeral-display': {
    fontFamily: fontFamily.extrabold,
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
};

export const space = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 64,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

/**
 * "Wellness bump": inside Support-section screens only, add +6 to whichever
 * radius token is used. Call this to derive the bumped value.
 */
export function wellnessRadius(value: number): number {
  return value + 6;
}
