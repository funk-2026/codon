import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { FilePdf, LockSimple } from 'phosphor-react-native';
import { SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { LecturePDFs } from '@/src/api/content';
import { downloadPdf } from './lecturePdf';
import { pdfChoices, type PdfKind4 as Kind } from './pdfChoices';

/** Student: the lecture's PDFs. Hidden entirely when nothing has been uploaded. */
export function LecturePdfDownloads({ pdfs, title }: { pdfs: LecturePDFs; title: string }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const choices = pdfChoices(pdfs);
  if (choices.length === 0) return null;

  const get = async (kind: Kind, label: string, url?: string) => {
    if (!url) return show('This PDF isn’t available right now. Try again later.', 'error');
    setBusy(kind);
    try {
      await downloadPdf(url, `${title} - ${label}.pdf`);
    } catch {
      show('Couldn’t open the PDF. Check your connection.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ marginTop: space.lg, gap: space.xs }}>
      <Text accessibilityRole="header" style={[type['type/overline'], { color: color('text/tertiary') }]}>VIEW PDF / NOTES</Text>
      {choices.map((c) => (
        <View key={c.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
          {c.locked ? <LockSimple size={26} color={color('text/tertiary')} /> : <FilePdf size={26} color={color('accent/default')} />}
          <View style={{ flex: 1 }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{c.label}</Text>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{c.sub}</Text>
          </View>
          {c.locked ? null : <SecondaryButton label="Open" onPress={() => get(c.kind, c.label, c.url)} loading={busy === c.kind} />}
        </View>
      ))}
    </View>
  );
}
