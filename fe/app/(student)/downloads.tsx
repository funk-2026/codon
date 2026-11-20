import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadSimple, Play, Trash } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listDownloads, removeDownload, sizeText } from '@/src/video/downloads';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** Lectures saved on this phone, playable without a connection. They stay inside the app. */
export default function DownloadsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['video-downloads'], queryFn: listDownloads });
  const del = useMutation({ mutationFn: (id: string) => removeDownload(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['video-downloads'] }); show('Removed from this phone', 'success'); } });
  return (
    <Screen>
      <ScreenHeader title="Downloaded videos" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? <SkeletonBlock height={72} radius={radius.lg} /> : (q.data ?? []).length === 0 ? (
          <EmptyState icon={<DownloadSimple size={32} color={color('text/tertiary')} />} title="Nothing downloaded yet" description="Open a lecture and tap the download button to watch it without a connection." />
        ) : (
          (q.data ?? []).map((d) => (
            <View key={d.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }, shadow()]}>
              <Pressable onPress={() => router.push({ pathname: ROUTES.student.downloadedVideo, params: { id: d.id } })} accessibilityRole="button" accessibilityLabel={`Play ${d.title}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 }}>
                <Play size={26} color={color('accent/default')} weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{d.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{[d.subject, d.chapter, d.bytes ? sizeText(d.bytes) : ''].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => del.mutate(d.id)} accessibilityRole="button" accessibilityLabel={`Remove ${d.title}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Trash size={20} color={color('semantic/danger')} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
