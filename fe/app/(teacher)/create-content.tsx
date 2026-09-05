import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  CaretLeft,
  CaretRight,
  UploadSimple,
  TextB,
  TextHOne,
  ListBullets,
  X,
} from 'phosphor-react-native';
import { ErrorBanner, InputField, PrimaryButton, SecondaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { createContent } from '@/src/api/teacher';
import { getPresignedUrl } from '@/src/api/uploads';
import { listCourses, getCurriculum } from '@/src/api/courses';
import { ApiError } from '@/src/api/client';

type ContentType = 'Video' | 'Document';
type VideoState = 'idle' | 'uploading' | 'ready' | 'failed';

export default function CreateContentRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { locationLabel, chapterId: pickedChapterId } = useLocalSearchParams<{ locationLabel?: string; chapterId?: string }>();

  const [contentType, setContentType] = useState<ContentType>('Video');
  const [pendingTypeSwitch, setPendingTypeSwitch] = useState<ContentType | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoFileName, setVideoFileName] = useState('');
  const [videoFileKey, setVideoFileKey] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [docBody, setDocBody] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const uploadXhr = useRef<XMLHttpRequest | null>(null);

  const loadCourseInfo = useCallback(async () => {
    try {
      const res = await listCourses();
      if (res.courses.length > 0) {
        setCourseId(res.courses[0].id);
        const cRes = await getCurriculum(res.courses[0].id);
        const chaps = cRes.course.subjects.flatMap((s: any) => s.chapters);
        if (chaps.length > 0) setChapterId(chaps[0].id);
      }
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadCourseInfo();
  }, [loadCourseInfo]);

  useEffect(() => {
    if (locationLabel) setLocation(locationLabel);
    if (pickedChapterId) setChapterId(pickedChapterId);
  }, [locationLabel, pickedChapterId]);

  useEffect(() => {
    if (contentType !== 'Document' || docBody.trim().length === 0) return;
    const t = setTimeout(() => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 800);
    }, 10000);
    return () => clearTimeout(t);
  }, [docBody, contentType]);

  const handleSelectVideo = async () => {
    setVideoError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      uploadVideo(asset.uri, asset.name, asset.mimeType || 'video/mp4');
    } catch (err) {
      setVideoError('Failed to select file.');
    }
  };

  const uploadVideo = async (uri: string, name: string, mimeType: string) => {
    setVideoFileName(name);
    setVideoFileKey(null);
    setVideoError(null);
    setVideoState('uploading');
    setVideoProgress(0);

    try {
      const presign = await getPresignedUrl({ file_name: name, content_type: mimeType, purpose: 'video' });
      // Cloudflare Stream's direct-upload URL takes a multipart POST; the R2
      // fallback (when Stream isn't configured) takes a raw PUT, same as
      // every other upload purpose in this app.
      const isStream = presign.file_key.startsWith('stream:');

      let body: FormData | Blob;
      if (isStream) {
        const formData = new FormData();
        formData.append('file', { uri, name, type: mimeType } as unknown as Blob);
        body = formData;
      } else {
        body = await (await fetch(uri)).blob();
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXhr.current = xhr;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setVideoProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("couldn't upload the file — check your connection and try again"));
        xhr.onabort = () => reject(new Error('cancelled'));
        xhr.open(isStream ? 'POST' : 'PUT', presign.upload_url);
        if (!isStream) xhr.setRequestHeader('Content-Type', mimeType);
        xhr.send(body as any);
      });

      uploadXhr.current = null;
      setVideoFileKey(presign.file_key);
      setVideoProgress(100);
      setVideoState('ready');
    } catch (err: any) {
      uploadXhr.current = null;
      if (err?.message === 'cancelled') return;
      console.error('Video upload failed', err);
      const detail = err instanceof ApiError ? ` (${err.status}: ${err.message})` : err?.message ? `: ${err.message}` : '';
      setVideoError(`Upload failed${detail}`);
      setVideoState('failed');
    }
  };

  const cancelVideoUpload = () => {
    uploadXhr.current?.abort();
    uploadXhr.current = null;
    setVideoState('idle');
    setVideoProgress(0);
    setVideoFileKey(null);
    setVideoError(null);
  };

  const handleTypeToggle = (next: ContentType) => {
    if (next === contentType) return;
    if ((contentType === 'Video' && videoState !== 'idle') || (contentType === 'Document' && docBody.trim().length > 0)) {
      setPendingTypeSwitch(next);
      return;
    }
    setContentType(next);
  };

  const confirmTypeSwitch = () => {
    if (!pendingTypeSwitch) return;
    setContentType(pendingTypeSwitch);
    setPendingTypeSwitch(null);
    cancelVideoUpload();
    setDocBody('');
  };

  const goToLocationPicker = () => {
    router.push({
      pathname: '/(teacher)/(tabs)/(home)/course-structure-manager',
      params: { pickerMode: '1', returnTo: '/(teacher)/create-content' },
    });
  };

  const handleSaveDraft = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      show('Draft saved', 'success');
    }, 600);
  };

  const canSubmit =
    title.trim().length > 0 &&
    !!courseId && !!chapterId &&
    (contentType === 'Video' ? videoState === 'ready' : docBody.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await createContent({
        title,
        course_id: courseId!,
        content_type: contentType === 'Video' ? 'video' : 'document',
        chapter_id: chapterId!,
        file_key: contentType === 'Video' ? videoFileKey! : 'mock-doc-key',
      });
      show('Content saved', 'success');
      router.push({ pathname: '/(teacher)/content-preview', params: { type: contentType, id: res.id } });
    } catch (err) {
      show('Failed to save content', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
          New Content
        </Text>
        <TextButton label={saving ? 'Saving…' : 'Save Draft'} onPress={handleSaveDraft} disabled={saving} />
      </View>

      {loadError ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
          <ErrorBanner message="Couldn't load your course info." onRetry={loadCourseInfo} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.segmented, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3, marginTop: space.xl }]}>
          {(['Video', 'Document'] as ContentType[]).map((t) => {
            const active = contentType === t;
            return (
              <Pressable
                key={t}
                onPress={() => handleTypeToggle(t)}
                style={[styles.segment, { borderRadius: radius.pill, backgroundColor: active ? color('accent/default') : 'transparent' }]}
              >
                <Text style={[type['type/body-m-medium'], { color: active ? color('accent/on-accent') : color('text/secondary') }]}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: space.lg, gap: space.lg }}>
          <InputField label="Title" value={title} onChangeText={setTitle} />

          <Pressable
            onPress={goToLocationPicker}
            style={[
              styles.readOnlyRow,
              { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Location in Course</Text>
              <Text style={[type['type/body-l'], { color: location ? color('text/primary') : color('text/tertiary'), marginTop: 2 }]}>
                {location ?? 'Not set'}
              </Text>
            </View>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>

          <InputField label="Topic" value={topic} onChangeText={setTopic} placeholder="Optional" />
          <InputField label="Description / Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
        </View>

        <View style={{ marginTop: space.xl }}>
          {contentType === 'Video' ? (
            videoState === 'idle' ? (
              <Pressable
                onPress={handleSelectVideo}
                style={[
                  styles.uploadZone,
                  { backgroundColor: color('bg/sunken'), borderRadius: radius.md, borderColor: color('border/strong') },
                ]}
              >
                <UploadSimple size={28} color={color('text/tertiary')} />
                <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.xs, textAlign: 'center' }]}>
                  Select a video file (MP4, max 2GB)
                </Text>
              </Pressable>
            ) : (
              <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}>
                <View style={styles.videoFileRow}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>
                    {videoFileName}
                  </Text>
                  {videoState === 'uploading' ? (
                    <Pressable onPress={cancelVideoUpload} hitSlop={space.xs}>
                      <X size={18} color={color('text/tertiary')} />
                    </Pressable>
                  ) : null}
                </View>
                {videoState === 'uploading' ? (
                  <>
                    <View style={{ height: 4, backgroundColor: color('bg/sunken'), borderRadius: 2, marginTop: space.sm }}>
                      <View style={{ width: `${videoProgress}%`, height: 4, backgroundColor: color('accent/default'), borderRadius: 2 }} />
                    </View>
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                      Uploading… {videoProgress}%
                    </Text>
                  </>
                ) : videoState === 'ready' ? (
                  <Text style={[type['type/caption'], { color: color('semantic/success'), marginTop: space.xs }]}>
                    Uploaded — will process after you submit
                  </Text>
                ) : videoState === 'failed' ? (
                  <>
                    <Text style={[type['type/caption'], { color: color('semantic/danger'), marginTop: space.xs }]}>
                      {videoError || 'Upload failed.'}
                    </Text>
                    <TextButton label="Try Again" onPress={handleSelectVideo} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />
                  </>
                ) : null}
              </View>
            )
          ) : (
            <View>
              <View style={[styles.toolbar, { backgroundColor: color('bg/sunken'), borderRadius: radius.sm }]}>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <TextB size={18} color={color('text/secondary')} />
                  <TextHOne size={18} color={color('text/secondary')} />
                  <ListBullets size={18} color={color('text/secondary')} />
                </View>
                {savedFlash ? (
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Saved</Text>
                ) : null}
              </View>
              <TextInput
                value={docBody}
                onChangeText={setDocBody}
                multiline
                placeholder="Write the document content here…"
                placeholderTextColor={color('text/tertiary')}
                style={[
                  type['type/body-l'],
                  {
                    color: color('text/primary'),
                    backgroundColor: color('bg/sunken'),
                    borderBottomLeftRadius: radius.sm,
                    borderBottomRightRadius: radius.sm,
                    padding: space.sm,
                    minHeight: 200,
                    textAlignVertical: 'top',
                  },
                ]}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label="Preview & Submit"
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit || saving}
        />
      </View>

      <Modal visible={!!pendingTypeSwitch} transparent animationType="fade" onRequestClose={() => setPendingTypeSwitch(null)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Switch type?</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>
              Your uploaded file will be removed.
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton label="Switch Type" onPress={confirmTypeSwitch} />
              <SecondaryButton label="Cancel" onPress={() => setPendingTypeSwitch(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  segmented: { flexDirection: 'row' },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center' },
  uploadZone: { minHeight: 160, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 16 },
  videoFileRow: { flexDirection: 'row', alignItems: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});
