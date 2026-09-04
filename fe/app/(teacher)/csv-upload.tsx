import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, UploadSimple, FileCsv, X } from 'phosphor-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PrimaryButton, SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useLocalSearchParams } from 'expo-router';
import { importQuestionsCSV } from '@/src/api/teacher';
import { getPresignedUrl } from '@/src/api/uploads';
import { getTest, type Test } from '@/src/api/tests';
import { ApiError } from '@/src/api/client';

const COLUMNS = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation'];

const MODULE_TYPE_LABEL: Record<string, string> = {
  qbank: 'Q Bank',
  test_series: 'Test Series',
  practice: 'Practice',
};

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CsvBulkUploadRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { testId } = useLocalSearchParams<{ testId?: string }>();
  const { show } = useToast();

  const [file, setFile] = useState<{ name: string; size: string; uri: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<Test | null>(null);

  useEffect(() => {
    if (!testId) return;
    getTest(testId)
      .then((res) => setTest(res.test))
      .catch(() => {});
  }, [testId]);

  const handleSelectFile = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setFile({ name: asset.name, size: formatFileSize(asset.size), uri: asset.uri });
    } catch (err) {
      setError('Failed to select file.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!testId) {
      setError('Test ID is missing. Please save the test first.');
      return;
    }
    setUploading(true);
    setError(null);

    let presign;
    try {
      presign = await getPresignedUrl({ filename: file.name, content_type: 'text/csv' });
    } catch (err) {
      console.error('CSV upload: presign request failed', err);
      const detail = err instanceof ApiError ? ` (${err.status}: ${err.message})` : '';
      setError(`Couldn't get an upload URL from the server${detail}.`);
      setUploading(false);
      return;
    }

    let putRes;
    try {
      const blob = await (await fetch(file.uri)).blob();
      putRes = await fetch(presign.upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'text/csv' },
      });
    } catch (err) {
      console.error('CSV upload: PUT to storage failed', err);
      setError("Couldn't upload the file to storage — check your connection and try again.");
      setUploading(false);
      return;
    }
    if (!putRes.ok) {
      console.error('CSV upload: PUT to storage returned', putRes.status, await putRes.text().catch(() => ''));
      setError(`Upload to storage failed (${putRes.status}).`);
      setUploading(false);
      return;
    }

    try {
      const res = await importQuestionsCSV(testId, { file_key: presign.file_key });
      router.push({ pathname: '/(teacher)/csv-import-report', params: { batchId: res.batch_id } });
    } catch (err) {
      console.error('CSV upload: import-questions request failed', err);
      const detail = err instanceof ApiError ? ` (${err.status}: ${err.message})` : '';
      setError(`File uploaded, but the server couldn't process it${detail}.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      if (!FileSystem.cacheDirectory) {
        show('Template download is not supported on this device.', 'error');
        return;
      }
      const csvContent = `${COLUMNS.join(',')}\n`;
      const fileUri = `${FileSystem.cacheDirectory}question-template.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        show('Sharing is not available on this device.', 'error');
        return;
      }
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (err) {
      show('Failed to generate template.', 'error');
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
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Bulk Upload
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {test ? (
          <View
            style={[
              styles.testContextCard,
              { backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.sm, marginTop: space.md },
            ]}
          >
            <Text style={[type['type/caption'], { color: color('accent/default') }]}>
              UPLOADING INTO
            </Text>
            <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: 2 }]} numberOfLines={1}>
              {test.title} · {MODULE_TYPE_LABEL[test.module_type] ?? test.module_type}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
            shadow(),
          ]}
        >
          <Text style={[type['type/h3'], { color: color('text/primary') }]}>Use our template</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
            Start from our CSV template so every column lines up correctly.
          </Text>
          <SecondaryButton label="Download Template (CSV)" onPress={handleDownloadTemplate} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
        </View>

        <View
          style={[
            { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
          ]}
        >
          <View style={[styles.colChipRow, { gap: space.xs }]}>
            {COLUMNS.map((c) => (
              <View
                key={c}
                style={[styles.colChip, { backgroundColor: color('bg/canvas'), borderRadius: radius.sm, borderColor: color('border/subtle'), paddingHorizontal: space.xs }]}
              >
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.sm }]}>
            correct_option must be A, B, C, or D.
          </Text>
        </View>

        <View style={{ marginTop: space.xl }}>
          {file ? (
            <View
              style={[
                styles.fileChip,
                { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md },
              ]}
            >
              <FileCsv size={28} color={color('accent/default')} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  {file.size}
                </Text>
              </View>
              <Pressable onPress={() => setFile(null)} hitSlop={space.xs}>
                <X size={18} color={color('text/tertiary')} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleSelectFile}
              style={[
                styles.uploadZone,
                { backgroundColor: color('bg/sunken'), borderRadius: radius.md, borderColor: color('border/strong') },
              ]}
            >
              <UploadSimple size={28} color={color('text/tertiary')} />
              <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.xs }]}>
                Tap to select a CSV file
              </Text>
            </Pressable>
          )}
          {error ? (
            <Text style={[type['type/caption'], { color: color('semantic/danger'), marginTop: space.xs }]}>
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label={uploading ? 'Processing…' : 'Upload & Process'}
          onPress={handleUpload}
          disabled={!file}
          loading={uploading}
        />
      </View>
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
  testContextCard: {},
  colChipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  colChip: { borderWidth: 1, paddingVertical: 4 },
  fileChip: { flexDirection: 'row', alignItems: 'center' },
  uploadZone: {
    minHeight: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
