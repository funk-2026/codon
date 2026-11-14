import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, StatusBadge, TextButton, useToast, type BadgeStatus, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, type MediaMap } from '@/src/rich';
import { ApiError } from '@/src/api/client';
import { deleteBrainHack, getTeacherBrainHack, publishBrainHack, submitBrainHack, type TeacherBrainHack } from '@/src/api/discover';
import { ROUTES } from '@/src/navigation/routes';
import { PublishSheet, SubmitForReviewSheet } from '@/src/teacher/AuthorSheets';
import { scheduleItem } from '@/src/api/teacher';
import { useSafeBack } from '@/src/navigation/useSafeBack';

const BADGE: Record<TeacherBrainHack['status'], { status: BadgeStatus; label: string }> = {
  draft: { status: 'draft', label: 'Draft' },
  pending_review: { status: 'pending', label: 'In review' },
  approved: { status: 'approved', label: 'Approved — publish it' },
  published: { status: 'published', label: 'Live' },
  rejected: { status: 'rejected', label: 'Needs changes' },
};

/**
 * Teacher: one Brain Hack and its lifecycle — edit (draft/rejected), submit,
 * publish once approved, delete. Reloads on focus so edits made in the editor show.
 */
export function BrainHackDetail() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [hack, setHack] = useState<TeacherBrainHack | null>(null);
  const [media, setMedia] = useState<MediaMap>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError(false);
    getTeacherBrainHack(String(id))
      .then((r) => {
        setHack(r.brain_hack);
        setMedia(r.media);
      })
      .catch(() => setError(true));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const [submitOpen, setSubmitOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const scheduledAt = (hack as { publish_at?: string } | null)?.publish_at ?? null;
  const schedule = async (iso: string | null) => {
    if (!hack) return;
    setBusy('publish');
    try {
      await scheduleItem('brain-hacks', hack.id, iso);
      setPublishOpen(false);
      load();
      show(iso ? 'Scheduled' : 'Schedule cancelled', 'success');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Couldn’t schedule', 'error');
    } finally {
      setBusy(null);
    }
  };
  const act = async (what: 'submit' | 'publish' | 'delete', note?: string) => {
    if (!hack) return;
    setBusy(what);
    try {
      if (what === 'submit') {
        await submitBrainHack(hack.id, note);
        setSubmitOpen(false);
        setHack({ ...hack, status: 'pending_review', rejection_reason: undefined });
        show('Submitted for review', 'success');
      } else if (what === 'publish') {
        await publishBrainHack(hack.id);
        setHack({ ...hack, status: 'published' });
        setPublishOpen(false);
        show('Published — students can read it now', 'success');
      } else {
        await deleteBrainHack(hack.id);
        show('Deleted', 'success');
        goBack();
        return;
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      show(code === 'incomplete' ? 'Title, category and text are required.' : code === 'not_approved' ? 'Only approved Brain Hacks can be published.' : code === 'locked' ? 'This can’t be changed in its current state.' : 'Something went wrong. Try again.', 'error');
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  const editable = hack?.status === 'draft' || hack?.status === 'rejected';
  const badge = hack ? BADGE[hack.status] ?? BADGE.draft : null;

  return (
    <Screen>
      <ScreenHeader title="Brain Hack" right={<>
{badge ? <StatusBadge status={badge.status} label={badge.label} /> : null}
</>} />

      {error ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load this Brain Hack"
          description="Check your connection and try again."
          action={<TextButton label="Retry" onPress={load} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ) : !hack ? (
        <View style={{ padding: space.md, gap: space.sm }}>
          <SkeletonBlock height={32} radius={radius.sm} />
          <SkeletonBlock height={200} radius={radius.md} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 160 + insets.bottom }}>
            {hack.status === 'rejected' && hack.rejection_reason ? (
              <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.md, padding: space.md }}>
                <Text style={[type['type/overline'], { color: color('semantic/danger') }]}>REVIEWER FEEDBACK</Text>
                <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 4 }]}>{hack.rejection_reason}</Text>
              </View>
            ) : null}
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>{hack.title}</Text>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
              {hack.category} · {hack.read_minutes} min read{hack.status === 'published' && hack.rating_count > 0 ? ` · ★ ${hack.rating_avg.toFixed(1)} (${hack.rating_count})` : ''}
            </Text>
            <RichContent value={hack.body} format={hack.content_format} media={media} variant="explanation" />
          </ScrollView>

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm }}>
            {editable ? (
              <>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <SecondaryButton label="Edit" onPress={() => router.push({ pathname: ROUTES.teacher.createBrainHack, params: { id: hack.id } })} style={{ flex: 1 }} />
                  <PrimaryButton label={hack.status === 'rejected' ? 'Resubmit' : 'Submit for review'} onPress={() => setSubmitOpen(true)} loading={busy === 'submit'} style={{ flex: 1 }} />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <TextButton label="Delete" onPress={() => setConfirmDelete(true)} />
                </View>
              </>
            ) : hack.status === 'approved' ? (
              <PrimaryButton label={scheduledAt ? 'Change or cancel the schedule' : 'Publish'} onPress={() => setPublishOpen(true)} loading={busy === 'publish'} />
            ) : (
              <Text style={[type['type/caption'], { color: color('text/secondary'), textAlign: 'center' }]}>
                {hack.status === 'pending_review' ? 'With a reviewer — you’ll be notified when they respond.' : 'Live for students.'}
              </Text>
            )}
          </View>
        </>
      )}

      <SubmitForReviewSheet visible={submitOpen} onClose={() => setSubmitOpen(false)} onSubmit={(n) => act('submit', n)} resubmit={hack?.status === 'rejected'} loading={busy === 'submit'} />
      <PublishSheet visible={publishOpen} onClose={() => setPublishOpen(false)} onPublishNow={() => act('publish')} onSchedule={schedule} scheduledAt={scheduledAt} loading={busy === 'publish'} />
      <BottomSheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this Brain Hack?" dismissable={busy !== 'delete'}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
          <PrimaryButton label="Delete" onPress={() => act('delete')} loading={busy === 'delete'} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
