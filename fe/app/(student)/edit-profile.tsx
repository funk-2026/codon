import { useState } from 'react';
import { Switch, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info, Lock } from 'phosphor-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/src/queries/profile';
import { keys } from '@/src/queries/keys';
import { formatExamDate, parseExamDate } from '@/src/profile/examDate';
import { BottomSheet, ConfirmDialog, DateField, InputField, SecondaryButton, SelectField, TextButton, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';
import { getResets, INDIAN_STATES, resetContent, updateMe, type ResetScope, type ResetStatus } from '@/src/api/profile';
import { useSafeBack } from '@/src/navigation/useSafeBack';

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const RESETS: { scope: ResetScope; label: string; what: string }[] = [
  { scope: 'bookmarks', label: 'Reset Bookmarks', what: 'Your saved questions, flash cards and pulse items.' },
  { scope: 'qbank', label: 'Reset QBank', what: 'Your QBank attempts, answers, progress and accuracy, so chapters can be solved again.' },
  { scope: 'flashcards', label: 'Reset Flashcards', what: 'Your flash card progress and review schedule.' },
  { scope: 'pulse', label: 'Reset Pulse', what: 'Your Pulse reading history.' },
];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function EditProfileRoute() {
  const { color, type, space, radius } = useTheme();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { user, refreshUser } = useAuth();
  const meQuery = useMe();
  const queryClient = useQueryClient();
  const me = meQuery.data?.user;

  const initialName = user?.name || '';
  const initialExam = formatExamDate(me?.exam_date);
  const initialState = me?.state ?? '';
  // Edited values are kept apart from the saved ones, so a late-arriving profile doesn't overwrite typing.
  const [name, setName] = useState(initialName);
  const [examEdit, setExamEdit] = useState<string | null>(null);
  const [stateEdit, setStateEdit] = useState<string | null>(null);
  const [optOutEdit, setOptOutEdit] = useState<boolean | null>(null);
  const exam = examEdit ?? initialExam;
  const stateVal = stateEdit ?? initialState;
  const optOut = optOutEdit ?? !!me?.leaderboard_opt_out;
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== initialName || (examEdit !== null && examEdit !== initialExam) || (stateEdit !== null && stateEdit !== initialState)
    || (optOutEdit !== null && optOutEdit !== !!me?.leaderboard_opt_out);

  const [infoOpen, setInfoOpen] = useState(false);
  const [confirm, setConfirm] = useState<(typeof RESETS)[number] | null>(null);
  const [resetting, setResetting] = useState(false);
  const resets = useQuery({ queryKey: ['me', 'resets'], queryFn: getResets });
  const statusOf = (s: ResetScope): ResetStatus | undefined => resets.data?.find((r) => r.scope === s);

  const handleSave = async () => {
    if (!dirty || saving) return;
    if (name.trim().length === 0) return setError('Name cannot be empty.');
    setError(undefined);
    setSaving(true);
    try {
      await updateMe({
        name: name.trim(),
        ...(examEdit !== null ? { exam_date: exam ? parseExamDate(exam) ?? '' : '' } : {}),
        ...(stateEdit !== null ? { state: stateEdit } : {}),
        ...(optOutEdit !== null ? { leaderboard_opt_out: optOutEdit } : {}),
      });
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: keys.me });
      show('Profile updated', 'success');
      goBack();
    } catch {
      show('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!confirm) return;
    setResetting(true);
    try {
      await resetContent(confirm.scope);
      await Promise.all([resets.refetch(), queryClient.invalidateQueries()]);
      show(`${confirm.label.replace('Reset ', '')} cleared`, 'success');
    } catch (e) {
      show(e instanceof ApiError && e.code === 'reset_cooldown' ? 'You can only reset this once every three months.' : 'Couldn’t reset. Try again.', 'error');
      void resets.refetch();
    } finally {
      setResetting(false);
      setConfirm(null);
    }
  };

  const phone = me?.phone_number ?? user?.phone_number ?? '';
  const masked = phone ? `${phone.slice(0, 3)} ${'X'.repeat(Math.max(0, phone.length - 5))}${phone.slice(-2)}` : '';

  return (
    <Screen>
      <ScreenHeader title="Edit Profile" right={<TextButton label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: space.lg, gap: space.lg }}>
          <InputField label="Full name" value={name} onChangeText={setName} error={error} />

          <View style={{ gap: space.xs }}>
            <DateField label="Exam date" value={exam} onChange={setExamEdit} />
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Shows a countdown on Home.</Text>
            {exam ? <TextButton label="Clear exam date" onPress={() => setExamEdit('')} /> : null}
          </View>

          <SelectField label="State" value={stateVal || undefined} options={STATE_OPTIONS} onChange={(v) => setStateEdit(v ?? '')} placeholder="Select your state" allowClear searchable />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Hide my name on leaderboards</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>You still see your own rank. Others see you as nobody.</Text>
            </View>
            <Switch value={optOut} onValueChange={setOptOutEdit} accessibilityLabel="Hide my name on leaderboards" />
          </View>

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space['2xs'] }]}>Phone number</Text>
            <View style={[styles.row, { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.sm }]}>
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>{masked || 'Linked to your account'}</Text>
              <Lock size={16} color={color('text/tertiary')} />
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}>Your phone number is your account ID. It can’t be changed here.</Text>
          </View>

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space['2xs'] }]}>Current course</Text>
            <View style={[styles.row, { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.sm }]}>
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>{me?.selected_course?.name ?? 'NEET UG'}</Text>
              <Lock size={16} color={color('text/tertiary')} />
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}>To change your course, go to Settings, then Account.</Text>
          </View>

          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>Reset content</Text>
              <Pressable onPress={() => setInfoOpen(true)} accessibilityRole="button" accessibilityLabel="About resetting" hitSlop={space.xs} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Info size={22} color={color('accent/default')} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {RESETS.map((r) => {
                const st = statusOf(r.scope);
                const blocked = st ? !st.can_reset : false;
                return (
                  <View key={r.scope} style={{ width: '48.5%', gap: 2 }}>
                    <SecondaryButton label={r.label} onPress={() => setConfirm(r)} disabled={blocked || resets.isPending} />
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>
                      {blocked ? `Again on ${when(st?.next_allowed_at)}` : st?.last_reset_at ? `Last reset ${when(st.last_reset_at)}` : 'Not reset yet'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="About resetting">
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          {RESETS.map((r) => (
            <View key={r.scope}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{r.label.replace('Reset ', '')}</Text>
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{r.what}</Text>
            </View>
          ))}
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Each can be reset only once every three months. A reset clears what you see in the app. Your records are kept safely on our side.</Text>
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.label ?? ''}
        message={`${confirm?.what ?? ''} You can only do this once every three months.`}
        confirmLabel="Reset"
        tone="danger"
        loading={resetting}
        onConfirm={() => void doReset()}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
