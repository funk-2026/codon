import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { ApiError } from '@/src/api/client';
import { completeMedia, presignMedia, type MediaPurpose } from '@/src/api/media';
import type { MediaView } from '@/src/rich/ast';
import { track } from '@/src/analytics/track';
import { explainUploadFailure, mimeFromName, planImage, type MediaLimits, type UploadFailure } from './plan';

export type PickedImage = { uri: string; width: number; height: number; mimeType?: string; fileName?: string; fileSize?: number };

export type UploadResult = { mediaId: string; view: MediaView };

export class UploadError extends Error {
  failure: UploadFailure;
  constructor(failure: UploadFailure) {
    super(failure.message);
    this.failure = failure;
  }
}

export type UploadHandle = { promise: Promise<UploadResult>; cancel: () => void };

/**
 * Full client-side upload of one image:
 *   1. shrink/convert on device if needed (HEIC → JPEG, oversize → fits limits)
 *   2. presign (server checks role, quota, size, type)
 *   3. PUT the exact bytes straight to storage, reporting progress
 *   4. complete (server verifies, strips EXIF, builds display + thumb)
 * Cancellable at any point; failures are mapped to teacher-readable messages.
 */
export function uploadImage(
  img: PickedImage,
  purpose: MediaPurpose,
  limits: MediaLimits,
  onProgress: (stage: 'preparing' | 'uploading' | 'processing', pct: number) => void,
): UploadHandle {
  let cancelled = false;
  let task: FileSystem.UploadTask | null = null;

  const run = async (): Promise<UploadResult> => {
    const started = Date.now();
    try {
      onProgress('preparing', 0);
      let uri = img.uri;
      let mime = img.mimeType ?? mimeFromName(img.fileName ?? img.uri);
      let width = img.width;
      let height = img.height;
      let bytes = img.fileSize ?? ((await FileSystem.getInfoAsync(uri)) as { size?: number }).size ?? 0;

      const plan = planImage({ width, height, bytes, mime }, limits);
      if (plan.action === 'reject') throw new UploadError({ code: plan.code, message: plan.message, retryable: false });
      if (plan.action === 'resize') {
        const fmt = plan.format === 'png' ? ImageManipulator.SaveFormat.PNG : plan.format === 'webp' ? ImageManipulator.SaveFormat.WEBP : ImageManipulator.SaveFormat.JPEG;
        const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: plan.width, height: plan.height } }], { compress: plan.compress, format: fmt });
        uri = out.uri;
        width = out.width;
        height = out.height;
        mime = plan.format === 'png' ? 'image/png' : plan.format === 'webp' ? 'image/webp' : 'image/jpeg';
        bytes = ((await FileSystem.getInfoAsync(uri)) as { size?: number }).size ?? bytes;
        if (bytes > limits.max_bytes) throw new UploadError(explainUploadFailure('too_large'));
      }
      if (cancelled) throw new UploadError({ code: 'cancelled', message: 'Cancelled', retryable: true });

      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const ps = await presignMedia({ purpose, file_name: img.fileName ?? `image.${ext}`, content_type: mime, bytes });
      if (!ps.media_id) throw new UploadError(explainUploadFailure('bad_response'));

      onProgress('uploading', 0);
      task = FileSystem.createUploadTask(
        ps.upload_url,
        uri,
        { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: ps.headers },
        (p) => onProgress('uploading', p.totalBytesExpectedToSend > 0 ? p.totalBytesSent / p.totalBytesExpectedToSend : 0),
      );
      const res = await task.uploadAsync();
      if (cancelled) throw new UploadError({ code: 'cancelled', message: 'Cancelled', retryable: true });
      if (!res || res.status < 200 || res.status >= 300) throw new UploadError(explainUploadFailure(undefined, res?.status));

      onProgress('processing', 1);
      const done = await completeMedia(ps.media_id);
      track('media.upload_succeeded', { purpose, ms: Date.now() - started, bytes });
      return { mediaId: done.media.id, view: done.view };
    } catch (e) {
      const failure =
        e instanceof UploadError ? e.failure
        : e instanceof ApiError ? explainUploadFailure(e.code, e.status)
        : explainUploadFailure(undefined);
      if (failure.code !== 'cancelled') track('media.upload_failed', { purpose, code: failure.code });
      throw e instanceof UploadError ? e : new UploadError(failure);
    }
  };

  return {
    promise: run(),
    cancel: () => {
      cancelled = true;
      void task?.cancelAsync().catch(() => {});
    },
  };
}

/**
 * PUT a local file straight to a presigned URL with progress + cancel. Shared by
 * image uploads and the CSV/ZIP import bundle.
 */
export function putFile(
  url: string,
  uri: string,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
): { promise: Promise<void>; cancel: () => void } {
  const task = FileSystem.createUploadTask(
    url,
    uri,
    { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers },
    (p) => onProgress?.(p.totalBytesExpectedToSend > 0 ? p.totalBytesSent / p.totalBytesExpectedToSend : 0),
  );
  return {
    promise: task.uploadAsync().then((res) => {
      if (!res || res.status < 200 || res.status >= 300) throw new UploadError(explainUploadFailure(undefined, res?.status));
    }),
    cancel: () => void task.cancelAsync().catch(() => {}),
  };
}
