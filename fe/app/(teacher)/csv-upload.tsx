import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, FileArchive, FileCsv, UploadSimple, X } from 'phosphor-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PrimaryButton, SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getModule } from '@/src/modules/registry';
import { ApiError } from '@/src/api/client';
import { getCSVTemplate, getTeacherTest, importQuestionsCSV, type CSVImportMode, type CSVTemplate } from '@/src/api/teacher';
import { getPresignedUrl } from '@/src/api/uploads';
import { presignMedia } from '@/src/api/media';
import { putFile } from '@/src/media/upload';
import type { Test } from '@/src/api/tests';
import { track } from '@/src/analytics/track';

type Picked = { name: string; size?: number; uri: string };

const fmt = (b?: number) => (b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** CSV fields containing commas/quotes/newlines must be quoted. */
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export default function CsvBulkUploadRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { testId } = useLocalSearchParams<{ testId?: string; testTitle?: string }>();

  const [test, setTest] = useState<Test | null>(null);
  const [template, setTemplate] = useState<CSVTemplate | null>(null);
  const [csv, setCsv] = useState<Picked | null>(null);
  const [zip, setZip] = useState<Picked | null>(null);
  const [mode, setMode] = useState<CSVImportMode>('validate');
  const [allowContentUpdate, setAllowContentUpdate] = useState(false);
  const [updateMode, setUpdateMode] = useState(false);
  const [busy, setBusy] = useState<null | { label: string; pct?: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (testId) getTeacherTest(testId).then((r) => setTest(r.test)).catch(() => {});
    getCSVTemplate(2).then(setTemplate).catch(() => {});
    return () => cancel.current?.();
  }, [testId]);

  const pick = async (kind: 'csv' | 'zip') => {
    setError(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: kind === 'csv' ? ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'] : ['application/zip', 'application/x-zip-compressed'],
        copyToCacheDirectory: true,
      });
      if (r.canceled) return;
      const a = r.assets[0];
      const p = { name: a.name, size: a.size, uri: a.uri };
      if (kind === 'csv') setCsv(p);
      else setZip(p);
    } catch {
      setError('Couldn’t open that file.');
    }
  };

  const downloadTemplate = async () => {
    try {
      if (!template) return show('Template isn’t available right now. Try again.', 'error');
      if (!FileSystem.cacheDirectory) return show('Template download isn’t supported on this device.', 'error');
      const content = `${template.header}\n${template.example_row.map(csvCell).join(',')}\n`;
      const uri = `${FileSystem.cacheDirectory}question-template-v${template.version}.csv`;
      await FileSystem.writeAsStringAsync(uri, content);
      if (!(await Sharing.isAvailableAsync())) return show('Sharing isn’t available on this device.', 'error');
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch {
      show('Couldn’t create the template.', 'error');
    }
  };

  const start = async () => {
    if (!csv || !testId) return;
    setError(null);
    try {
      // 1. images ZIP (optional) — straight to storage via the media pipeline
      let bundleKey: string | undefined;
      if (zip) {
        setBusy({ label: 'Uploading images…', pct: 0 });
        const bytes = zip.size ?? ((await FileSystem.getInfoAsync(zip.uri)) as { size?: number }).size ?? 0;
        const ps = await presignMedia({ purpose: 'import_bundle', file_name: zip.name, content_type: 'application/zip', bytes });
        const up = putFile(ps.upload_url, zip.uri, ps.headers, (f) => setBusy({ label: 'Uploading images…', pct: f }));
        cancel.current = up.cancel;
        await up.promise;
        bundleKey = ps.file_key;
      }
      // 2. the CSV
      setBusy({ label: 'Uploading file…' });
      const presign = await getPresignedUrl({ file_name: csv.name, content_type: 'text/csv', purpose: 'csv' });
      const blob = await (await fetch(csv.uri)).blob();
      const put = await fetch(presign.upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'text/csv' } });
      if (!put.ok) throw new Error(`storage ${put.status}`);
      // 3. start
      setBusy({ label: 'Starting…' });
      const m: CSVImportMode = updateMode ? 'update' : mode;
      const res = await importQuestionsCSV(testId, { file_key: presign.file_key, bundle_key: bundleKey, mode: m, allow_content_update: updateMode ? allowContentUpdate : undefined });
      track('import.preflight', { mode: m, bundle: !!zip });
      router.push({ pathname: '/(teacher)/csv-import-report', params: { batchId: res.batch_id, testId } });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'test_locked') setError('This test is no longer editable, so questions can’t be imported into it.');
        else if (e.code === 'purpose_forbidden' || e.status === 403) setError('You don’t have permission to import into this test.');
        else if (e.code === 'quota_exceeded') setError('You’ve reached your upload limit.');
        else setError(`The server couldn’t start the import (${e.message}).`);
      } else setError('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(null);
      cancel.current = null;
    }
  };

  const FileRow = ({ f, icon, onClear }: { f: Picked; icon: React.ReactNode; onClear: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{f.name}</Text>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{fmt(f.size)}</Text>
      </View>
      <Pressable onPress={onClear} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <X size={18} color={color('text/tertiary')} />
      </Pressable>
    </View>
  );

  const Zone = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: 96, borderWidth: 1, borderStyle: 'dashed', borderColor: color('border/strong'), borderRadius: radius.md, backgroundColor: color('bg/sunken'), alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
      <UploadSimple size={26} color={color('text/tertiary')} />
      <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Bulk import</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {test ? (
          <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.sm }}>
            <Text style={[type['type/caption'], { color: color('accent/default') }]}>IMPORTING INTO</Text>
            <Text style={[type['type/body-l'], { color: color('text/primary') }]} numberOfLines={1}>{test.title} · {getModule(test.module_type).label}</Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>1 · Start from the template</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
            Includes optional columns for chapter, difficulty, tags, NCERT page and images. You can fill in as many as you like.
          </Text>
          <SecondaryButton label="Download template (CSV)" onPress={downloadTemplate} style={{ alignSelf: 'flex-start' }} />
          {template ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs }}>
              {template.columns.map((c) => (
                <View key={c.name} style={{ backgroundColor: c.required ? color('accent/tint') : color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.xs, paddingVertical: 4 }}>
                  <Text style={[type['type/caption'], { color: c.required ? color('accent/default') : color('text/secondary') }]}>{c.name}{c.required ? ' *' : ''}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
            * required · correct_option must be A, B, C or D · rich text (bold, sub/superscript) works in every text column.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>2 · Your CSV</Text>
          {csv ? <FileRow f={csv} icon={<FileCsv size={28} color={color('accent/default')} />} onClear={() => setCsv(null)} /> : <Zone label="Tap to choose a CSV file" onPress={() => pick('csv')} />}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>3 · Images (optional)</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
            Using image columns? Put the pictures in a ZIP (inside an “images” folder) — the CSV refers to them by file name.
          </Text>
          {zip ? <FileRow f={zip} icon={<FileArchive size={28} color={color('accent/default')} />} onClear={() => setZip(null)} /> : <Zone label="Tap to choose a ZIP of images" onPress={() => pick('zip')} />}
        </View>

        <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Update existing questions</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Fix metadata (chapter, difficulty, tags…) in bulk using the question_id column.</Text>
            </View>
            <Switch value={updateMode} onValueChange={setUpdateMode} accessibilityLabel="Update existing questions" />
          </View>
          {updateMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Also allow changing wording and answers</Text>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Changes to live questions are sent for review.</Text>
              </View>
              <Switch value={allowContentUpdate} onValueChange={setAllowContentUpdate} accessibilityLabel="Allow content changes" />
            </View>
          ) : null}
        </View>

        {error ? <Text style={[type['type/body-m'], { color: color('semantic/danger') }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.xs }}>
        {busy ? (
          <View style={{ gap: 6 }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{busy.label}{busy.pct != null ? ` ${Math.round(busy.pct * 100)}%` : ''}</Text>
            {busy.pct != null ? (
              <View style={{ height: 4, borderRadius: 2, backgroundColor: color('border/subtle') }}>
                <View style={{ width: `${Math.round(busy.pct * 100)}%`, height: 4, borderRadius: 2, backgroundColor: color('accent/default') }} />
              </View>
            ) : null}
          </View>
        ) : null}
        <PrimaryButton label={updateMode ? 'Check updates' : 'Check my file'} onPress={start} disabled={!csv || !testId} loading={!!busy} />
        <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>Nothing is saved yet — you’ll review the results first.</Text>
      </View>
    </SafeAreaView>
  );
}
