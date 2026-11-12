import { Modal, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { SecondaryButton } from './SecondaryButton';
import { PrimaryButton } from './PrimaryButton';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive actions (log out, delete). */
  tone?: 'default' | 'danger';
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Form fields or extra content shown between the message and the buttons. */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Centered confirmation modal. Replaces the hand-built Modal + scrim + card in each screen. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  loading,
  confirmDisabled,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { color, type, space, radius } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.lg,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: color('bg/surface'),
            borderRadius: radius.lg,
            padding: space.lg,
          }}
        >
          <Text accessibilityRole="header" style={[type['type/h3'], { color: color('text/primary') }]}>
            {title}
          </Text>
          {message ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>{message}</Text>
          ) : null}
          {children}
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {tone === 'danger' ? (
              <SecondaryButton label={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} disabled={confirmDisabled} />
            ) : (
              <PrimaryButton label={confirmLabel} onPress={onConfirm} loading={loading} disabled={confirmDisabled} />
            )}
            <SecondaryButton label={cancelLabel} onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
