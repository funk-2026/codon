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
  | 'action/primary'
  | 'action/primary-pressed'
  | 'action/on-primary'
  | 'header/bg'
  | 'header/text'
  | 'header/text-secondary'
  | 'header/chip'
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
  | 'wellness/header'
  | 'wellness/surface'
  | 'wellness/accent'
  | 'wellness/accent-secondary'
  | 'wellness/text-primary'
  | 'media/paper';

/**
 * Codon palette — "Ice and navy". Light only.
 *
 * - header/*  : ice-blue band at the top of main screens (home, practice, results).
 * - action/*  : deep navy, for primary buttons (filled CTAs) only.
 * - accent/*  : bright cobalt, for everything interactive that isn't a CTA —
 *               progress, selection, active tabs, links, toggles, chips.
 * - highlight : saffron, reserved for streaks, rewards and achievements.
 * - semantic  : answer/feedback colours; clear but not neon.
 */
export const colors: Record<ColorToken, string> = {
  'bg/canvas': '#F3F7FC',
  'bg/surface': '#FFFFFF',
  'bg/surface-raised': '#FFFFFF',
  'bg/sunken': '#E2EAF5',
  'border/subtle': '#D9E3F0',
  'border/strong': '#BFCEE2',
  'text/primary': '#0C1A30',
  'text/secondary': '#455873',
  'text/tertiary': '#8696AE',
  'text/inverse': '#FFFFFF',
  'accent/default': '#2563C9',
  'accent/pressed': '#1D4FA3',
  'accent/tint': '#E2EDFB',
  'accent/on-accent': '#FFFFFF',
  'action/primary': '#12306B',
  'action/primary-pressed': '#0C2250',
  'action/on-primary': '#FFFFFF',
  'header/bg': '#CFE3F8',
  'header/text': '#0B2447',
  'header/text-secondary': '#44668F',
  'header/chip': 'rgba(11, 36, 71, 0.09)',
  'highlight/default': '#E98A00',
  'highlight/tint': '#FDF0D3',
  'highlight/on-tint': '#7A4E00',
  'semantic/success': '#1F9A5B',
  'semantic/warning': '#B97708',
  'semantic/danger': '#D03B2C',
  'semantic/success-tint': '#E1F4E8',
  'semantic/warning-tint': '#FCF0D6',
  'semantic/danger-tint': '#FCE9E6',
  'wellness/bg': '#FFF5EE',
  'wellness/header': '#FBE1D2',
  'wellness/surface': '#FFFFFF',
  'wellness/accent': '#E2704A',
  'wellness/accent-secondary': '#5C9A72',
  'wellness/text-primary': '#2B211B',
  'media/paper': '#FFFFFF',
};

export const fontFamily = {
  regular: 'Figtree-Regular',
  medium: 'Figtree-Medium',
  semibold: 'Figtree-SemiBold',
  bold: 'Figtree-Bold',
  extrabold: 'Figtree-ExtraBold',
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
