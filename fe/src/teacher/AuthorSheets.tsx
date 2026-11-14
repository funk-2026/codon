import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BottomSheet, InputField, PrimaryButton, SecondaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getReviewStats } from '@/src/api/teacher';
import { describeWait, formatScheduled, parseSchedule, scheduleError } from './schedule';

/** Send for review: an optional note for the reviewer and an honest idea of how long it takes. */
export function SubmitForReviewSheet({
  visible,
  onClose,
  onSubmit,
  resubmit,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  resubmit?: boolean;
  loading?: boolean;
}) {
  const { color, type, space } = useTheme();
  const [note, setNote] = useState('');
  const stats = useQuery({ queryKey: ['teacher', 'review-stats'], queryFn: getReviewStats, enabled: visible, staleTime: 5 * 60_000 });
  const wait = describeWait(stats.data?.median_hours);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={resubmit ? 'Resubmit for review' : 'Send for review'} dismissable={!loading}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.sm }}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          {wait ? `Reviews usually take ${wait}.` : 'An admin will review it before students see it.'}
          {stats.data && stats.data.queued > 0 ? ` ${stats.data.queued} ${stats.data.queued === 1 ? 'item is' : 'items are'} waiting right now.` : ''}
        </Text>
        <InputField
          label={resubmit ? 'What did you change? (optional)' : 'Note for the reviewer (optional)'}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder={resubmit ? 'e.g. Fixed the answer key in Q4' : 'e.g. Questions are from NCERT Class 11, ch. 8'}
        />
        <PrimaryButton label={resubmit ? 'Resubmit' : 'Send for review'} onPress={() => onSubmit(note.trim())} loading={loading} />
        <TextButton label="Cancel" onPress={onClose} disabled={loading} />
      </View>
    </BottomSheet>
  );
}

/** Publish an approved item now, or pick a time. A scheduled item shows when it will go live and can be cancelled. */
export function PublishSheet({
  visible,
  onClose,
  onPublishNow,
  onSchedule,
  scheduledAt,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onPublishNow: () => void;
  onSchedule: (iso: string | null) => void;
  scheduledAt?: string | null;
  loading?: boolean;
}) {
  const { color, type, space } = useTheme();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [touched, setTouched] = useState(false);
  const err = touched ? scheduleError(date, time) : null;
  const submit = () => {
    setTouched(true);
    if (scheduleError(date, time)) return;
    const at = parseSchedule(date, time);
    if (at) onSchedule(at.toISOString());
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Publish" dismissable={!loading}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.sm }}>
        {scheduledAt ? (
          <View style={{ gap: space.xs }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Goes live {formatScheduled(scheduledAt)}</Text>
            <SecondaryButton label="Cancel the schedule" onPress={() => onSchedule(null)} loading={loading} />
          </View>
        ) : null}
        <PrimaryButton label="Publish now" onPress={onPublishNow} loading={loading} />
        <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.sm }]}>OR PICK A TIME</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1.4 }}>
            <InputField label="Date" value={date} onChangeText={setDate} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <InputField label="Time (24h)" value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
          </View>
        </View>
        {err ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{err}</Text> : null}
        <SecondaryButton label={scheduledAt ? 'Change the time' : 'Schedule'} onPress={submit} loading={loading} />
      </View>
    </BottomSheet>
  );
}

/** Hand a test or lesson to another teacher by their phone number. */
export function TransferSheet({
  visible,
  onClose,
  onTransfer,
  loading,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onTransfer: (phone: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const { color, type, space } = useTheme();
  const [phone, setPhone] = useState('');
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Hand over to another teacher" dismissable={!loading}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.sm }}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          They become the owner and you lose access to it. They are notified.
        </Text>
        <InputField label="Their phone number" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
        {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
        <PrimaryButton label="Hand over" onPress={() => onTransfer(phone.trim())} disabled={phone.trim().length < 8} loading={loading} />
        <TextButton label="Cancel" onPress={onClose} disabled={loading} />
      </View>
    </BottomSheet>
  );
}
