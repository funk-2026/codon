import React, { useCallback, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { ImageBroken } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { SkeletonBlock } from '@/src/components/SkeletonBlock';
import type { MediaView } from './ast';

export type MediaImageProps = {
  /** Resolved media (from the response's `media` map). `undefined` = unknown id. */
  media?: MediaView;
  /** Fallback alt text when the media has none (e.g. from the markup). */
  alt?: string;
  variant?: 'display' | 'thumb';
  /** Max height cap; the box keeps the image's own aspect ratio otherwise. */
  maxHeight?: number;
  onPress?: (media: MediaView) => void;
  /** Called when a signed URL 403s/expires so the caller can refetch the payload. */
  onExpired?: () => void;
  /** Used in tiny fixed-size slots (chips): skip the max-height cap logic. */
  disableFallbackHeight?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * One image from the media pipeline (FE-1.4).
 *
 *  - The box is sized from the server-reported width/height, so nothing jumps
 *    when the bitmap arrives.
 *  - Cached by **media id + variant**, not URL: signed URLs change on every
 *    request, so URL-keyed caching would refetch every image on every payload.
 *  - Never a blank hole: skeleton while loading, a compact retry box on failure.
 *  - Transparent diagrams sit on a light "paper" so they stay legible in dark mode.
 */
export function MediaImage({ media, alt, variant = 'display', maxHeight, onPress, onExpired, disableFallbackHeight, style, testID }: MediaImageProps) {
  const { color, type, space, radius } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState('loading');
    setAttempt((n) => n + 1);
  }, []);

  if (!media || !(variant === 'thumb' ? media.thumb_url || media.url : media.url)) {
    return (
      <View
        testID={testID}
        style={[
          { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs },
          style,
        ]}
        accessibilityRole="image"
        accessibilityLabel={alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
      >
        <ImageBroken size={20} color={color('text/tertiary')} />
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Image unavailable</Text>
      </View>
    );
  }

  const uri = variant === 'thumb' ? media.thumb_url || media.url : media.url;
  const ratio = media.width > 0 && media.height > 0 ? media.width / media.height : 4 / 3;
  const label = media.alt || alt || '';
  const decorative = label === '';

  const box = (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={decorative ? undefined : label}
      importantForAccessibility={decorative ? 'no' : 'yes'}
      style={[
        {
          width: '100%',
          aspectRatio: ratio,
          maxHeight,
          backgroundColor: color('media/paper'),
          borderRadius: radius.sm,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: color('border/subtle'),
        },
        style,
      ]}
    >
      {state === 'error' ? (
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Couldn't load image. Tap to retry."
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space['2xs'], backgroundColor: color('bg/sunken') }}
        >
          <ImageBroken size={22} color={color('text/tertiary')} />
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Couldn't load image · Retry</Text>
        </Pressable>
      ) : (
        <>
          <Image
            key={attempt}
            source={{ uri, cacheKey: `media:${media.id}:${variant}` }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="disk"
            recyclingKey={media.id}
            transition={120}
            onLoad={() => setState('ready')}
            onError={() => {
              setState('error');
              onExpired?.();
            }}
          />
          {state === 'loading' ? (
            <View style={{ position: 'absolute', inset: 0 } as any} pointerEvents="none">
              <SkeletonBlock width="100%" height="100%" radius={radius.sm} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  if (!onPress || state === 'error') return box;
  return (
    <Pressable onPress={() => onPress(media)} accessibilityHint="Opens the image full screen">
      {box}
    </Pressable>
  );
}
