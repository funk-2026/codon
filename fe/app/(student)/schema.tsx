import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CaretRight, ChartLineUp, CheckCircle, FilePdf, Funnel } from 'phosphor-react-native';
import { listReferenceDocs } from '@/src/api/reference';
import { BottomSheet, EmptyState, ErrorBanner, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SegmentedControl, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { applySchemaFilter, EMPTY_FILTER, filterActive, filterSummary, flattenSchema, progressText, shareOf, sortTopics, STATUS_LABEL, STATUS_ORDER, subjectAsked, subjectProgress, subjectStatusCounts, toggle, type SchemaFilter } from '@/src/study/logic';
import { useSchema, useSchemaSort } from '@/src/study/useSchema';
import { TopicRow } from '@/src/study/TopicRow';
import { StatusBar } from '@/src/study/StatusBar';

/** Schema home: topic order (syllabus order or most asked) and Filter live here only. Subjects with progress; with a filter on, the topic-level result. */
export default function SchemaRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const q = useSchema();
  useRefetchOnFocus(() => void q.refetch());
  const [sort, setSort] = useSchemaSort();
  const [filter, setFilter] = useState<SchemaFilter>(EMPTY_FILTER);
  const [draft, setDraft] = useState<SchemaFilter>(EMPTY_FILTER);
  const [sheet, setSheet] = useState(false);
  const pdf = useQuery({ queryKey: ['reference-docs', 'schema'], queryFn: () => listReferenceDocs({ kind: 'schema' }), staleTime: 10 * 60_000 });
  const schemaPdf = pdf.data?.[0];
  const data = q.data;
  const active = filterActive(filter);
  const totalAsked = data ? data.subjects.reduce((n, x) => n + subjectAsked(x), 0) : 0;
  const rows = data && active ? sortTopics(applySchemaFilter(flattenSchema(data), filter), sort, filter.years) : [];

  const filterBtn = (
      <Pressable onPress={() => { setDraft(filter); setSheet(true); }} accessibilityRole="button" accessibilityLabel="Filter topics" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? color('accent/default') : color('bg/sunken') }}>
        <Funnel size={20} color={active ? color('accent/on-accent') : color('text/primary')} weight={active ? 'fill' : 'regular'} />
      </Pressable>
  );

  const group = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 2, marginBottom: space.md }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: 4 }]}>{title}</Text>
      {children}
    </View>
  );
  const check = (label: string, on: boolean, onPress: () => void, indent = 0) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: indent }}>
      <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: on ? color('accent/default') : color('border/strong'), backgroundColor: on ? color('accent/default') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <CheckCircle size={14} color={color('accent/on-accent')} weight="fill" /> : null}
      </View>
      <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader title="Schema" right={filterBtn} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        <Pressable onPress={() => router.push({ pathname: ROUTES.student.analytics, params: { area: 'schema' } })} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('accent/tint'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 })}>
          <ChartLineUp size={24} color={color('accent/default')} weight="duotone" />
          <Text style={[type['type/h3'], { color: color('accent/default'), flex: 1 }]}>Check analytics</Text>
          <CaretRight size={18} color={color('accent/default')} />
        </Pressable>

        <View style={{ gap: space.xs }}>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Order topics by</Text>
          <SegmentedControl options={[{ key: 'idx' as const, label: 'Syllabus order' }, { key: 'frq' as const, label: 'Most asked' }]} value={sort} onChange={setSort} />
        </View>

        {schemaPdf && !active ? (
          <Pressable onPress={() => router.push({ pathname: ROUTES.student.referenceDoc, params: { id: schemaPdf.id } })} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.md, opacity: pressed ? 0.94 : 1 })}>
            <FilePdf size={22} color={color('accent/default')} weight="duotone" />
            <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{schemaPdf.title}</Text>
            <CaretRight size={16} color={color('text/tertiary')} />
          </Pressable>
        ) : null}

        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={90} radius={radius.lg} />)
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : !data || data.subjects.length === 0 ? (
          <EmptyState icon={<ChartLineUp size={32} color={color('text/tertiary')} />} title="Schema isn’t loaded yet" description="The topic list appears here once it has been added." />
        ) : active ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>Filter: {filterSummary(filter, data)}</Text>
              <Pressable onPress={() => setFilter(EMPTY_FILTER)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>Clear</Text>
              </Pressable>
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{rows.length} topic{rows.length === 1 ? '' : 's'}</Text>
            {rows.length === 0 ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No topics match this filter.</Text> : null}
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.md }, shadow()]}>
              {rows.map((r) => (
                <TopicRow key={r.topic.id} topic={r.topic} years={filter.years} path={`${r.subject} > ${r.chapter}`} onStatus={q.setStatus} />
              ))}
            </View>
          </>
        ) : (
          data.subjects.map((s) => {
            const p = subjectProgress(s);
            return (
              <Pressable key={s.id} onPress={() => router.push({ pathname: ROUTES.student.schemaSubject, params: { id: s.id } })} accessibilityRole="button" accessibilityLabel={`${s.name}, ${p.total} topics, ${progressText(p)}`} style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: 6, opacity: pressed ? 0.94 : 1 }, shadow()]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
                  <CaretRight size={18} color={color('text/tertiary')} />
                </View>
                <StatusBar counts={subjectStatusCounts(s)} />
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{p.confident} of {p.total} confident · {subjectAsked(s)} questions asked · {shareOf(subjectAsked(s), totalAsked)}% of all</Text>
              </Pressable>
            );
          })
        )}
        {q.saveFailed ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Couldn’t save your last change. It was put back.</Text> : null}
      </ScrollView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Filter" maxHeightPct={0.9}>
        {data ? (
          <ScrollView style={{ maxHeight: 520 }}>
            {group('YEARS', <>
              {check('All', draft.years.length === 0, () => setDraft({ ...draft, years: [] }))}
              {data.years.map((y) => check(y, draft.years.includes(y), () => setDraft({ ...draft, years: toggle(draft.years, y) })))}
            </>)}
            {group('SUBJECTS AND CHAPTERS', <>
              {check('All subjects', draft.subjectIds.length === 0, () => setDraft({ ...draft, subjectIds: [], chapterIds: [] }))}
              {data.subjects.map((s) => {
                const on = draft.subjectIds.includes(s.id);
                return (
                  <View key={s.id}>
                    {check(s.name, on, () => setDraft({ ...draft, subjectIds: toggle(draft.subjectIds, s.id), chapterIds: on ? draft.chapterIds.filter((c) => !s.chapters.some((x) => x.id === c)) : draft.chapterIds }))}
                    {on ? (
                      <>
                        {check('All chapters', !s.chapters.some((c) => draft.chapterIds.includes(c.id)), () => setDraft({ ...draft, chapterIds: draft.chapterIds.filter((c) => !s.chapters.some((x) => x.id === c)) }), 28)}
                        {s.chapters.map((c) => check(c.name, draft.chapterIds.includes(c.id), () => setDraft({ ...draft, chapterIds: toggle(draft.chapterIds, c.id) }), 28))}
                      </>
                    ) : null}
                  </View>
                );
              })}
            </>)}
            {group('STATUS', <>
              {check('All', draft.statuses.length === 0, () => setDraft({ ...draft, statuses: [] }))}
              {STATUS_ORDER.map((s) => check(STATUS_LABEL[s], draft.statuses.includes(s), () => setDraft({ ...draft, statuses: toggle(draft.statuses, s) })))}
            </>)}
          </ScrollView>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.sm }}>
          <View style={{ flex: 1 }}><SecondaryButton label="Reset" onPress={() => setDraft(EMPTY_FILTER)} /></View>
          <View style={{ flex: 2 }}><PrimaryButton label="Apply filters" onPress={() => { setFilter(draft); setSheet(false); }} /></View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
