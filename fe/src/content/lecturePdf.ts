import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { getPresignedUrl } from '@/src/api/uploads';

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type PickedPdf = { key: string; name: string };

/**
 * Teacher: pick a PDF and upload it (purpose `lecture_pdf`). Resolves the
 * stored key to attach to a lecture, null if the picker was cancelled.
 * Throws an Error with a readable message on failure.
 */
export async function pickAndUploadPdf(onProgress?: (pct: number) => void): Promise<PickedPdf | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  if (a.size && a.size > MAX_PDF_BYTES) throw new Error('That PDF is over 50 MB — compress it and try again.');
  const name = a.name?.toLowerCase().endsWith('.pdf') ? a.name : `${a.name ?? 'notes'}.pdf`;
  const presign = await getPresignedUrl({ file_name: name, content_type: 'application/pdf', purpose: 'lecture_pdf' });
  const task = FileSystem.createUploadTask(
    presign.upload_url,
    a.uri,
    { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: { 'Content-Type': 'application/pdf' } },
    (p) => onProgress?.(p.totalBytesExpectedToSend > 0 ? p.totalBytesSent / p.totalBytesExpectedToSend : 0),
  );
  const res = await task.uploadAsync();
  if (!res || res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res?.status ?? 'network'}). Try again.`);
  return { key: presign.file_key, name };
}

/**
 * Student: download a lecture PDF and hand it to the share sheet (Save to Files,
 * open in a PDF app, etc.). Falls back to opening it in the in-app browser.
 */
export async function downloadPdf(url: string, fileName: string): Promise<void> {
  const safe = fileName.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_');
  const target = `${FileSystem.cacheDirectory}${safe.endsWith('.pdf') ? safe : `${safe}.pdf`}`;
  try {
    const { uri, status } = await FileSystem.downloadAsync(url, target);
    if (status < 200 || status >= 300) throw new Error(String(status));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
      return;
    }
  } catch {
    /* fall through to the browser */
  }
  await WebBrowser.openBrowserAsync(url);
}
