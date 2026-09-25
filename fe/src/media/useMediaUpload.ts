import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import { useAppConfig } from '@/src/config/AppConfigContext';
import type { MediaPurpose } from '@/src/api/media';
import type { MediaView } from '@/src/rich/ast';
import { uploadImage, UploadError, type PickedImage, type UploadHandle } from './upload';
import type { MediaLimits, UploadFailure } from './plan';

export type UploadItem = {
  key: string;
  localUri: string;
  stage: 'preparing' | 'uploading' | 'processing' | 'ready' | 'failed';
  progress: number;
  mediaId?: string;
  view?: MediaView;
  error?: UploadFailure;
  source: PickedImage;
};

const FALLBACK_LIMITS: MediaLimits = { max_bytes: 5_000_000, max_dimension: 4000, allowed_mimes: ['image/jpeg', 'image/png', 'image/webp'] };

/**
 * Pick → upload → track several images (FE-1.9). Each upload has its own
 * progress, can be retried or cancelled, and failures never lose the others.
 */
export function useMediaUpload(purpose: MediaPurpose, opts: { onReady?: (item: UploadItem) => void } = {}) {
  const { config } = useAppConfig();
  const limits: MediaLimits = config?.limits.media ?? FALLBACK_LIMITS;
  const [items, setItems] = useState<UploadItem[]>([]);
  const [permissionDenied, setPermissionDenied] = useState<'camera' | 'library' | null>(null);
  const handles = useRef(new Map<string, UploadHandle>());
  const onReady = useRef(opts.onReady);
  onReady.current = opts.onReady;
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
    handles.current.forEach((h) => h.cancel());
  }, []);

  const patch = useCallback((key: string, p: Partial<UploadItem>) => {
    if (alive.current) setItems((all) => all.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  const start = useCallback(
    (item: UploadItem) => {
      const h = uploadImage(item.source, purpose, limits, (stage, progress) => patch(item.key, { stage, progress, error: undefined }));
      handles.current.set(item.key, h);
      h.promise
        .then((r) => {
          const done: UploadItem = { ...item, stage: 'ready', progress: 1, mediaId: r.mediaId, view: r.view, error: undefined };
          patch(item.key, done);
          onReady.current?.(done);
        })
        .catch((e) => {
          if (e instanceof UploadError && e.failure.code === 'cancelled') return;
          patch(item.key, { stage: 'failed', error: e instanceof UploadError ? e.failure : { code: 'unknown', message: 'Upload failed.', retryable: true } });
        })
        .finally(() => handles.current.delete(item.key));
    },
    [limits, patch, purpose],
  );

  const enqueue = useCallback(
    (assets: PickedImage[]) => {
      const fresh: UploadItem[] = assets.map((a, i) => ({
        key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        localUri: a.uri, stage: 'preparing', progress: 0, source: a,
      }));
      setItems((all) => [...all, ...fresh]);
      fresh.forEach(start);
    },
    [start],
  );

  const toPicked = (a: ImagePicker.ImagePickerAsset): PickedImage => ({
    uri: a.uri, width: a.width, height: a.height, mimeType: a.mimeType ?? undefined, fileName: a.fileName ?? undefined, fileSize: a.fileSize ?? undefined,
  });

  const pickFromLibrary = useCallback(
    async (multiple = false) => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return setPermissionDenied('library');
      setPermissionDenied(null);
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, quality: 1 });
      if (!r.canceled) enqueue(r.assets.map(toPicked));
    },
    [enqueue],
  );

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setPermissionDenied('camera');
    setPermissionDenied(null);
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) enqueue(r.assets.map(toPicked));
  }, [enqueue]);

  const retry = useCallback(
    (key: string) => {
      const it = items.find((i) => i.key === key);
      if (!it) return;
      patch(key, { stage: 'preparing', progress: 0, error: undefined });
      start({ ...it, stage: 'preparing', progress: 0, error: undefined });
    },
    [items, patch, start],
  );

  const cancel = useCallback((key: string) => {
    handles.current.get(key)?.cancel();
    setItems((all) => all.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openSettings = useCallback(() => void Linking.openSettings(), []);
  const busy = items.some((i) => i.stage === 'preparing' || i.stage === 'uploading' || i.stage === 'processing');

  return { items, busy, pickFromLibrary, takePhoto, retry, cancel, clear, permissionDenied, openSettings, limits };
}
