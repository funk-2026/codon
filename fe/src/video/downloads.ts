import * as FileSystem from 'expo-file-system/legacy';
import { kvGet, kvSet } from '@/src/storage/kv';

const KEY = 'video-downloads';
const DIR = `${FileSystem.documentDirectory ?? ''}videos/`;

export type DownloadedVideo = { id: string; title: string; subject?: string; chapter?: string; file: string; bytes: number; at: string };

/**
 * The lecture file for download. The player streams HLS, which is many small pieces, so a download uses the lecture's MP4
 * rendition from the same video host. It exists only when the host has MP4 renditions switched on for the library.
 */
export const mp4Url = (hlsUrl: string): string | null => (/\/playlist\.m3u8(\?.*)?$/.test(hlsUrl) ? hlsUrl.replace(/\/playlist\.m3u8(\?.*)?$/, '/play_720p.mp4') : null);

export const listDownloads = () => kvGet<DownloadedVideo[]>(KEY, []);

export async function downloadVideo(
  v: { id: string; title: string; subject?: string; chapter?: string; hlsUrl: string },
  onProgress?: (fraction: number) => void,
): Promise<DownloadedVideo> {
  const src = mp4Url(v.hlsUrl);
  if (!src) throw new Error('not_downloadable');
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const file = `${DIR}${v.id}.mp4`;
  const task = FileSystem.createDownloadResumable(src, file, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const res = await task.downloadAsync();
  if (!res || res.status !== 200) {
    await FileSystem.deleteAsync(file, { idempotent: true }).catch(() => {});
    throw new Error('download_failed');
  }
  const info = await FileSystem.getInfoAsync(file);
  const entry: DownloadedVideo = { id: v.id, title: v.title, subject: v.subject, chapter: v.chapter, file, bytes: info.exists && 'size' in info ? info.size : 0, at: new Date().toISOString() };
  const all = (await listDownloads()).filter((d) => d.id !== v.id);
  await kvSet(KEY, [entry, ...all]);
  return entry;
}

export async function removeDownload(id: string): Promise<void> {
  const all = await listDownloads();
  const hit = all.find((d) => d.id === id);
  if (hit) await FileSystem.deleteAsync(hit.file, { idempotent: true }).catch(() => {});
  await kvSet(KEY, all.filter((d) => d.id !== id));
}

export const sizeText = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(0)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
