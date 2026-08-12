import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CheckCircle, XCircle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type ToastType = 'success' | 'error';

type ToastState = { message: string; type: ToastType } | null;

type ToastContextValue = { show: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TAB_BAR_OFFSET = 72;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { color, type, radius, space, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const show = useCallback(
    (message: string, toastType: ToastType = 'success') => {
      if (timeout.current) clearTimeout(timeout.current);
      setToast({ message, type: toastType });
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      timeout.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(16, { duration: 200 });
      }, 3000);
    },
    [opacity, translateY]
  );

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isError = toast?.type === 'error';
  const iconColor = isError ? color('semantic/danger') : color('semantic/success');

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrapper,
            { bottom: insets.bottom + TAB_BAR_OFFSET, paddingHorizontal: space.lg },
            animatedStyle,
          ]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: color('bg/surface-raised'),
                borderRadius: radius.md,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                gap: space.xs,
                borderWidth: mode === 'dark' ? 1 : 0,
                borderColor: color('border/subtle'),
                shadowColor: color('accent/default'),
                shadowOpacity: mode === 'light' ? 0.14 : 0,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              },
            ]}
          >
            {isError ? (
              <XCircle size={20} color={iconColor} weight="fill" />
            ) : (
              <CheckCircle size={20} color={iconColor} weight="fill" />
            )}
            <Text
              style={[type['type/body-m-medium'], { color: color('text/primary'), flexShrink: 1 }]}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', maxWidth: 480, width: '100%' },
});
