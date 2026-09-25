/**
 * Pure decisions about an image before upload (no native modules, unit-tested):
 * do we need to shrink it, to what size, and how to explain a server refusal.
 */
export type MediaLimits = { max_bytes: number; max_dimension: number; allowed_mimes: string[] };

export type ImageInfo = { width: number; height: number; bytes: number; mime: string };

export type ProcessPlan =
  | { action: 'reject'; code: 'unsupported_type'; message: string }
  | { action: 'keep' }
  | { action: 'resize'; width?: number; height?: number; compress: number; format: 'jpeg' | 'png' | 'webp' };

/** Long edge we shrink to when a photo is over the byte limit but within the dimension cap. */
const FALLBACK_LONG_EDGE = 1800;

export function planImage(info: ImageInfo, lim: MediaLimits): ProcessPlan {
  const mime = normalizeMime(info.mime);
  // iPhone photos are HEIC by default: convert to JPEG on the device instead of bouncing the teacher.
  if ((mime === 'image/heic' || mime === 'image/heif') && lim.allowed_mimes.includes('image/jpeg')) {
    const long = Math.max(info.width, info.height);
    const target = Math.min(long, lim.max_dimension, FALLBACK_LONG_EDGE * 2);
    const scale = target / long;
    return {
      action: 'resize',
      width: info.width >= info.height ? Math.round(info.width * scale) : undefined,
      height: info.height > info.width ? Math.round(info.height * scale) : undefined,
      compress: 0.9,
      format: 'jpeg',
    };
  }
  if (!lim.allowed_mimes.includes(mime)) {
    return { action: 'reject', code: 'unsupported_type', message: `This file type isn’t supported. Use ${lim.allowed_mimes.map(prettyMime).join(', ')}.` };
  }
  const long = Math.max(info.width, info.height);
  const tooBig = info.bytes > lim.max_bytes;
  const tooWide = long > lim.max_dimension;
  if (!tooBig && !tooWide) return { action: 'keep' };

  const target = tooWide ? lim.max_dimension : Math.min(long, FALLBACK_LONG_EDGE);
  const scale = target / long;
  // Diagrams (PNG) stay PNG unless size is the only problem; photos go to JPEG.
  const format = mime === 'image/png' && !tooBig ? 'png' : mime === 'image/webp' ? 'webp' : 'jpeg';
  return {
    action: 'resize',
    width: info.width >= info.height ? Math.round(info.width * scale) : undefined,
    height: info.height > info.width ? Math.round(info.height * scale) : undefined,
    compress: tooBig ? 0.8 : 0.92,
    format,
  };
}

export function normalizeMime(m: string): string {
  const x = m.toLowerCase();
  return x === 'image/jpg' ? 'image/jpeg' : x;
}

const prettyMime = (m: string) => m.replace('image/', '').toUpperCase();

/** Guess a MIME type from a file name/URI when the picker doesn't provide one. */
export function mimeFromName(name: string): string {
  const ext = name.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'application/octet-stream';
}

export type UploadFailure = { code: string; message: string; retryable: boolean };

/** Turns a backend/network failure into words a teacher can act on. */
export function explainUploadFailure(code: string | undefined, status?: number): UploadFailure {
  switch (code) {
    case 'too_large':
      return { code, retryable: false, message: 'That image is too large. Try a smaller or lower-resolution copy.' };
    case 'too_large_dimensions':
      return { code, retryable: false, message: 'That image’s dimensions are too large. Try a smaller copy.' };
    case 'unsupported_type':
      return { code, retryable: false, message: 'That file isn’t a supported image (JPEG, PNG or WebP).' };
    case 'corrupt_image':
      return { code, retryable: false, message: 'We couldn’t read that image — it may be damaged. Try another.' };
    case 'purpose_forbidden':
      return { code, retryable: false, message: 'Your account can’t upload this kind of image.' };
    case 'quota_exceeded':
      return { code, retryable: false, message: 'You’ve reached your upload limit. Delete unused images in your media library.' };
    case 'storage_unavailable':
      return { code, retryable: true, message: 'Image storage is unavailable right now. Try again shortly.' };
  }
  if (status === 429) return { code: 'rate_limited', retryable: true, message: 'You’re uploading too quickly. Wait a moment and try again.' };
  return { code: code ?? 'network', retryable: true, message: 'Upload failed. Check your connection and try again.' };
}
