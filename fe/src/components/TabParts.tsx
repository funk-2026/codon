import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CaretRight, ChartLineUp, MagnifyingGlass } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';

/**
 * The building blocks the MCQs and Video tabs (and their subject screens) share, so the two read as one product:
 * a shortcut card, a progress link, a search bar, a subject card with progress, a progress strip and filter pills.
 */

/** A shortcut to something related (Bookmarks, Downloaded videos). Full width, icon, title, one line of help. */
export function ShortcutCard({ icon, title, caption, onPress }: { icon: ReactNode; title: string; caption: string; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      style={({ pressed }) => [{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[type['type/h3'], { color: color('text/primary') }]}>{title}</Text>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{caption}</Text>
      </View>
      <CaretRight size={18} color={color('text/tertiary')} />
    </Pressable>
  );
}

/** The blue "my progress" card that opens this area's graph. */
export function ProgressLink({ title, onPress }: { title: string; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('accent/tint'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 })}
    >
      <ChartLineUp size={24} color={color('accent/default')} weight="duotone" />
      <Text style={[type['type/h3'], { color: color('accent/default'), flex: 1 }]}>{title}</Text>
      <CaretRight size={18} color={color('accent/default')} />
    </Pressable>
  );
}

/** A tappable search bar that opens a search. */
export function SearchBar({ placeholder, onPress }: { placeholder: string; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color('border/subtle'), backgroundColor: color('bg/surface'), paddingHorizontal: space.sm }}
    >
      <MagnifyingGlass size={18} color={color('text/tertiary')} />
      <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>{placeholder}</Text>
    </Pressable>
  );
}

export const SUBJECT_SKELETON_HEIGHT = 88;

/** A subject: icon, name, a progress bar and "done / total". `progress` is left off while it is unknown. */
export function SubjectCard({ icon, name, progress, onPress, label }: { icon: ReactNode; name: string; progress?: { done: number; total: number; unit: string }; onPress: () => void; label: string }) {
  const { color, type, space, radius } = useTheme();
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {icon}
        <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{name}</Text>
        <CaretRight size={18} color={color('text/tertiary')} />
      </View>
      {progress ? (
        <>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
            <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: color('semantic/success') }} />
          </View>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{progress.done} / {progress.total} {progress.unit}</Text>
        </>
      ) : null}
    </Pressable>
  );
}

/** Under a subject's header: "6 / 20 modules completed" with its bar. */
export function ProgressStrip({ line, fraction }: { line: string; fraction: number }) {
  const { color, type, space } = useTheme();
  return (
    <View style={{ paddingHorizontal: space.md, marginTop: space.xs, gap: 6 }}>
      <Text style={[type['type/body-m-medium'], { color: color('semantic/success') }]}>{line}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
        <View style={{ width: `${Math.round(fraction * 100)}%`, height: 6, borderRadius: 3, backgroundColor: color('semantic/success') }} />
      </View>
    </View>
  );
}

/**
 * The row of filter pills: under a subject's header, the views of the Tests tab, the Brain Hack categories.
 * `wrap` lets them flow onto a second line (so none hides off the edge); `inset` adds the screen's side padding
 * (leave it off when the parent already pads); `marginTop` sets the gap above.
 */
export function FilterPills<K extends string>({ options, value, onChange, wrap = false, inset = true, marginTop }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; wrap?: boolean; inset?: boolean; marginTop?: number }) {
  const { color, type, space, radius } = useTheme();
  const top = marginTop ?? space.sm;
  const pills = options.map((f) => {
    const on = f.key === value;
    return (
      <Pressable
        key={f.key}
        onPress={() => onChange(f.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}
      >
        <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{f.label}</Text>
      </Pressable>
    );
  });
  const pad = inset ? space.md : 0;
  if (wrap) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: top, paddingHorizontal: pad }}>{pills}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: top }} contentContainerStyle={{ paddingHorizontal: pad, gap: space.xs }}>
      {pills}
    </ScrollView>
  );
}
