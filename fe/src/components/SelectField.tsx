import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CaretDown, Check } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { BottomSheet } from './BottomSheet';
import { InputField } from './InputField';

export type SelectOption = { value: string; label: string; hint?: string };

/**
 * Labelled dropdown that opens a searchable bottom sheet. `allowClear` adds a
 * "None" row. Disabled fields explain why via `disabledHint`.
 */
export function SelectField({
  label, value, options, onChange, placeholder = 'Select…', allowClear, disabled, disabledHint, error, searchable,
}: {
  label: string; value?: string; options: SelectOption[]; onChange: (v: string | undefined) => void; placeholder?: string;
  allowClear?: boolean; disabled?: boolean; disabledHint?: string; error?: string | null; searchable?: boolean;
}) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => (q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options), [options, q]);

  return (
    <View style={{ gap: 4 }}>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{label}</Text>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not set'}`}
        accessibilityState={{ disabled: !!disabled }}
        style={{
          minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? color('semantic/danger') : color('border/subtle'),
          backgroundColor: color('bg/surface'), paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={[type['type/body-m'], { flex: 1, color: current ? color('text/primary') : color('text/tertiary') }]} numberOfLines={1}>
          {current?.label ?? (disabled && disabledHint ? disabledHint : placeholder)}
        </Text>
        <CaretDown size={16} color={color('text/secondary')} />
      </Pressable>
      {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}

      <BottomSheet visible={open} onClose={() => { setOpen(false); setQ(''); }} title={label}>
        <View style={{ gap: space.xs }}>
          {searchable || options.length > 8 ? <InputField label="Search" value={q} onChangeText={setQ} autoCorrect={false} /> : null}
          {allowClear ? (
            <Row label="None" selected={value == null} onPress={() => { onChange(undefined); setOpen(false); setQ(''); }} />
          ) : null}
          {shown.map((o) => (
            <Row key={o.value} label={o.label} hint={o.hint} selected={o.value === value} onPress={() => { onChange(o.value); setOpen(false); setQ(''); }} />
          ))}
          {shown.length === 0 ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No matches.</Text> : null}
        </View>
      </BottomSheet>
    </View>
  );
}

function Row({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: selected ? color('accent/tint') : 'transparent' }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{label}</Text>
        {hint ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{hint}</Text> : null}
      </View>
      {selected ? <Check size={18} weight="bold" color={color('accent/default')} /> : null}
    </Pressable>
  );
}
