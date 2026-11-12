import type { ViewStyle } from 'react-native';

/** The soft card shadow used across the app. Spread it into a style: `{ ...shadow() }`. */
export function shadow(): Pick<
  ViewStyle,
  'shadowColor' | 'shadowOpacity' | 'shadowRadius' | 'shadowOffset' | 'elevation'
> {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}
