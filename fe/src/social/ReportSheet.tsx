import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet, InputField, PrimaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useReportReasons } from '@/src/config/AppConfigContext';
import { ApiError } from '@/src/api/client';
import { createReport, type ReportContext } from '@/src/api/reports';
import { track } from '@/src/analytics/track';

export type ReportSheetProps = {
  visible: boolean;
  onClose: () => void;
  questionId: string;
  attemptId?: string;
  context: ReportContext;
  onReported?: () => void;
};

const MAX_NOTE = 500;

/**
 * "Report this question" (FE-3.2). Reasons are server-driven (/app-config). A
 * second report of the same question is not an error: the server says it is
 * already reported and we tell the student their earlier report stands.
 */
export function ReportSheet({ visible, onClose, questionId, attemptId, context, onReported }: ReportSheetProps) {
  const { color, type, space, radius } = useTheme();
  const reasons = useReportReasons();
  const { show } = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
      setErr(null);
    }
  }, [visible, questionId]);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await createReport({
        item_type: 'question', item_id: questionId, reason, context,
        note: note.trim() || undefined, attempt_id: attemptId,
      });
      track('report.submitted', { reason, context, already: r.already_reported });
      show(r.already_reported ? 'You already reported this question — we’re on it.' : 'Thanks — we’ll review this question.', 'success');
      onReported?.();
      onClose();
    } catch (e) {
      setErr(
        e instanceof ApiError && e.code === 'not_exposed'
          ? 'You can only report questions you have seen.'
          : e instanceof ApiError && e.status === 429
            ? 'You’re reporting too quickly. Please wait a moment.'
            : 'Couldn’t send your report. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Report this question" dismissable={!busy}>
      {reasons.length === 0 ? (
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Reporting isn’t available right now.</Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {reasons.map((r) => {
            const on = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, minHeight: 48,
                  borderRadius: radius.md, borderWidth: on ? 2 : 1.5,
                  borderColor: on ? color('accent/default') : color('border/subtle'),
                  backgroundColor: on ? color('accent/tint') : color('bg/surface'),
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? color('accent/default') : color('border/strong'), alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('accent/default') }} /> : null}
                </View>
                <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{r.label}</Text>
              </Pressable>
            );
          })}
          <InputField
            label="Anything else? (optional)"
            value={note}
            onChangeText={(t: string) => setNote(t.slice(0, MAX_NOTE))}
            multiline
            placeholder="What looks wrong?"
          />
          <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'right' }]}>{note.length}/{MAX_NOTE}</Text>
          {err ? <Text style={[type['type/body-m'], { color: color('semantic/danger') }]} accessibilityLiveRegion="polite">{err}</Text> : null}
          <PrimaryButton label="Send report" onPress={submit} loading={busy} disabled={!reason} />
        </View>
      )}
    </BottomSheet>
  );
}
