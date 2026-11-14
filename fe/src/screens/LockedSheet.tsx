import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/ThemeProvider';

export function LockedSheet({ onClose, onViewPlans }: { onClose: () => void; onViewPlans: () => void }) {
  const { color, type, space, radius } = useTheme();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 240 });
  }, [rise]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.value) * 300 }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      <Animated.View
        style={[
          { backgroundColor: color('bg/surface'), borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.sm },
          style,
        ]}
      >
        <Text style={[type['type/h2'], { color: color('text/primary') }]}>This needs an active plan</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          A plan unlocks the full test series, the complete question bank and every video class for your course.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.pill,
              borderWidth: 1, borderColor: color('border/strong'), opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={onViewPlans}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.pill,
              backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'),
            })}
          >
            <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>View Plans</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
