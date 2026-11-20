import { View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

/**
 * A soft shade behind a row of the Schema table: the more questions, the deeper the one colour. It is the accent colour
 * at a low opacity, so it follows the theme and never hides the text. `h` is 0 to 1 (see `heat`).
 */
export function HeatFill({ h, max = 0.32 }: { h: number; max?: number }) {
  const { color } = useTheme();
  if (h <= 0) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: color('accent/default'), opacity: 0.05 + max * h }} />;
}
