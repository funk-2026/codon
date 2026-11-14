import { useState } from 'react';
import { Text, View } from 'react-native';
import { BottomSheet, InputField, PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

/** One reason, then a confirm: used wherever an admin action must be explained (suspend, take down). */
export function ReasonSheet({ visible, title, description, confirmLabel, busy, onConfirm, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} dismissable={!busy}>
      <ReasonForm description={description} confirmLabel={confirmLabel} busy={busy} onConfirm={onConfirm} />
    </BottomSheet>
  );
}

// Lives inside the sheet, so the text starts empty each time the sheet opens.
function ReasonForm({ description, confirmLabel, busy, onConfirm }: Pick<Props, 'description' | 'confirmLabel' | 'busy' | 'onConfirm'>) {
  const { color, type, space } = useTheme();
  const [reason, setReason] = useState('');
  return (
    <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
      {description ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{description}</Text> : null}
      <InputField label="Reason (kept in the audit log)" value={reason} onChangeText={setReason} multiline maxLength={500} />
      <PrimaryButton label={confirmLabel} onPress={() => onConfirm(reason.trim())} loading={busy} disabled={reason.trim().length < 3} />
    </View>
  );
}
