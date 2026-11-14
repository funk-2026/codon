import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { CaretRight, UploadSimple, X } from 'phosphor-react-native';
import { CourseSelector, ErrorBanner, InputField, PrimaryButton, SecondaryButton, TextButton, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { LecturePdfEditor, type PdfKind } from '@/src/content/LecturePdfEditor';
import { createContent } from '@/src/api/teacher';
import { getPresignedUrl } from '@/src/api/uploads';
import { listCourses, getCurriculum, type Course } from '@/src/api/courses';
import { defaultCourse } from '@/src/api/courseSelection';
import { ApiError } from '@/src/api/client';
import * as tus from 'tus-js-client';
import { ChapterPickerSheet } from '@/src/teacher/ChapterPickerSheet';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type ContentType = 'Video' | 'Document';
type VideoState = 'idle' | 'uploading' | 'ready' | 'failed';

export default function CreateContentRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

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
  // Lecture PDFs (videos only): notes + annotated, uploaded before the lesson is created
  const [pdfs, setPdfs] = useState<Record<PdfKind, { key?: string; name?: string }>>({ notes: {}, annotated: {} });
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const uploadTus = useRef<tus.Upload | null>(null);

  const loadCourseInfo = useCallback(async () => {
    try {
      const res = await listCourses();
      setCourses(res.courses);
      const first = defaultCourse(res.courses);
      if (first) {
        setCourseId(first.id);
        const cRes = await getCurriculum(first.id);
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

      // Dev stub bypass if Bunny is unconfigured in development
      if (presign.tus_auth?.signature === 'stub') {
        setVideoFileKey(presign.file_key);
        setVideoProgress(100);
        setVideoState('ready');
        return;
      }

      if (!presign.tus_auth) {
        throw new Error('Server did not provide TUS upload credentials');
      }

      const fileBlob = await (await fetch(uri)).blob();

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(fileBlob, {
          endpoint: presign.upload_url,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 5 * 1024 * 1024,
          headers: {
            AuthorizationSignature: presign.tus_auth!.signature,
            AuthorizationExpire: String(presign.tus_auth!.expires),
            LibraryId: String(presign.tus_auth!.library_id),
            VideoId: presign.tus_auth!.video_id,
          },
          metadata: {
            filetype: mimeType,
            title: name,
          },
          onProgress: (bytesSent, bytesTotal) => {
            if (bytesTotal > 0) {
              setVideoProgress(Math.round((bytesSent / bytesTotal) * 100));
            }
          },
          onSuccess: () => {
            uploadTus.current = null;
            resolve();
          },
          onError: (err) => {
            uploadTus.current = null;
            reject(err);
          },
        });

        uploadTus.current = upload;
        upload.start();
      });

      setVideoFileKey(presign.file_key);
      setVideoProgress(100);
      setVideoState('ready');
    } catch (err: any) {
      uploadTus.current = null;
      if (err?.message === 'cancelled') return;
      console.error('Video upload failed', err);
      const detail = err instanceof ApiError ? ` (${err.status}: ${err.message})` : err?.message ? `: ${err.message}` : '';
      setVideoError(`Upload failed${detail}`);
      setVideoState('failed');
    }
  };

  const cancelVideoUpload = () => {
    if (uploadTus.current) {
      uploadTus.current.abort();
      uploadTus.current = null;
    }
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

  // Switching course: drop the old location and default to the new course's first chapter (as on first load)
  const changeCourse = async (id: string) => {
    if (id === courseId) return;
    setCourseId(id);
    setLocation(null);
    setChapterId(null);
    try {
      const cRes = await getCurriculum(id);
      const chaps = cRes.course.subjects.flatMap((s: any) => s.chapters);
      setChapterId(chaps.length > 0 ? chaps[0].id : null);
    } catch {
      setLoadError(true);
    }
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const goToLocationPicker = () => setPickerOpen(true);

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
        ...(contentType === 'Video' ? { file_key: videoFileKey! } : { body_text: docBody.trim() }),
        ...(contentType === 'Video' && pdfs.notes.key ? { notes_pdf_key: pdfs.notes.key } : {}),
        ...(contentType === 'Video' && pdfs.annotated.key ? { annotated_pdf_key: pdfs.annotated.key } : {}),
      });
      show('Content saved', 'success');
      router.push({ pathname: ROUTES.teacher.contentPreview, params: { type: contentType, id: res.id } });
    } catch (err) {
      show('Failed to save content', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="New Content" right={<>
<TextButton label={saving ? 'Saving…' : 'Save Draft'} onPress={handleSaveDraft} disabled={saving} />
</>} />

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

          <CourseSelector courses={courses} value={courseId} onChange={changeCourse} />

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
              <TextInput
                value={docBody}
                onChangeText={setDocBody}
                multiline
                placeholder="Write the lesson here. Plain text; students read it in the app."
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

        {contentType === 'Video' ? (
          <View style={{ marginTop: space.xl, gap: space.sm }}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Lecture PDFs</Text>
            <LecturePdfEditor
              slots={{
                notes: { present: !!pdfs.notes.key, name: pdfs.notes.name },
                annotated: { present: !!pdfs.annotated.key, name: pdfs.annotated.name },
              }}
              onChange={(kind, key, name) => setPdfs((p) => ({ ...p, [kind]: key ? { key, name } : {} }))}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label="Preview & Submit"
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit || saving}
        />
      </View>

      <ChapterPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        courseId={courseId}
        selectedChapterId={location ? chapterId : null}
        onPick={(p) => {
          setCourseId(p.courseId);
          setChapterId(p.chapterId);
          setLocation(p.label);
          setPickerOpen(false);
        }}
      />

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
    </Screen>
  );
}


const styles = StyleSheet.create({
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
