import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useSafeBack } from '@/src/navigation/useSafeBack';

export type ScreenHeaderProps = {
  /** Omit for a back-only bar (reader screens). */
  title?: string;
  /** Small caption above the title (e.g. the course name). */
  eyebrow?: string;
  /** `small` for in-flow bars (study, review); `large` for page titles. */
  size?: 'large' | 'small';
  /** Overrides the default back behaviour (e.g. confirm before leaving a form). */
  onBack?: () => void;
  /** Hide the back arrow on screens that are a flow's end. */
  hideBack?: boolean;
  /** Actions on the right edge (buttons, icons). */
  right?: React.ReactNode;
  /** Muted line under the title. */
  subtitle?: string;
  wellness?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one header for every pushed screen: back arrow + title + optional right actions.
 * Back goes through `useSafeBack`, so a screen opened from a deep link never dead-ends.
 */
export function ScreenHeader({ title, eyebrow, size = 'large', onBack, hideBack, right, subtitle, wellness, style }: ScreenHeaderProps) {
  const { color, type, space } = useTheme();
  const safeBack = useSafeBack();
  const textColor = color(wellness ? 'wellness/text-primary' : 'text/primary');

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md, gap: space.xs },
        style,
      ]}
    >
      {hideBack ? null : (
        <Pressable
          onPress={onBack ?? safeBack}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ minWidth: 40, minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={textColor} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text numberOfLines={1} style={[type['type/caption'], { color: color('text/tertiary') }]}>
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text
            accessibilityRole="header"
            numberOfLines={size === 'small' ? 1 : 2}
            style={[size === 'small' ? type['type/body-m-medium'] : type['type/h1'], { color: textColor }]}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={1} style={[type['type/body-m'], { color: color('text/secondary') }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
