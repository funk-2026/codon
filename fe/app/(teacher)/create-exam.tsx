import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretRight } from 'phosphor-react-native';
import { Chip, CourseSelector, InputField, PrimaryButton, Screen, ScreenHeader, SegmentedControl, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { createTest } from '@/src/api/teacher';
import { createSeries, listSeries, type ExamKind, type ExamStyle } from '@/src/api/exams';
import { listCourses } from '@/src/api/courses';
import { defaultCourse } from '@/src/api/courseSelection';
import { ApiError } from '@/src/api/client';
import { ChapterPickerSheet, type PickedPlace } from '@/src/teacher/ChapterPickerSheet';
import { parseSchedule, scheduleError } from '@/src/teacher/schedule';
import { KIND_LABEL } from '@/src/exam/logic';
import { ROUTES } from '@/src/navigation/routes';

const KINDS: ExamKind[] = ['full', 'pyq', 'subject', 'part', 'chapter'];

/** One form for an exam: pick the style, say what it covers, and (for NEET style) whether it is a live event. */
export default function CreateExamRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const qc = useQueryClient();

  const [style, setStyle] = useState<ExamStyle>('neet');
  const [kind, setKind] = useState<ExamKind>('full');
  const [live, setLive] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [duration, setDuration] = useState('180');
  const [marksCorrect, setMarksCorrect] = useState('4');
  const [marksWrong, setMarksWrong] = useState('-1');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [late, setLate] = useState('15');
  const [rank, setRank] = useState<'everyone' | 'subscribers'>('everyone');
  const [paid, setPaid] = useState(true);
  const [year, setYear] = useState('');
  const [instructions, setInstructions] = useState('');
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [newSeries, setNewSeries] = useState('');
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const courses = useQuery({ queryKey: ['teacher', 'courses'], queryFn: () => listCourses().then((r) => r.courses), staleTime: 5 * 60_000 });
  const effectiveCourse = courseId ?? (courses.data ? defaultCourse(courses.data)?.id ?? null : null);
  const series = useQuery({ queryKey: ['teacher', 'series', effectiveCourse], queryFn: () => listSeries(effectiveCourse ?? undefined).then((r) => r.series), enabled: !!effectiveCourse });

  // A style sets sensible defaults; the teacher can change every one.
  const chooseStyle = (next: ExamStyle) => {
    setStyle(next);
    if (next === 'school') {
      setLive(false);
      setKind((k) => (k === 'full' || k === 'pyq' ? 'chapter' : k));
      setDuration((d) => (d === '180' ? '30' : d));
      setMarksCorrect('1');
      setMarksWrong('0');
    } else {
      setKind((k) => (k === 'chapter' ? 'full' : k));
      setDuration((d) => (d === '30' ? '180' : d));
      setMarksCorrect('4');
      setMarksWrong('-1');
    }
  };

  const kinds = style === 'school' ? KINDS.filter((k) => k !== 'full' && k !== 'pyq') : KINDS;
  const dur = Number(duration);
  const needsChapter = kind === 'chapter';
  const needsSubject = kind === 'subject' || kind === 'part';
  const schedErr = live ? scheduleError(date, time) : null;
  const problem =
    title.trim().length < 3 ? 'Add a title.'
    : !effectiveCourse ? 'Pick a course.'
    : !Number.isFinite(dur) || dur < 1 || dur > 600 ? 'Duration must be 1 to 600 minutes.'
    : !Number.isFinite(Number(marksCorrect)) || !Number.isFinite(Number(marksWrong)) ? 'Marks must be numbers.'
    : needsChapter && !place ? 'Choose the chapter this test covers.'
    : needsSubject && !place ? 'Choose the subject this test covers.'
    : live && schedErr ? schedErr
    : null;

  const make = async () => {
    if (problem || !effectiveCourse) return;
    setSaving(true);
    try {
      let sid = seriesId;
      if (!sid && newSeries.trim().length >= 3) {
        sid = (await createSeries({ course_id: effectiveCourse, title: newSeries.trim() })).id;
        void qc.invalidateQueries({ queryKey: ['teacher', 'series'] });
      }
      const wrong = Number(marksWrong);
      const at = live ? parseSchedule(date, time) : null;
      const t = await createTest({
        title: title.trim(),
        course_id: effectiveCourse,
        module_type: 'test_series',
        duration_minutes: dur,
        marks_per_correct: Number(marksCorrect),
        marks_per_wrong: wrong > 0 ? -wrong : wrong,
        requires_subscription: paid,
        ...(place && (needsChapter || needsSubject) ? { subject_id: place.subjectId } : {}),
        ...(place && needsChapter ? { chapter_id: place.chapterId } : {}),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        exam_style: style,
        kind,
        delivery: live ? 'live' : 'anytime',
        ...(at ? { opens_at: at.toISOString(), late_entry_minutes: Math.max(0, Math.min(240, Number(late) || 0)) } : {}),
        rank_visibility: rank,
        ...(sid ? { series_id: sid } : {}),
        ...(kind === 'pyq' && Number(year) ? { exam_year: Number(year) } : {}),
      });
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      show('Created. Now add the questions.', 'success');
      router.replace({ pathname: ROUTES.teacher.questionBuilder, params: { testId: t.id } });
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Couldn’t create the exam. Try again.', 'error');
      setSaving(false);
    }
  };

  const section = useMemo(() => ({ gap: space.md }), [space.md]);
  const label = (t: string) => <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>{t}</Text>;

  return (
    <Screen>
      <ScreenHeader title="New exam" />
      <ScrollView contentContainerStyle={[{ padding: space.md, paddingBottom: space['3xl'] + insets.bottom }, section]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View>
          {label('EXAM STYLE')}
          <SegmentedControl options={[{ key: 'neet' as const, label: 'NEET style' }, { key: 'school' as const, label: 'School' }]} value={style} onChange={chooseStyle} />
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
            {style === 'neet' ? 'The exam-hall look: a question palette, section tabs and a server timer. Can be a live event.' : 'Plain and simple: a list of questions and a timer. Always available, no live event.'}
          </Text>
        </View>

        <InputField label="Title" value={title} onChangeText={setTitle} placeholder={style === 'neet' ? 'e.g. NEET Mock 7' : 'e.g. Class 10 Physics, Unit test 2'} maxLength={200} />
        <CourseSelector courses={courses.data ?? []} value={effectiveCourse} onChange={(id) => { setCourseId(id); setSeriesId(null); setPlace(null); }} />

        <View>
          {label('WHAT IT COVERS')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {kinds.map((k) => <Chip key={k} size="sm" label={KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />)}
          </View>
          {kind === 'pyq' ? <InputField label="Year of the paper" value={year} onChangeText={(t: string) => setYear(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" containerStyle={{ marginTop: space.sm }} /> : null}
          {needsChapter || needsSubject ? (
            <Pressable onPress={() => setPickerOpen(true)} style={{ marginTop: space.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{needsChapter ? 'Chapter' : 'Subject'}</Text>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{place ? (needsChapter ? place.label : place.label.split('›')[0].trim()) : 'Choose'}</Text>
              </View>
              <CaretRight size={16} color={color('text/tertiary')} />
            </Pressable>
          ) : null}
        </View>

        <View>
          {label('SERIES (OPTIONAL)')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {(series.data ?? []).map((s) => <Chip key={s.id} size="sm" label={s.title} selected={seriesId === s.id} onPress={() => { setSeriesId(seriesId === s.id ? null : s.id); setNewSeries(''); }} />)}
          </View>
          <InputField label="Or start a new series" value={newSeries} onChangeText={(t: string) => { setNewSeries(t); if (t) setSeriesId(null); }} placeholder="e.g. NEET 2027 Mock Series" containerStyle={{ marginTop: space.sm }} />
        </View>

        {style === 'neet' ? (
          <View>
            {label('HOW IT RUNS')}
            <SegmentedControl options={[{ key: 'anytime' as const, label: 'Anytime' }, { key: 'live' as const, label: 'Live event' }]} value={live ? 'live' : 'anytime'} onChange={(k) => setLive(k === 'live')} />
            {live ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
                  Everyone starts together. Late starters get less time, never more. Results open at least 15 minutes after the exam ends; an admin can set a later time.
                </Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1.4 }}><InputField label="Date" value={date} onChangeText={setDate} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" /></View>
                  <View style={{ flex: 1 }}><InputField label="Time (24h)" value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
                </View>
                <InputField label="Late entry allowed for (minutes)" value={late} onChangeText={(t: string) => setLate(t.replace(/\D/g, ''))} keyboardType="number-pad" />
                {date && schedErr ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{schedErr}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><InputField label="Duration (min)" value={duration} onChangeText={(t: string) => setDuration(t.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><InputField label="Marks: correct" value={marksCorrect} onChangeText={setMarksCorrect} keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><InputField label="Marks: wrong" value={marksWrong} onChangeText={setMarksWrong} keyboardType="numbers-and-punctuation" /></View>
        </View>

        {style === 'neet' ? (
          <View>
            {label('WHO SEES THE RANK')}
            <SegmentedControl options={[{ key: 'everyone' as const, label: 'Everyone' }, { key: 'subscribers' as const, label: 'Subscribers only' }]} value={rank} onChange={setRank} />
          </View>
        ) : null}

        <InputField label="Instructions for students (optional)" value={instructions} onChangeText={setInstructions} multiline maxLength={4000} helperText="Shown on the instructions page before the exam starts." />

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Paid</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{paid ? 'Only subscribers can start it' : 'Free for every student'}</Text>
          </View>
          <Switch value={paid} onValueChange={setPaid} />
        </View>

        {problem && title.length > 0 ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{problem}</Text> : null}
        <PrimaryButton label="Create and add questions" onPress={() => void make()} loading={saving} disabled={!!problem} />
        <TextButton label="Cancel" onPress={() => router.back()} disabled={saving} />
      </ScrollView>
      <ChapterPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} courseId={effectiveCourse} selectedChapterId={place?.chapterId ?? null} onPick={(p) => { setPlace(p); setPickerOpen(false); }} />
    </Screen>
  );
}
