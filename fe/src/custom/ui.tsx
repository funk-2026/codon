import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CaretDown, CaretRight, Check, Minus, Plus } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { SubjectNode } from '@/src/api/customTests';

export function Section({ title, hint, right, children, error }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode; error?: string | null }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm,
        borderWidth: error ? 1.5 : 0, borderColor: error ? color('semantic/danger') : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type['type/overline'], { color: color('text/tertiary') }]}>{title.toUpperCase()}</Text>
          {hint ? <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>{hint}</Text> : null}
        </View>
        {right}
      </View>
      {children}
      {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

export type ChipOption<T extends string> = { key: T; label: string; count?: number; disabled?: boolean; note?: string };

/** Multi- or single-select chips. `single` makes it a radio group. */
export function ChipGroup<T extends string>({
  options, selected, onToggle, single, disabled,
}: { options: ChipOption<T>[]; selected: T[]; onToggle: (k: T) => void; single?: boolean; disabled?: boolean }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }} accessibilityRole={single ? 'radiogroup' : undefined}>
      {options.map((o) => {
        const on = selected.includes(o.key);
        const off = disabled || o.disabled;
        return (
          <Pressable
            key={o.key}
            onPress={() => onToggle(o.key)}
            disabled={off}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={{ selected: on, checked: on, disabled: off }}
            accessibilityLabel={`${o.label}${o.count != null ? `, ${o.count} questions` : ''}${o.note ? `, ${o.note}` : ''}`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill,
              backgroundColor: on ? color('accent/tint') : color('bg/sunken'), borderWidth: 1.5,
              borderColor: on ? color('accent/default') : 'transparent', opacity: off ? 0.45 : 1,
            }}
          >
            {on ? <Check size={14} weight="bold" color={color('accent/default')} /> : null}
            <Text style={[type['type/body-m'], { color: on ? color('accent/default') : color('text/primary') }]}>{o.label}</Text>
            {o.count != null ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value, min, max, step = 1, onChange, unit, label, presets,
}: { value: number; min: number; max: number; step?: number; onChange: (n: number) => void; unit?: string; label: string; presets?: number[] }) {
  const { color, type, space, radius } = useTheme();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  const Btn = ({ icon, onPress, disabled, a11y }: { icon: React.ReactNode; onPress: () => void; disabled: boolean; a11y: string }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color('bg/sunken'), alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      {icon}
    </Pressable>
  );
  return (
    <View style={{ gap: space.sm }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: `${value}${unit ? ` ${unit}` : ''}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Btn icon={<Minus size={20} color={color('text/primary')} />} onPress={() => set(value - step)} disabled={value <= min} a11y={`Decrease ${label}`} />
        <View style={{ alignItems: 'center' }}>
          <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 32 }]}>{value}</Text>
          {unit ? <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{unit}</Text> : null}
        </View>
        <Btn icon={<Plus size={20} color={color('text/primary')} />} onPress={() => set(value + step)} disabled={value >= max} a11y={`Increase ${label}`} />
      </View>
      {presets && presets.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space.xs, justifyContent: 'center', flexWrap: 'wrap' }}>
          {presets.filter((p) => p >= min && p <= max).map((p) => (
            <Pressable
              key={p}
              onPress={() => set(p)}
              accessibilityRole="button"
              accessibilityLabel={`Set ${label} to ${p}`}
              style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: value === p ? color('accent/tint') : color('bg/sunken') }}
            >
              <Text style={[type['type/caption'], { color: value === p ? color('accent/default') : color('text/secondary') }]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string; disabled?: boolean }[]; value: T; onChange: (k: T) => void }) {
  const { color, type, radius } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            disabled={o.disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: o.disabled }}
            style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: on ? color('bg/surface') : 'transparent', opacity: o.disabled ? 0.4 : 1 }}
          >
            <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/secondary') }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type TreeProps = {
  subjects: SubjectNode[];
  selectedSubjects: string[];
  selectedChapters: string[];
  selectedTopics: string[];
  onSubject: (id: string) => void;
  onChapter: (id: string) => void;
  onTopic: (id: string) => void;
};

/** Subject → chapter → topic picker. Each node shows how many eligible questions it has; empty nodes are disabled. */
export function ScopeTree({ subjects, selectedSubjects, selectedChapters, selectedTopics, onSubject, onChapter, onTopic }: TreeProps) {
  const { color, type, space } = useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const Check_ = ({ on, partial }: { on: boolean; partial?: boolean }) => (
    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on || partial ? color('accent/default') : color('border/strong'), backgroundColor: on ? color('accent/default') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Check size={14} weight="bold" color={color('accent/on-accent')} /> : partial ? <View style={{ width: 10, height: 2, backgroundColor: color('accent/default') }} /> : null}
    </View>
  );

  if (subjects.length === 0) {
    return <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No subjects are available for this course yet.</Text>;
  }

  return (
    <View style={{ gap: 2 }}>
      {subjects.map((s) => {
        const sOn = selectedSubjects.includes(s.id);
        const childSel = s.chapters.some((c) => selectedChapters.includes(c.id) || c.topics.some((t) => selectedTopics.includes(t.id)));
        const isOpen = !!open[s.id];
        return (
          <View key={s.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
              <Pressable
                onPress={() => toggleOpen(s.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${s.name}`}
                style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                {isOpen ? <CaretDown size={16} color={color('text/secondary')} /> : <CaretRight size={16} color={color('text/secondary')} />}
              </Pressable>
              <Pressable
                onPress={() => onSubject(s.id)}
                disabled={s.available === 0}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sOn ? true : childSel ? 'mixed' : false, disabled: s.available === 0 }}
                accessibilityLabel={`${s.name}, ${s.available} questions`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: s.available === 0 ? 0.45 : 1 }}
              >
                <Check_ on={sOn} partial={!sOn && childSel} />
                <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{s.available}</Text>
              </Pressable>
            </View>
            {isOpen ? (
              <View style={{ marginLeft: 36 }}>
                {s.chapters.map((c) => {
                  const cOn = sOn || selectedChapters.includes(c.id);
                  const cChild = c.topics.some((t) => selectedTopics.includes(t.id));
                  const cOpen = !!open[c.id];
                  return (
                    <View key={c.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable
                          onPress={() => c.topics.length > 0 && toggleOpen(c.id)}
                          hitSlop={8}
                          disabled={c.topics.length === 0}
                          accessibilityRole="button"
                          accessibilityLabel={c.topics.length ? `${cOpen ? 'Collapse' : 'Expand'} ${c.name}` : undefined}
                          style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
                        >
                          {c.topics.length === 0 ? null : cOpen ? <CaretDown size={14} color={color('text/secondary')} /> : <CaretRight size={14} color={color('text/secondary')} />}
                        </Pressable>
                        <Pressable
                          onPress={() => !sOn && onChapter(c.id)}
                          disabled={sOn || c.available === 0}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: cOn ? true : cChild ? 'mixed' : false, disabled: sOn || c.available === 0 }}
                          accessibilityLabel={`${c.name}, ${c.available} questions${sOn ? ', included with subject' : ''}`}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: c.available === 0 ? 0.45 : 1 }}
                        >
                          <Check_ on={cOn} partial={!cOn && cChild} />
                          <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{c.name}</Text>
                          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{c.available}</Text>
                        </Pressable>
                      </View>
                      {cOpen ? (
                        <View style={{ marginLeft: 32 }}>
                          {c.topics.map((t) => {
                            const tOn = cOn || selectedTopics.includes(t.id);
                            return (
                              <Pressable
                                key={t.id}
                                onPress={() => !cOn && onTopic(t.id)}
                                disabled={cOn || t.available === 0}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: tOn, disabled: cOn || t.available === 0 }}
                                accessibilityLabel={`${t.name}, ${t.available} questions`}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: t.available === 0 ? 0.45 : 1 }}
                              >
                                <Check_ on={tOn} />
                                <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{t.name}</Text>
                                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{t.available}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
