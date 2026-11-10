import { TextStyle } from 'react-native';

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
  | 'highlight/default'
  | 'highlight/tint'
  | 'highlight/on-tint'
  | 'semantic/success'
  | 'semantic/warning'
  | 'semantic/danger'
  | 'semantic/success-tint'
  | 'semantic/warning-tint'
  | 'semantic/danger-tint'
  | 'wellness/bg'
  | 'wellness/surface'
  | 'wellness/accent'
  | 'wellness/accent-secondary'
  | 'wellness/text-primary'
  | 'media/paper';

/**
 * Codon palette — "Ink navy and saffron". Light only.
 *
 * - Navy is the single brand/interactive colour (buttons, active tabs, progress, links).
 * - Saffron ("highlight") is reserved for streaks, rewards and achievements — use sparingly.
 * - Semantic colours are muted so answer feedback reads clearly without glare.
 */
export const colors: Record<ColorToken, string> = {
  'bg/canvas': '#F8F7F4',
  'bg/surface': '#FFFFFF',
  'bg/surface-raised': '#FFFFFF',
  'bg/sunken': '#F0EEE9',
  'border/subtle': '#E6E4DE',
  'border/strong': '#D2CFC7',
  'text/primary': '#1B2230',
  'text/secondary': '#556070',
  'text/tertiary': '#939AA5',
  'text/inverse': '#FFFFFF',
  'accent/default': '#1F3A5F',
  'accent/pressed': '#162B47',
  'accent/tint': '#EAF0F6',
  'accent/on-accent': '#FFFFFF',
  'highlight/default': '#D99A2B',
  'highlight/tint': '#FBF1DC',
  'highlight/on-tint': '#86590E',
  'semantic/success': '#2F7D4F',
  'semantic/warning': '#A86A12',
  'semantic/danger': '#B3402F',
  'semantic/success-tint': '#E7F3EC',
  'semantic/warning-tint': '#FBF1DE',
  'semantic/danger-tint': '#FBEBE9',
  'wellness/bg': '#FBF4EE',
  'wellness/surface': '#FFFFFF',
  'wellness/accent': '#C46A4A',
  'wellness/accent-secondary': '#6F8F74',
  'wellness/text-primary': '#2B211B',
  'media/paper': '#FFFFFF',
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
