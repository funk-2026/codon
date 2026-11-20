import { LectureRow } from '@/src/video/LectureRow';
import { Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadSimple, Trash } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock, useToast, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listDownloads, removeDownload, sizeText } from '@/src/video/downloads';
import { ROUTES } from '@/src/navigation/routes';

/** Lectures saved on this phone, playable without a connection. They stay inside the app. */
export default function DownloadsRoute() {
  const { color, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['video-downloads'], queryFn: listDownloads });
  const del = useMutation({ mutationFn: (id: string) => removeDownload(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['video-downloads'] }); show('Removed from this phone', 'success'); } });
  return (
    <Screen>
      <ScreenHeader title="Downloaded videos" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.lg} />) : q.isError ? <ErrorBanner onRetry={() => void q.refetch()} /> : (q.data ?? []).length === 0 ? (
          <EmptyState icon={<DownloadSimple size={32} color={color('text/tertiary')} />} title="Nothing downloaded yet" description="Open a lecture and tap the download button to watch it without a connection." action={<SecondaryButton label="Browse video lectures" onPress={() => router.push(ROUTES.student.learn)} />} />
        ) : (
          (q.data ?? []).map((d) => (
            <LectureRow
              key={d.id}
              title={d.title}
              detail={[d.subject, d.chapter, d.bytes ? sizeText(d.bytes) : ''].filter(Boolean).join(' · ')}
              label={`Play ${d.title}`}
              onPress={() => router.push({ pathname: ROUTES.student.downloadedVideo, params: { id: d.id } })}
              trailing={
                <Pressable onPress={() => del.mutate(d.id)} accessibilityRole="button" accessibilityLabel={`Remove ${d.title}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Trash size={20} color={color('semantic/danger')} />
                </Pressable>
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
