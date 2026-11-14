import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ConfirmDialog, SecondaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { updateContent } from '@/src/api/teacher';
import { formatBytes, MAX_VIDEO_BYTES, uploadVideo, type VideoUploadHandle } from '@/src/upload/videoUpload';

/**
 * Replace a lesson's video. On a lesson students can already reach, the lesson goes back to review,
 * so we ask first. Upload happens before the lesson is touched: a failed upload changes nothing.
 */
export function ReplaceVideo({ contentId, status, onReplaced }: { contentId: string; status: string; onReplaced: () => void }) {
  const { color, type, space } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<VideoUploadHandle | null>(null);
  const live = status === 'approved' || status === 'published';

  const run = async () => {
    setConfirm(false);
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size != null && a.size > MAX_VIDEO_BYTES) {
      setError(`This video is ${formatBytes(a.size)}. The limit is ${formatBytes(MAX_VIDEO_BYTES)}.`);
      return;
    }
    setBusy(true);
    setPct(0);
    try {
      const key = await uploadVideo({ uri: a.uri, name: a.name, mimeType: a.mimeType || 'video/mp4' }, { onProgress: (p) => setPct((c) => Math.max(c, p)), onHandle: (h) => { handle.current = h; } });
      await updateContent(contentId, { file_key: key });
      onReplaced();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error && e.message ? `Upload failed: ${e.message}` : 'Upload failed. Try again.');
    } finally {
      setBusy(false);
      handle.current = null;
    }
  };

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>VIDEO</Text>
      {busy ? (
        <>
          <View style={{ height: 4, backgroundColor: color('bg/sunken'), borderRadius: 2 }}>
            <View style={{ width: `${pct}%`, height: 4, backgroundColor: color('accent/default'), borderRadius: 2 }} />
          </View>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Uploading… {pct}%. Keep the app open and stay on Wi-Fi.</Text>
          <TextButton label="Cancel" onPress={() => handle.current?.abort()} style={{ alignSelf: 'flex-start' }} />
        </>
      ) : (
        <SecondaryButton label="Replace video" onPress={() => (live ? setConfirm(true) : void run())} />
      )}
      {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
      <ConfirmDialog
        visible={confirm}
        title="Replace the video?"
        message="Students can see this lesson now. A new video sends it back to review, and it is hidden until it is approved again."
        confirmLabel="Choose a video"
        onConfirm={() => void run()}
        onCancel={() => setConfirm(false)}
      />
    </View>
  );
}
