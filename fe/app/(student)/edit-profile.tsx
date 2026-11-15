import { useState } from 'react';
import { Switch, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, CaretRight } from 'phosphor-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/src/queries/profile';
import { keys } from '@/src/queries/keys';
import { formatExamDate, parseExamDate } from '@/src/profile/examDate';
import { InputField, TextButton, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { updateMe } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { useSafeBack } from '@/src/navigation/useSafeBack';

export default function EditProfileRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const { user, refreshUser } = useAuth();
  
  const meQuery = useMe();
  const queryClient = useQueryClient();
  const initialName = user?.name || '';
  const initialExam = formatExamDate(meQuery.data?.user?.exam_date);
  const [name, setName] = useState(initialName);
  // Edited text is kept apart from the saved value, so a late-arriving profile doesn't overwrite typing.
  const [examEdit, setExamEdit] = useState<string | null>(null);
  const [optOutEdit, setOptOutEdit] = useState<boolean | null>(null);
  const optOut = optOutEdit ?? !!meQuery.data?.user?.leaderboard_opt_out;
  const examText = examEdit ?? initialExam;
  const examIso = examText.trim() === '' ? '' : parseExamDate(examText);
  const examError = examIso === null ? 'Use the format DD/MM/YYYY, for example 03/05/2027.' : undefined;
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== initialName || (examEdit !== null && examEdit.trim() !== initialExam) || (optOutEdit !== null && optOutEdit !== !!meQuery.data?.user?.leaderboard_opt_out);

  const handleSave = async () => {
    if (!dirty || saving) return;
    if (name.trim().length === 0) {
      setError('Name cannot be empty.');
      return;
    }
    if (examError) return;
    setError(undefined);
    setSaving(true);
    try {
      await updateMe({ name: name.trim(), ...(examEdit !== null ? { exam_date: examIso ?? '' } : {}), ...(optOutEdit !== null ? { leaderboard_opt_out: optOutEdit } : {}) });
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: keys.me });
      show('Profile updated', 'success');
      goBack();
    } catch (err) {
      show('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Edit Profile" right={<>
<TextButton
          label={saving ? 'Saving…' : 'Save'}
          onPress={handleSave}
          disabled={!dirty || saving}
        />
</>} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: space['3xl'] + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <View style={{ position: 'relative' }}>
            <View
              style={[
                styles.avatar,
                { width: 96, height: 96, borderRadius: 48, backgroundColor: color('accent/tint') },
              ]}
            >
              <Text style={[type['type/display'], { color: color('accent/default'), fontSize: 32 }]}>
                {((user?.name || 'A').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || 'A').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <InputField label="Full Name" value={name} onChangeText={setName} error={error} />

          <InputField
            label="Exam date (optional)"
            value={examText}
            onChangeText={setExamEdit}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={examEdit !== null ? examError : undefined}
            helperText="Shows a countdown on Home. Leave it blank to clear it."
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Hide my name on leaderboards</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>You still see your own rank. Others see you as nobody.</Text>
            </View>
            <Switch value={optOut} onValueChange={setOptOutEdit} />
          </View>

          <View>
            <Text
              style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space['2xs'] }]}
            >
              Phone Number
            </Text>
            <View
              style={[
                styles.readOnlyRow,
                {
                  backgroundColor: color('bg/sunken'),
                  borderRadius: radius.sm,
                  paddingHorizontal: space.sm,
                  paddingVertical: space.sm,
                },
              ]}
            >
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>
                +91 98XXXXXX10
              </Text>
              <Lock size={16} color={color('text/tertiary')} />
            </View>
            <Text
              style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}
            >
              Your phone number is your account ID and can&apos;t be changed here.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push({ pathname: ROUTES.auth.profileSetup as any, params: { edit: '1' } })}
            style={({ pressed }) => [
              styles.readOnlyRow,
              {
                backgroundColor: color('bg/sunken'),
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: space.sm,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>
              Course — NEET UG
            </Text>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center' },
});
