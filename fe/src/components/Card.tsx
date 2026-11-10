import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type CardProps = {
  children: React.ReactNode;
  raised?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, raised, padding, style }: CardProps) {
  const { color, radius, space } = useTheme();

  const backgroundColor = raised ? color('bg/surface-raised') : color('bg/surface');

  const shadow: ViewStyle = {
    shadowColor: color('accent/default'),
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  };

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: radius.md,
          padding: padding ?? space.md,
        },
        shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}
