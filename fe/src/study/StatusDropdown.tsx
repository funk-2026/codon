import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CheckCircle, CircleDashed, CircleHalf } from 'phosphor-react-native';
import { BottomSheet } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { SchemaStatus } from '@/src/api/study';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './logic';

/** The three-state status control that sits before a topic name: an empty circle (red) for Yet to read, a half circle (amber) for Yet to revise, a tick (green) for Confident. */
export function StatusDropdown({ status, onChange }: { status: SchemaStatus; onChange: (s: SchemaStatus) => void }) {
  const { color, type, space } = useTheme();
  const [open, setOpen] = useState(false);
  const tone = color(STATUS_TONE[status]);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Status: ${STATUS_LABEL[status]}. Change`}
        hitSlop={8}
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        {status === 'confident' ? <CheckCircle size={28} color={tone} weight="fill" /> : status === 'yet_to_revise' ? <CircleHalf size={28} color={tone} weight="fill" /> : <CircleDashed size={28} color={tone} weight="bold" />}
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Status">
        <View style={{ gap: 2, paddingBottom: space.lg }}>
          {STATUS_ORDER.map((s) => (
            <Pressable key={s} onPress={() => { setOpen(false); if (s !== status) onChange(s); }} accessibilityRole="button" accessibilityState={{ selected: s === status }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {s === 'confident' ? <CheckCircle size={22} color={color(STATUS_TONE[s])} weight="fill" /> : s === 'yet_to_revise' ? <CircleHalf size={22} color={color(STATUS_TONE[s])} weight="fill" /> : <CircleDashed size={22} color={color(STATUS_TONE[s])} weight="bold" />}
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{STATUS_LABEL[s]}</Text>
              {s === status ? <CheckCircle size={20} color={color('accent/default')} weight="fill" /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}
