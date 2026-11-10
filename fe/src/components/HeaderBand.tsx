import { StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

export type HeaderBandProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Full-bleed ice-blue band at the top of main screens (Home, Practice, Results).
 * Extends under the status bar, so screens using it should not wrap themselves
 * in a top-inset SafeAreaView. Text inside should use the `header/*` colour tokens.
 */
export function HeaderBand({ children, style }: HeaderBandProps) {
  const { color, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          backgroundColor: color('header/bg'),
          paddingTop: insets.top + space.md,
          paddingBottom: space.lg,
          paddingHorizontal: space.md,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
