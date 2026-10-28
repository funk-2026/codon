import React, { useEffect } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { X } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { MediaView } from './ast';

/**
 * Full-screen image viewer (FE-1.5): pinch + double-tap zoom, pan while
 * zoomed, hardware-back / close button / swipe-down to dismiss. Deliberately no
 * share/save action — content protection (CM-RC11).
 */
export function ImageLightbox({ media, onClose }: { media: MediaView | null; onClose: () => void }) {
  const { color, type, space } = useTheme();
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = ty.value = savedTx.value = savedTy.value = 0;
    if (media) AccessibilityInfo.announceForAccessibility(media.alt ? `Image: ${media.alt}` : 'Image opened');
  }, [media, scale, savedScale, tx, ty, savedTx, savedTy]);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(5, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        ty.value = e.translationY; // swipe-down-to-dismiss feel
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      } else if (Math.abs(e.translationY) > 120) {
        runOnJS(onClose)();
      } else {
        ty.value = withSpring(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) reset();
      else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal visible={!!media} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
        {media ? (
          <>
            <GestureDetector gesture={composed}>
              <Animated.View style={[styles.center, animated]}>
                <Image
                  source={{ uri: media.url, cacheKey: `media:${media.id}:display` }}
                  style={{ width, height: height * 0.85 }}
                  contentFit="contain"
                  cachePolicy="disk"
                  accessibilityLabel={media.alt || 'Image'}
                />
              </Animated.View>
            </GestureDetector>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close image"
              hitSlop={space.sm}
              style={[styles.close, { top: space['2xl'], right: space.md }]}
            >
              <X size={26} color="#FFFFFF" weight="bold" />
            </Pressable>
            {media.alt ? (
              <View style={[styles.caption, { padding: space.md }]} pointerEvents="none">
                <Text style={[type['type/body-m'], { color: '#FFFFFF', textAlign: 'center' }]}>{media.alt}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 24 },
});
