import { Platform } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

// No screen anywhere overrode this, so every stack was falling back to
// react-native-screens' default — which is an unanimated cut on web and
// inconsistent across Android versions. Pin one explicit, consistent transition
// and share it between every Stack navigator in the app (including the root one).
export const stackAnimation = Platform.OS === 'web' ? 'fade' : 'slide_from_right';

export function useStackScreenOptions() {
  const { color, type } = useTheme();
  return {
    headerShown: false,
    headerStyle: { backgroundColor: color('bg/surface') },
    headerTintColor: color('text/primary'),
    headerTitleStyle: {
      fontFamily: type['type/h3'].fontFamily,
      fontSize: type['type/h3'].fontSize,
      color: color('text/primary'),
    },
    contentStyle: { backgroundColor: color('bg/canvas') },
    animation: stackAnimation,
  } as const;
}
