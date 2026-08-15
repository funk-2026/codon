import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, UploadSimple, FileCsv, X } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useLocalSearchParams } from 'expo-router';
import { importQuestionsCSV } from '@/src/api/teacher';

const COLUMNS = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation'];

export default function CsvBulkUploadRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { testId } = useLocalSearchParams<{ testId?: string }>();

  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = () => {
    setError(null);
    setFile({ name: 'thermodynamics_questions.csv', size: '18 KB' });
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!testId) {
      setError('Test ID is missing. Please save the test first.');
      return;
    }
    setUploading(true);
    try {
      const res = await importQuestionsCSV(testId, { file_key: 'mock-csv-key' });
      router.push({ pathname: '/(teacher)/(upload)/csv-import-report', params: { batchId: res.batch_id } });
    } catch (err) {
      setError('Failed to upload CSV.');
    } finally {
      setUploading(false);
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
          <SecondaryButton label="Download Template (CSV)" onPress={() => {}} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
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
