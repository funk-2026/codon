import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CheckCircle, WarningCircle, XCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { commitCSVImport, getCSVImportReport, type GetCSVImportResponse } from '@/src/api/teacher';
import { track } from '@/src/analytics/track';

const POLL_MS = 1200;
const MAX_POLLS = 200;

function rawPreview(raw: string): string {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.join(', ');
    if (p && typeof p === 'object') return Object.values(p).filter(Boolean).join(', ');
  } catch { /* not JSON */ }
  return raw;
}

/**
 * Import report (FE-2.5): the same screen shows the CHECK (validate) result — with
 * a clear "Import N questions" step — and the final import result. Nothing is
 * saved until the teacher confirms.
 */
export default function CsvImportReportRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { batchId, testId } = useLocalSearchParams<{ batchId?: string; testId?: string }>();

  const [current, setCurrent] = useState<string | undefined>(batchId);
  const [report, setReport] = useState<GetCSVImportResponse | null>(null);
  const [state, setState] = useState<'processing' | 'ready' | 'error'>('processing');
  const [committing, setCommitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const polls = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!current) return setState('error');
    setState('processing');
    polls.current = 0;
    let stop = false;
    const run = async () => {
      if (stop) return;
      try {
        const r = await getCSVImportReport(current);
        if (stop) return;
        if (r.batch.status !== 'processing') {
          setReport(r);
          setState('ready');
          return;
        }
      } catch {
        if (!stop) setState('error');
        return;
      }
      if (++polls.current > MAX_POLLS) return setState('error');
      setTimeout(run, POLL_MS);
    };
    void run();
    return () => { stop = true; };
  }, [current, tick]);

  const batch = report?.batch;
  const isValidate = batch?.mode === 'validate';
  const sum = batch?.summary;
  const rows = report?.errors ?? [];
  const errors = useMemo(() => rows.filter((e) => (e.severity ?? 'error') === 'error'), [rows]);
  const warnings = useMemo(() => rows.filter((e) => e.severity === 'warning'), [rows]);
  const okRows = sum?.ok ?? batch?.success_rows ?? 0;
  const total = sum?.rows ?? batch?.total_rows ?? 0;
  const failed = batch?.status === 'failed';
  const tid = testId ?? batch?.test_id;

  const goToTest = useCallback(() => {
    if (tid) router.replace({ pathname: '/(teacher)/question-builder', params: { testId: tid } });
    else router.back();
  }, [router, tid]);

  const commit = async () => {
    if (!current) return;
    setCommitting(true);
    try {
      const r = await commitCSVImport(current);
      track('import.committed', { ok: okRows });
      setConfirmOpen(false);
      setCurrent(r.batch_id);
    } catch (e) {
      show(
        e instanceof ApiError && e.code === 'file_changed' ? 'The file changed since it was checked. Please check it again.'
        : e instanceof ApiError && e.code === 'test_locked' ? 'This test is no longer editable.'
        : 'Couldn’t start the import. Try again.',
        'error',
      );
    } finally {
      setCommitting(false);
    }
  };

  const Group = ({ title, list, tone }: { title: string; list: typeof rows; tone: 'semantic/danger' | 'semantic/warning' }) =>
    list.length === 0 ? null : (
      <View style={{ marginTop: space.lg }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{title}</Text>
        <View style={{ gap: space.sm }}>
          {list.slice(0, 100).map((e) => (
            <View key={e.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: 2 }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{e.row_number > 0 ? `Row ${e.row_number}` : 'File'}{e.field ? ` · ${e.field}` : ''}</Text>
              <Text style={[type['type/body-m'], { color: color(tone) }]}>{e.error_message}</Text>
              {e.raw_row_data ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>{rawPreview(e.raw_row_data)}</Text> : null}
            </View>
          ))}
          {list.length > 100 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>…and {list.length - 100} more. Fix these and check the file again.</Text> : null}
        </View>
      </View>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        {state !== 'processing' ? (
          <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
        ) : <View style={{ width: 44 }} />}
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>{isValidate ? 'Check results' : 'Import results'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 160 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {state === 'processing' ? (
          <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, alignItems: 'center', gap: space.sm }} accessibilityLiveRegion="polite">
            <SkeletonBlock width={72} height={40} radius={radius.sm} />
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{committing ? 'Importing…' : 'Reading your file…'}</Text>
          </View>
        ) : state === 'error' || !batch ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the results"
            description="Something went wrong checking on your file."
            action={<TextButton label="Retry" onPress={() => setTick((t) => t + 1)} />}
          />
        ) : failed ? (
          <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.lg, padding: space.lg, gap: space.xs }}>
            <XCircle size={28} weight="fill" color={color('semantic/danger')} />
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>We couldn’t read this file.</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{errors[0]?.error_message ?? 'Check that it is a CSV made from our template.'}</Text>
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, alignItems: 'center', gap: 4 }}>
              {errors.length === 0 ? <CheckCircle size={28} weight="fill" color={color('semantic/success')} /> : <WarningCircle size={28} weight="fill" color={color('semantic/warning')} />}
              <Text style={[type['type/numeral-display'], { color: errors.length === 0 ? color('semantic/success') : color('text/primary') }]}>{okRows}</Text>
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                of {total} rows {isValidate ? 'are ready to import' : batch.mode === 'update' ? 'updated' : 'imported'}
              </Text>
              {errors.length > 0 ? <Text style={[type['type/body-m-medium'], { color: color('semantic/warning') }]}>{errors.length} row{errors.length > 1 ? 's' : ''} need attention</Text> : null}
              {warnings.length > 0 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{warnings.length} warning{warnings.length > 1 ? 's' : ''}</Text> : null}
            </View>

            {(sum?.images_found ?? 0) > 0 || (sum?.images_missing?.length ?? 0) > 0 ? (
              <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.md, gap: 4 }}>
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{sum?.images_found ?? 0} image{(sum?.images_found ?? 0) === 1 ? '' : 's'} found in your ZIP</Text>
                {(sum?.images_missing?.length ?? 0) > 0 ? (
                  <Text style={[type['type/body-m'], { color: color('semantic/danger') }]}>Missing: {sum!.images_missing!.slice(0, 6).join(', ')}{sum!.images_missing!.length > 6 ? '…' : ''}</Text>
                ) : null}
                {(sum?.unreferenced_images?.length ?? 0) > 0 ? (
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{sum!.unreferenced_images!.length} image(s) in the ZIP aren’t used by any row.</Text>
                ) : null}
              </View>
            ) : null}

            <Group title="ROWS TO FIX" list={errors} tone="semantic/danger" />
            <Group title="WARNINGS (STILL IMPORTED)" list={warnings} tone="semantic/warning" />
          </>
        )}
      </ScrollView>

      {state === 'ready' && batch && !failed ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm }}>
          {isValidate ? (
            <>
              <PrimaryButton
                label={okRows > 0 ? `Import ${okRows} question${okRows > 1 ? 's' : ''}` : 'Nothing to import'}
                disabled={okRows === 0}
                onPress={() => (errors.length > 0 ? setConfirmOpen(true) : void commit())}
                loading={committing}
              />
              <SecondaryButton label="Choose a different file" onPress={() => router.back()} />
            </>
          ) : (
            <PrimaryButton label="Back to the test" onPress={goToTest} />
          )}
        </View>
      ) : null}

      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Import the valid rows?" dismissable={!committing}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          {okRows} row{okRows > 1 ? 's' : ''} will be imported. The {errors.length} row{errors.length > 1 ? 's' : ''} with problems will be skipped — you can fix them in your CSV and import them afterwards.
        </Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <PrimaryButton label={`Import ${okRows}`} onPress={() => void commit()} loading={committing} />
          <SecondaryButton label="Cancel" onPress={() => setConfirmOpen(false)} disabled={committing} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
