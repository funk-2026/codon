import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { FilePdf, LockSimple } from 'phosphor-react-native';
import { SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { LecturePDFs } from '@/src/api/content';
import { downloadPdf } from './lecturePdf';

/**
 * Student: a lecture's PDFs (video player). Notes download any time; the
 * annotated PDF shows as locked until the lecture has been watched (~90 %),
 * then becomes downloadable — the server decides, this only reflects it.
 */
export function LecturePdfDownloads({ pdfs, title }: { pdfs: LecturePDFs; title: string }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const get = async (which: 'notes' | 'annotated', url?: string) => {
    if (!url) return show('This PDF isn’t available right now. Try again later.', 'error');
    setBusy(which);
    try {
      await downloadPdf(url, `${title} - ${which === 'notes' ? 'Notes' : 'Annotated notes'}.pdf`);
    } catch {
      show('Couldn’t download the PDF. Check your connection.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const row = (icon: React.ReactNode, name: string, sub: string, action?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{name}</Text>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{sub}</Text>
      </View>
      {action}
    </View>
  );

  const download = (which: 'notes' | 'annotated', url?: string) => (
    <SecondaryButton label="Download" onPress={() => get(which, url)} loading={busy === which} />
  );

  return (
    <View style={{ marginTop: space.lg, gap: space.xs }}>
      <Text accessibilityRole="header" style={[type['type/overline'], { color: color('text/tertiary') }]}>LECTURE PDFS</Text>
      {pdfs.has_notes_pdf
        ? row(<FilePdf size={26} color={color('accent/default')} />, 'Notes', 'The lecture notes', download('notes', pdfs.notes_pdf_url))
        : null}
      {pdfs.has_annotated_pdf
        ? pdfs.annotated_pdf_locked
          ? row(<LockSimple size={26} color={color('text/tertiary')} />, 'Annotated notes', 'Unlocks after you watch the lecture')
          : row(<FilePdf size={26} color={color('accent/default')} />, 'Annotated notes', 'Everything written during the lecture', download('annotated', pdfs.annotated_pdf_url))
        : null}
    </View>
  );
}
