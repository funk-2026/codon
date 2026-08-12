import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { CheckCircle, Clock, XCircle, type IconProps } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { ColorToken } from '@/src/theme/tokens';

export type BadgeStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

type IconComponent = React.ComponentType<IconProps>;

type StatusConfig = {
  colorToken: ColorToken;
  fill: boolean;
  icon: IconComponent | null;
  iconWeight: 'regular' | 'fill';
  label: string;
};

const CONFIG: Record<BadgeStatus, StatusConfig> = {
  draft: { colorToken: 'text/tertiary', fill: false, icon: null, iconWeight: 'regular', label: 'Draft' },
  pending: { colorToken: 'semantic/warning', fill: false, icon: Clock, iconWeight: 'regular', label: 'Pending' },
  approved: { colorToken: 'semantic/success', fill: false, icon: CheckCircle, iconWeight: 'regular', label: 'Approved' },
  rejected: { colorToken: 'semantic/danger', fill: false, icon: XCircle, iconWeight: 'regular', label: 'Changes Needed' },
  published: { colorToken: 'semantic/success', fill: true, icon: CheckCircle, iconWeight: 'fill', label: 'Published' },
  success: { colorToken: 'semantic/success', fill: false, icon: null, iconWeight: 'regular', label: 'Success' },
  warning: { colorToken: 'semantic/warning', fill: false, icon: null, iconWeight: 'regular', label: 'Warning' },
  danger: { colorToken: 'semantic/danger', fill: false, icon: null, iconWeight: 'regular', label: 'Error' },
  neutral: { colorToken: 'text/secondary', fill: false, icon: null, iconWeight: 'regular', label: 'Neutral' },
};

export type StatusBadgeProps = {
  status: BadgeStatus;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatusBadge({ status, label, style }: StatusBadgeProps) {
  const { color, type, radius, space } = useTheme();
  const config = CONFIG[status];
  const tint = color(config.colorToken);
  const Icon = config.icon;
  const text = label ?? config.label;

  const contentColor = config.fill ? color('text/inverse') : tint;
  const borderColor = status === 'draft' ? color('border/subtle') : tint;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: space['2xs'],
          borderRadius: radius.pill,
          paddingVertical: space['2xs'],
          paddingHorizontal: space.sm,
          backgroundColor: config.fill ? tint : 'transparent',
          borderWidth: config.fill ? 0 : 1,
          borderColor,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={14} color={contentColor} weight={config.iconWeight} /> : null}
      <Text style={[type['type/caption'], { color: contentColor }]}>{text}</Text>
    </View>
  );
}
