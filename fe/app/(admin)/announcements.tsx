import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Chip, ConfirmDialog, InputField, PrimaryButton, Screen, ScreenHeader, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { announcementAudience, sendAnnouncement, type Audience } from '@/src/api/adminOps';
import { ROUTES } from '@/src/navigation/routes';

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'students', label: 'Students' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'all', label: 'Everyone' },
];
const DESTINATIONS: { label: string; route: string }[] = [
  { label: 'Practice', route: ROUTES.student.practice },
  { label: 'Learn', route: ROUTES.student.learn },
  { label: 'Support', route: ROUTES.student.support },
  { label: 'Plans', route: ROUTES.student.subscriptionPlans },
];

/** A one-off message to everyone in a group. It lands in their notification inbox and as a push if they allow it. */
export default function AnnouncementsRoute() {
  const { color, type, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [audience, setAudience] = useState<Audience>('students');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const count = useQuery({ queryKey: ['admin', 'announcement-audience', audience], queryFn: () => announcementAudience(audience), retry: false });
  const people = count.data?.count;

  const send = async () => {
    setSending(true);
    try {
      const r = await sendAnnouncement({ audience, title: title.trim(), body: body.trim() || undefined, route: route || undefined });
      show(`Sent to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}`, 'success');
      setConfirm(false);
      setTitle('');
      setBody('');
      setRoute('');
    } catch (e) {
      show(e instanceof Error && e.message ? e.message : 'Couldn’t send. Try again.', 'error');
      setConfirm(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Announcement" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ gap: space.xs }}>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Send to</Text>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            {AUDIENCES.map((a) => (
              <Chip key={a.key} label={a.label} selected={audience === a.key} onPress={() => setAudience(a.key)} />
            ))}
          </View>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{people == null ? ' ' : `${people} ${people === 1 ? 'person' : 'people'} will get this.`}</Text>
        </View>
        <InputField label="Title" value={title} onChangeText={setTitle} maxLength={80} />
        <InputField label="Message (optional)" value={body} onChangeText={setBody} multiline maxLength={300} />
        {audience !== 'teachers' ? (
          <View style={{ gap: space.xs }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Tapping it opens (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              <Chip size="sm" label="Nothing" selected={!route} onPress={() => setRoute('')} />
              {DESTINATIONS.map((d) => (
                <Chip key={d.route} size="sm" label={d.label} selected={route === d.route} onPress={() => setRoute(d.route)} />
              ))}
            </View>
          </View>
        ) : null}
        <PrimaryButton label="Review and send" onPress={() => setConfirm(true)} disabled={title.trim().length < 3} />
      </ScrollView>
      <ConfirmDialog
        visible={confirm}
        title={`Send to ${people ?? 'everyone in'} ${AUDIENCES.find((a) => a.key === audience)?.label.toLowerCase()}?`}
        message={`“${title.trim()}” can’t be taken back once it’s sent.`}
        confirmLabel="Send"
        loading={sending}
        onConfirm={send}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
