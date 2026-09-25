import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Sheet grows with content up to this fraction of the screen, then scrolls. */
  maxHeightPct?: number;
  /** Disable backdrop-tap / back-button dismissal (e.g. while submitting). */
  dismissable?: boolean;
  testID?: string;
};

/**
 * Standard bottom sheet: dimmed backdrop, handle, optional title, scrollable
 * body, keyboard-aware, hardware-back dismisses. One implementation for every
 * sheet in the app (palette, submit, report, filters, pickers).
 */
export function BottomSheet({ visible, onClose, title, children, maxHeightPct = 0.85, dismissable = true, testID }: BottomSheetProps) {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissable ? onClose : undefined} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={dismissable ? onClose : undefined}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View
          testID={testID}
          style={{
            backgroundColor: color('bg/surface'),
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingTop: space.sm,
            paddingBottom: space.lg + insets.bottom,
            maxHeight: `${Math.round(maxHeightPct * 100)}%`,
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: color('border/strong'), alignSelf: 'center' }} />
          {title ? (
            <Text accessibilityRole="header" style={[type['type/h3'], { color: color('text/primary'), marginTop: space.md, paddingHorizontal: space.lg }]}>
              {title}
            </Text>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
