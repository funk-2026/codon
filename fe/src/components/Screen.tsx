import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

/** Tab screens: the tab bar already pads the bottom safe area, so only pad the top and sides. */
export const TAB_EDGES: Edge[] = ['top', 'left', 'right'];

export type ScreenProps = {
  children: React.ReactNode;
  /** Use the warm wellness background instead of the canvas (Support section). */
  wellness?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

/** Base container for every full screen: safe area + themed background. */
export function Screen({ children, wellness, edges, style }: ScreenProps) {
  const { color } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: color(wellness ? 'wellness/bg' : 'bg/canvas') }, style]}
    >
      {children}
    </SafeAreaView>
  );
}
