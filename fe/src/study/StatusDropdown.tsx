import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CaretDown, CheckCircle } from 'phosphor-react-native';
import { BottomSheet } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { SchemaStatus } from '@/src/api/study';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './logic';

/** The three-state status control that sits before a topic name: red Yet to read, amber Yet to revise, green Confident. */
export function StatusDropdown({ status, onChange }: { status: SchemaStatus; onChange: (s: SchemaStatus) => void }) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const tone = color(STATUS_TONE[status]);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Status: ${STATUS_LABEL[status]}. Change`}
        hitSlop={6}
        style={{ minHeight: 36, minWidth: 36, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, borderRadius: radius.pill, borderWidth: 1.5, borderColor: tone }}
      >
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: tone }} />
        <CaretDown size={12} color={tone} weight="bold" />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Status">
        <View style={{ gap: 2, paddingBottom: space.lg }}>
          {STATUS_ORDER.map((s) => (
            <Pressable key={s} onPress={() => { setOpen(false); if (s !== status) onChange(s); }} accessibilityRole="button" accessibilityState={{ selected: s === status }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color(STATUS_TONE[s]) }} />
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{STATUS_LABEL[s]}</Text>
              {s === status ? <CheckCircle size={20} color={color('accent/default')} weight="fill" /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}
