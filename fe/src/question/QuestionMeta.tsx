import { Share, Text, View } from 'react-native';
import { BookOpen } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { mcqId, referenceLines, tagChip } from './logic';

/** The tag chip (like #ImageBased) and the MCQ ID, under the question text. A question with no tag shows just the ID. */
export function QuestionTagRow({ tags, questionId }: { tags?: string[]; questionId: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginTop: space.sm }}>
      {(tags ?? []).map((t) => (
        <View key={t} style={{ backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
          <Text style={[type['type/caption'], { color: color('accent/default') }]}>{tagChip(t)}</Text>
        </View>
      ))}
      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{mcqId(questionId)}</Text>
    </View>
  );
}

/** The book, edition and pages that explain the answer. Hidden when the question names no book. */
export function ReferencesBlock({ book, edition, pages }: { book?: string | null; edition?: string | null; pages?: string | null }) {
  const { color, type, space, radius } = useTheme();
  const ref = referenceLines({ book, edition, pages });
  if (!ref) return null;
  return (
    <View style={{ marginTop: space.md, gap: space.xs }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>REFERENCES</Text>
      <View accessible accessibilityLabel={`${ref.title}. ${ref.pages ?? ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.sm }}>
        <View style={{ width: 36, height: 44, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
          <BookOpen size={20} color={color('accent/default')} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{ref.title}</Text>
          {ref.pages ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{ref.pages}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/** Sends the question out of the app through the phone's share sheet. */
export const shareQuestion = (message: string) => Share.share({ message }).catch(() => undefined);
