import React from 'react';
import { Text, View } from 'react-native';
import { BottomSheet } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent } from '@/src/rich';

/**
 * Author help (FE-2.17): the formatting syntax (rich text v1 — see
 * contracts/rich-text-v1/grammar.md) with live examples, plus image, tagging
 * and review guidance. Examples are rendered by the real renderer, so what the
 * teacher sees here is exactly what students see.
 */
const SYNTAX: { write: string; label: string }[] = [
  { write: '**bold**  *italic*', label: 'Bold / italic' },
  { write: 'H~2~O   x^2^   Ca^2+^', label: 'Subscript / superscript (no spaces inside)' },
  { write: '$\\frac{1}{2}mv^2$', label: 'Formula (TeX between $ signs)' },
  { write: '- first point\n- second point', label: 'Bulleted list (one per line)' },
  { write: '1. step one\n2. step two', label: 'Numbered list' },
  { write: 'Costs \\$5', label: 'A literal symbol: put \\ before it' },
];

const TIPS: { title: string; body: string }[] = [
  { title: 'Images', body: 'Use the toolbar’s image button in any field. Photos are shrunk automatically; JPEG, PNG and WebP only. Add alt text describing what the image shows — screen-reader users depend on it, and it is required for question images.' },
  { title: 'Options', body: 'Keep options parallel in length and form. An option can be text, an image, or both. Exactly one option is correct.' },
  { title: 'Tag every question', body: 'Subject, chapter and difficulty are required before a test can be submitted, and only fully tagged questions can be used in students’ custom tests. Topic, source and tags make custom tests sharper.' },
  { title: 'Explanation', body: 'Explain why the answer is right and why the common wrong choice is wrong. Students read it in Review and tutor mode.' },
  { title: 'After a test is live', body: 'Fixing tags or difficulty saves immediately. Changing the wording, options or answer creates a correction that an admin approves; students keep the old version until then.' },
  { title: 'Drafts', body: 'Your typing is saved on this phone as you go. If the app closes, reopen the same question to restore it.' },
];

export function AuthorHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Writing questions" maxHeightPct={0.92}>
      <View style={{ gap: space.md }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>FORMATTING — TYPE THIS → STUDENTS SEE</Text>
        {SYNTAX.map((x) => (
          <View key={x.label} style={{ gap: space['2xs'] }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{x.label}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1, backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.xs }}>
                <Text style={[type['type/body-m'], { color: color('text/primary'), fontFamily: 'monospace' }]} selectable>{x.write}</Text>
              </View>
              <View style={{ flex: 1, borderRadius: radius.sm, padding: space.xs, borderWidth: 1, borderColor: color('border/subtle') }}>
                <RichContent value={x.write} format="rich_v1" variant="option" />
              </View>
            </View>
          </View>
        ))}
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
          The toolbar inserts these for you. Links and HTML aren’t allowed — they’re shown as plain text.
        </Text>

        {TIPS.map((t) => (
          <View key={t.title} style={{ gap: 2 }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{t.title}</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{t.body}</Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}
