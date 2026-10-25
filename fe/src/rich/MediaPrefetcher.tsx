import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import type { MediaMap } from './ast';

const CONCURRENCY = 4;

/**
 * Warms the image cache for an attempt (FE-1.10): loads display variants of
 * `ids` in order, 4 at a time, through the SAME source/cacheKey MediaImage
 * uses (expo-image's `prefetch()` keys by URL, which changes when signed URLs
 * refresh — it would miss). Renders nothing visible; unmounting cancels.
 * Never blocks a question: failures are skipped.
 */
export function MediaPrefetcher({ ids, media, onProgress }: { ids: string[]; media: MediaMap; onProgress?: (done: number, total: number) => void }) {
  const queue = useMemo(() => ids.filter((id) => media[id]?.url), [ids, media]);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    onProgress?.(done.size, queue.length);
  }, [done, queue.length, onProgress]);

  const active = queue.filter((id) => !done.has(id)).slice(0, CONCURRENCY);
  if (active.length === 0) return null;
  const finish = (id: string) => setDone((s) => new Set(s).add(id));

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
      {active.map((id) => (
        <Image
          key={id}
          source={{ uri: media[id]!.url, cacheKey: `media:${id}:display` }}
          cachePolicy="disk"
          style={{ width: 1, height: 1 }}
          onLoad={() => finish(id)}
          onError={() => finish(id)}
        />
      ))}
    </View>
  );
}
