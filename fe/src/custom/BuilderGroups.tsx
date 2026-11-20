import { Pressable, Text, TextInput, View } from 'react-native';
import { CheckSquare, Square } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { TypeIcon } from '@/src/bookmarks/TypeIcon';
import type { BuilderConfig } from '@/src/api/customTests';
import type { BookmarkCollection } from '@/src/api/bookmarks';
import { COUNTS, FILTER_LABEL, MINUTES, SKIP_DAYS, mixTotal, type CustomState, type FilterKey } from './logic';

type Opt<T> = { key: T; label: string; disabled?: boolean; icon?: React.ReactNode };

function Chips<T extends string | number>({ options, value, onPick, multi }: { options: Opt<T>[]; value: T | T[]; onPick: (k: T) => void; multi?: boolean }) {
  const { color, type, space, radius } = useTheme();
  const on = (k: T) => (Array.isArray(value) ? value.includes(k) : value === k);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {options.map((o) => (
        <Pressable
          key={String(o.key)}
          disabled={o.disabled}
          onPress={() => onPick(o.key)}
          accessibilityRole={multi ? 'checkbox' : 'button'}
          accessibilityState={{ selected: on(o.key), disabled: o.disabled }}
          accessibilityLabel={o.label}
          style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: o.disabled ? 0.4 : 1, backgroundColor: on(o.key) ? color('accent/tint') : color('bg/surface'), borderWidth: 1.5, borderColor: on(o.key) ? color('accent/default') : color('border/subtle') }}
        >
          {o.icon}
          {o.label ? <Text style={[type['type/body-m'], { color: on(o.key) ? color('accent/default') : color('text/secondary') }]}>{o.label}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** The builder's filter groups, one per key. Used by the three-page builder and by Create a template. */
export function BuilderGroups({
  keys, s, set, cfg, collections, askable, asked, onAsk, unset,
}: {
  keys: FilterKey[];
  s: CustomState;
  set: (p: Partial<CustomState>) => void;
  cfg: BuilderConfig | undefined;
  collections: BookmarkCollection[];
  /** In a template: every group offers "I will select this at the time of creating the test". */
  askable?: boolean;
  asked?: FilterKey[];
  onAsk?: (k: FilterKey) => void;
  /** Groups the student still has to choose (shown red). */
  unset?: FilterKey[];
}) {
  const { color, type, space, radius } = useTheme();
  const statusOk = cfg?.flags.status_filters ?? false;
  const tutorOk = cfg?.flags.tutor_mode ?? false;
  const hasTests = cfg?.sources.some((x) => x.key === 'test_series') ?? false;
  const chapters = (cfg?.subjects ?? []).filter((x) => s.subjectIds.includes(x.id)).flatMap((x) => x.chapters);

  const frame = (k: FilterKey, num: string, body: React.ReactNode) => {
    const isAsked = asked?.includes(k);
    const red = unset?.includes(k);
    return (
      <View key={k} style={{ gap: space.xs, padding: red ? space.sm : 0, borderRadius: radius.md, borderWidth: red ? 1.5 : 0, borderColor: color('semantic/danger'), backgroundColor: red ? color('semantic/danger-tint') : 'transparent' }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{num}{FILTER_LABEL[k]}</Text>
        {red ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Choose this one</Text> : null}
        {isAsked ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>You will choose this when you make the test.</Text> : body}
        {askable ? (
          <Pressable onPress={() => onAsk?.(k)} accessibilityRole="checkbox" accessibilityState={{ checked: !!isAsked }} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {isAsked ? <CheckSquare size={20} color={color('accent/default')} weight="fill" /> : <Square size={20} color={color('text/tertiary')} />}
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>I will select this at the time of creating the test</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const groups: Record<FilterKey, () => React.ReactNode> = {
    count: () => frame('count', '1. ', <Chips options={COUNTS.map((n) => ({ key: n, label: String(n) }))} value={s.count} onPick={(n) => set({ count: n })} />),
    difficulty: () => frame('difficulty', '2. ', (
      <>
        <Chips options={[{ key: 'all', label: 'All' }, { key: 'easy', label: 'Easy' }, { key: 'medium', label: 'Medium' }, { key: 'hard', label: 'Hard' }, { key: 'custom', label: 'Custom' }] as Opt<CustomState['difficulty']>[]} value={s.difficulty} onPick={(d) => set({ difficulty: d })} />
        {s.difficulty === 'custom' ? (
          <View style={{ gap: space.xs }}>
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type['type/body-m'], { color: color('text/primary'), width: 70 }]}>{d[0].toUpperCase() + d.slice(1)}</Text>
                <TextInput value={String(s.mix[d])} onChangeText={(v) => set({ mix: { ...s.mix, [d]: Math.max(0, Math.min(100, Number(v.replace(/[^0-9]/g, '')) || 0)) } })} keyboardType="number-pad" style={[type['type/body-m'], { width: 64, minHeight: 44, borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.sm, paddingHorizontal: 8, color: color('text/primary'), textAlign: 'right' }]} />
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>%</Text>
              </View>
            ))}
            <Text style={[type['type/caption'], { color: mixTotal(s.mix) === 100 ? color('semantic/success') : color('semantic/danger') }]}>Total {mixTotal(s.mix)}%. It must be 100%.</Text>
          </View>
        ) : null}
      </>
    )),
    from: () => frame('from', '3. ', (
      <>
        <Chips options={[{ key: 'all', label: 'All' }, { key: 'bookmarked', label: 'Bookmarked' }, { key: 'qbank', label: 'QBank' }, { key: 'tests', label: 'Tests', disabled: !hasTests }] as Opt<CustomState['from']>[]} value={s.from} onPick={(f) => set({ from: f })} />
        {!hasTests ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Tests are kept out of custom modules for now so exam papers stay fresh.</Text> : null}
        {s.from === 'bookmarked' ? (
          <Chips multi options={[{ key: '', label: 'All' }, ...collections.map((c) => ({ key: c.id, label: '', icon: <TypeIcon typeKey={c.key} size={20} /> }))]} value={s.bookmarkTypes.length ? s.bookmarkTypes : ['']} onPick={(id) => set({ bookmarkTypes: id === '' ? [] : toggle(s.bookmarkTypes, id) })} />
        ) : (
          <>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Show</Text>
            <Chips options={[{ key: 'all', label: 'All' }, { key: 'unattempted', label: 'Unattempted', disabled: !statusOk }, { key: 'incorrect', label: 'Incorrect', disabled: !statusOk }, { key: 'correct', label: 'Correct', disabled: !statusOk }, { key: 'skipped', label: 'Skipped', disabled: !statusOk }] as Opt<CustomState['show']>[]} value={s.show} onPick={(v) => set({ show: v })} />
          </>
        )}
      </>
    )),
    skip: () => frame('skip', '', <Chips options={SKIP_DAYS.map((d) => ({ key: d, label: d === 0 ? 'Off' : `${d} days` }))} value={s.skipDays} onPick={(d) => set({ skipDays: d })} />),
    order: () => frame('order', '', <Chips options={[{ key: 'random', label: 'Random' }, { key: 'syllabus', label: 'Syllabus' }, { key: 'easy_first', label: 'Easy-hard' }, { key: 'unattempted_first', label: 'Unattempted first' }] as Opt<CustomState['order']>[]} value={s.order} onPick={(o) => set({ order: o })} />),
    subjects: () => frame('subjects', '4. ', (
      <>
        <Chips multi options={[{ key: '', label: 'All' }, ...(cfg?.subjects ?? []).map((x) => ({ key: x.id, label: x.name }))]} value={s.subjectIds.length ? s.subjectIds : ['']} onPick={(id) => set(id === '' ? { subjectIds: [], chapterIds: [] } : { subjectIds: toggle(s.subjectIds, id), chapterIds: s.chapterIds })} />
        {chapters.length ? (
          <>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Chapters (All by default)</Text>
            <Chips multi options={[{ key: '', label: 'All chapters' }, ...chapters.map((c) => ({ key: c.id, label: c.name }))]} value={s.chapterIds.length ? s.chapterIds : ['']} onPick={(id) => set({ chapterIds: id === '' ? [] : toggle(s.chapterIds, id) })} />
          </>
        ) : null}
      </>
    )),
    tags: () => frame('tags', '5. ', (
      <>
        <Chips multi options={[{ key: '', label: 'All' }, ...(cfg?.tags ?? []).map((t) => ({ key: t.id, label: t.label }))]} value={s.tagIds.length ? s.tagIds : ['']} onPick={(id) => set({ tagIds: id === '' ? [] : toggle(s.tagIds, id) })} />
        {s.tagIds.length ? (
          <Pressable onPress={() => set({ includeUntagged: !s.includeUntagged })} accessibilityRole="checkbox" accessibilityState={{ checked: s.includeUntagged }} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {s.includeUntagged ? <CheckSquare size={20} color={color('accent/default')} weight="fill" /> : <Square size={20} color={color('text/tertiary')} />}
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Include untagged MCQs</Text>
          </Pressable>
        ) : null}
      </>
    )),
    mode: () => frame('mode', '6. ', <Chips options={[{ key: 'tutor', label: 'Regular', disabled: !tutorOk }, { key: 'exam', label: 'Exam' }] as Opt<CustomState['mode']>[]} value={s.mode} onPick={(m) => set({ mode: m })} />),
    marking: () => frame('marking', '7. ', (
      <>
        <Chips options={[{ key: 'neet', label: 'NEET +4 / −1' }, { key: 'no_negative', label: 'No negative' }, { key: 'custom', label: 'Custom' }] as Opt<CustomState['marking']>[]} value={s.marking} onPick={(m) => set({ marking: m })} />
        {s.marking === 'custom' ? (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Correct</Text>
            <TextInput value={s.custom.correct} onChangeText={(v) => set({ custom: { ...s.custom, correct: v } })} keyboardType="numbers-and-punctuation" style={[type['type/body-m'], { width: 60, minHeight: 44, borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.sm, paddingHorizontal: 8, color: color('text/primary') }]} />
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Wrong</Text>
            <TextInput value={s.custom.wrong} onChangeText={(v) => set({ custom: { ...s.custom, wrong: v } })} keyboardType="numbers-and-punctuation" style={[type['type/body-m'], { width: 60, minHeight: 44, borderWidth: 1, borderColor: color('border/subtle'), borderRadius: radius.sm, paddingHorizontal: 8, color: color('text/primary') }]} />
          </View>
        ) : null}
      </>
    )),
    timing: () => frame('timing', '', (
      <>
        <Chips options={[{ key: 'untimed', label: 'Untimed' }, { key: 'timed', label: 'Timed' }]} value={s.timed ? 'timed' : 'untimed'} onPick={(k) => set({ timed: k === 'timed' })} />
        {s.timed ? <Chips options={MINUTES.map((m) => ({ key: m, label: `${m} min` }))} value={s.minutes} onPick={(m) => set({ minutes: m })} /> : null}
      </>
    )),
  };
  return <View style={{ gap: space.md }}>{keys.map((k) => groups[k]())}</View>;
}
