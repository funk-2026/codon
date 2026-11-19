import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { DownloadSimple } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getReferenceDoc } from '@/src/api/reference';
import { PdfViewer } from '@/src/reference/PdfViewer';
import { downloadPdf } from '@/src/content/lecturePdf';

/** Opens one uploaded PDF in the app. Download is offered only where the document allows it (not for paper patterns). */
export default function ReferenceDocRoute() {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ['reference-doc', id], queryFn: () => getReferenceDoc(String(id)), enabled: !!id, staleTime: 60 * 60_000, retry: 1 });
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!q.data) return;
    setDownloading(true);
    try {
      await downloadPdf(q.data.url, q.data.doc.file_name || q.data.doc.title);
    } catch {
      show('Couldn’t download. Try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const doc = q.data?.doc;
  const detail = doc ? [doc.class ? `Class ${doc.class}` : null, doc.board, doc.subject, doc.year ? String(doc.year) : null].filter(Boolean).join(' · ') : '';

  return (
    <Screen>
      <ScreenHeader title={doc?.title ?? 'Document'} right={q.data?.can_download ? <TextButton label={downloading ? 'Saving…' : 'Download'} onPress={() => void download()} disabled={downloading} /> : undefined} />
      {q.isPending ? (
        <View style={{ padding: space.md }}><SkeletonBlock height={320} /></View>
      ) : q.isError || !q.data ? (
        <EmptyState
          icon={<DownloadSimple size={32} color={color('text/tertiary')} />}
          title="This document isn’t available"
          description="It may have been removed, or the connection dropped. Try again in a moment."
          action={<TextButton label="Try again" onPress={() => void q.refetch()} />}
        />
      ) : (
        <>
          {detail ? <Text style={[type['type/caption'], { color: color('text/tertiary'), paddingHorizontal: space.md, paddingBottom: space.xs }]}>{detail}</Text> : null}
          <PdfViewer url={q.data.url} />
        </>
      )}
    </Screen>
  );
}
