import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, description, icon, action, style }: EmptyStateProps) {
  const { color, type, space } = useTheme();

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: space['2xl'],
          paddingHorizontal: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {icon ? <View style={{ marginBottom: space.xs }}>{icon}</View> : null}
      <Text
        style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}
      >
        {title}
      </Text>
      <Text
        style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}
      >
        {description}
      </Text>
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}
