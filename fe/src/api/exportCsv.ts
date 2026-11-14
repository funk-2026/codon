import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE, ApiError } from './client';
import { getAccessToken } from '../auth/tokenStore';

/**
 * Download an admin CSV (it needs the sign-in token, so a plain link won't do), save it to the app's
 * cache and open the share sheet. Throws if the server refuses or sharing isn't available.
 */
export async function downloadAndShareCsv(path: string, filename: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError('Export failed', res.status);
  const text = await res.text();
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
}
