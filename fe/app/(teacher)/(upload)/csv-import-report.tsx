import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { PrimaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type ErrorRow = { row: number; reason: string; preview: string };

const TOTAL_ROWS = 40;
const ERROR_ROWS: ErrorRow[] = [
  { row: 12, reason: 'Missing option_d', preview: 'Which of the following best describes an adiabatic process?' },
  { row: 27, reason: "correct_option must be A, B, C, or D — got 'E'", preview: 'The SI unit of entropy is measured in...' },
];

export default function CsvImportReportRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [processing, setProcessing] = useState(true);
  const successCount = TOTAL_ROWS - ERROR_ROWS.length;

  useEffect(() => {
    const t = setTimeout(() => setProcessing(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const allSucceeded = ERROR_ROWS.length === 0;
  const allFailed = successCount === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        {!processing ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Import Results
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
            shadow(),
          ]}
        >
          {processing ? (
            <>
              <OrbitPulse color={color('accent/default')} />
              <Text style={[type['type/body-m-medium'], { color: color('text/secondary'), marginTop: space.md }]}>
                Processing your file…
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[
                  type['type/numeral-display'],
                  { color: allFailed ? color('text/primary') : successCount > 0 ? color('semantic/success') : color('text/primary') },
                ]}
              >
                {successCount}
              </Text>
              <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
                of {TOTAL_ROWS} rows imported
              </Text>
              {!allSucceeded ? (
                <Text style={[type['type/body-m-medium'], { color: color('semantic/warning'), marginTop: space.sm }]}>
                  {ERROR_ROWS.length} rows need attention
                </Text>
              ) : null}
            </>
          )}
        </View>

        {!processing && allFailed ? (
          <View style={[styles.failBanner, { borderRadius: radius.md, marginTop: space.lg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color('semantic/danger'), opacity: 0.12, borderRadius: radius.md }]} />
            <View style={{ padding: space.md }}>
              <Text style={[type['type/body-m-medium'], { color: color('semantic/danger') }]}>
                None of these rows could be read — check that you&apos;re using the correct template.
              </Text>
              <TextButton label="Download Template" onPress={() => {}} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />
            </View>
          </View>
        ) : null}

        {!processing && ERROR_ROWS.length > 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
              ROWS TO FIX
            </Text>
            <View style={{ gap: space.sm }}>
              {ERROR_ROWS.map((e) => (
                <View
                  key={e.row}
                  style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}
                >
                  <View style={styles.errorRowHeader}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>Row {e.row}</Text>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/(teacher)/(upload)/question-builder', params: { prefillText: e.preview } })
                      }
                    >
                      <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Fix & Retry</Text>
                    </Pressable>
                  </View>
                  <Text style={[type['type/body-m'], { color: color('semantic/danger'), marginTop: 2 }]}>{e.reason}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]} numberOfLines={1}>
                    {e.preview}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {!processing ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label="Done" onPress={() => router.push('/(teacher)/(upload)/create-test')} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function OrbitPulse({ color: ink }: { color: string }) {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: ink,
        opacity: 0.6,
      }}
    />
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
  summaryCard: { alignItems: 'center' },
  failBanner: { overflow: 'hidden' },
  errorRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
