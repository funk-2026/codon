import * as tus from 'tus-js-client';
import { getPresignedUrl } from '@/src/api/uploads';

export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1024 ** 2))} MB`;

export type VideoUploadHandle = { abort: () => void };

/**
 * Uploads a video to the video host (resumable, in 5 MB chunks) and resolves with the key to save on the lesson.
 * `onProgress` only ever moves forward and stays below 100 until the host confirms.
 */
export async function uploadVideo(
  file: { uri: string; name: string; mimeType: string },
  opts: { onProgress: (pct: number, total: number) => void; onHandle: (h: VideoUploadHandle | null) => void },
): Promise<string> {
  const presign = await getPresignedUrl({ file_name: file.name, content_type: file.mimeType, purpose: 'video' });

  // Development stub when the video host is not configured.
  if (presign.tus_auth?.signature === 'stub') {
    opts.onProgress(100, 0);
    return presign.file_key;
  }
  if (!presign.tus_auth) throw new Error('Server did not provide TUS upload credentials');
  const auth = presign.tus_auth;

  const blob = await (await fetch(file.uri)).blob();
  let best = 0;
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: presign.upload_url,
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000],
      chunkSize: 5 * 1024 * 1024,
      headers: {
        AuthorizationSignature: auth.signature,
        AuthorizationExpire: String(auth.expires),
        LibraryId: String(auth.library_id),
        VideoId: auth.video_id,
      },
      metadata: { filetype: file.mimeType, title: file.name },
      onProgress: (sent, total) => {
        if (total <= 0) return;
        best = Math.max(best, Math.min(99, Math.floor((sent / total) * 100)));
        opts.onProgress(best, total);
      },
      onSuccess: () => {
        opts.onHandle(null);
        resolve();
      },
      onError: (err) => {
        opts.onHandle(null);
        reject(err);
      },
    });
    opts.onHandle({ abort: () => void upload.abort() });
    upload.start();
  });
  opts.onProgress(100, blob.size);
  return presign.file_key;
}
