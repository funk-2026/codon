import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ChatCircleText, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, Chip, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listFeedback, updateFeedback, type FeedbackEntry, type FeedbackStatus } from '@/src/api/adminOps';
import { useCursorList } from '@/src/queries/useCursorList';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { shadow } from '@/src/theme/elevation';

const CHIPS: { key: FeedbackStatus; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];
const when = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** What users sent through "Give feedback". New ones first; each can be moved along with a note. */
export default function FeedbackInboxRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FeedbackStatus>('new');
  const [acting, setActing] = useState<FeedbackEntry | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const list = useCursorList<FeedbackEntry, Awaited<ReturnType<typeof listFeedback>>>(
    ['admin', 'feedback', status],
    (cursor) => listFeedback({ status, limit: 30, cursor }),
    (r) => r.items,
  );
  useRefetchOnFocus(list.load);

  const move = async (to: FeedbackStatus) => {
    if (!acting) return;
    setBusy(true);
    try {
      await updateFeedback(acting.id, to, note.trim() || undefined);
      list.setRows((rows) => rows.filter((r) => r.id !== acting.id));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] });
      setActing(null);
      show(to === 'resolved' ? 'Marked resolved' : 'Updated', 'success');
    } catch {
      show('Couldn’t update. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="User feedback" />
      <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, marginTop: space.xs }}>
        {CHIPS.map((c) => (
          <Chip key={c.key} size="sm" label={c.label} selected={status === c.key} onPress={() => setStatus(c.key)} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.xs, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {list.loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={100} radius={radius.md} />)
        ) : list.error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load feedback"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={list.load} />}
          />
        ) : list.rows.length === 0 ? (
          <EmptyState icon={<ChatCircleText size={32} color={color('text/tertiary')} />} title={status === 'new' ? 'No new feedback' : 'Nothing here'} description="Messages people send from Give feedback show up here." />
        ) : (
          <>
            {list.rows.map((f) => (
              <View key={f.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, gap: space['2xs'] }, shadow()]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type['type/overline'], { color: color('accent/default'), flex: 1, textTransform: 'uppercase' }]}>{f.category}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{when(f.created_at)}</Text>
                </View>
                <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{f.message}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>
                  {f.user_name || f.user_phone || 'Unknown'}{f.user_role ? ` · ${f.user_role}` : ''}{f.app_version ? ` · v${f.app_version}` : ''}{f.device_os ? ` · ${f.device_os}` : ''}
                </Text>
                {f.admin_note ? <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Note: {f.admin_note}</Text> : null}
                <TextButton label="Update" onPress={() => { setNote(f.admin_note ?? ''); setActing(f); }} />
              </View>
            ))}
            {list.hasMore ? <SecondaryButton label={list.more ? 'Loading…' : 'Load more'} onPress={() => void list.loadMore()} loading={list.more} /> : null}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={!!acting} onClose={() => setActing(null)} title="Update feedback" dismissable={!busy}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <InputField label="Note (only admins see it)" value={note} onChangeText={setNote} multiline maxLength={500} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><SecondaryButton label="In progress" onPress={() => void move('in_progress')} disabled={busy || acting?.status === 'in_progress'} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label="Resolved" onPress={() => void move('resolved')} loading={busy} /></View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
