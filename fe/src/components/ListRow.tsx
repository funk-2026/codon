import { Pressable, Text, View } from 'react-native';
import { CaretRight, type Icon } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type ListRowProps = {
  label: string;
  onPress?: () => void;
  Icon?: Icon;
  /** Muted text on the right (a count, a value). */
  value?: string;
  /** Replaces the chevron (e.g. a Switch). */
  trailing?: React.ReactNode;
  tone?: 'default' | 'danger';
};

/** A tappable settings/list row: icon, label, optional value, chevron. */
export function ListRow({ label, onPress, Icon, value, trailing, tone = 'default' }: ListRowProps) {
  const { color, type, space, radius } = useTheme();
  const content = (
    <>
      {Icon ? <Icon size={20} color={color('accent/default')} weight="duotone" /> : null}
      <Text
        style={[
          type['type/body-l'],
          { color: color(tone === 'danger' ? 'semantic/danger' : 'text/primary'), flex: 1, marginLeft: Icon ? space.sm : 0 },
        ]}
      >
        {label}
      </Text>
      {value ? <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginRight: space.xs }]}>{value}</Text> : null}
      {trailing ?? (onPress ? <CaretRight size={18} color={color('text/tertiary')} /> : null)}
    </>
  );
  const base = { flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md } as const;
  if (!onPress) return <View style={base}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.94 : 1 }]}>
      {content}
    </Pressable>
  );
}

/** Small uppercase label above a group of rows. */
export function SectionLabel({ children }: { children: string }) {
  const { color, type, space } = useTheme();
  return (
    <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{children}</Text>
  );
}
