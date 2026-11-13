import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type SegmentedControlProps<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  /** Colour of the selected label; the wellness area uses its own accent. */
  accent?: 'accent/default' | 'wellness/accent';
};

/** Equal-width switcher for sibling views of one screen (Q Bank | Test Series | …). */
export function SegmentedControl<T extends string>({ options, value, onChange, accent = 'accent/default' }: SegmentedControlProps<T>) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3 }}
    >
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.xs,
              borderRadius: radius.pill,
              backgroundColor: selected ? color('bg/surface') : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={[type['type/body-m-medium'], { color: selected ? color(accent) : color('text/secondary') }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
