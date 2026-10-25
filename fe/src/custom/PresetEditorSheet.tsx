import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { BottomSheet, InputField, PrimaryButton, SelectField, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { listCourses } from '@/src/api/courses';
import { createPreset, updatePreset, type AdminPreset } from '@/src/api/adminCustom';
import type { Blueprint, Difficulty, MarkingPreset, OrderKey, StrategyKey } from '@/src/api/customTests';
import { summarizeBlueprint, withDefaults } from './blueprint';
import { ChipGroup, Stepper } from './ui';
import { ORDER_LABEL, STRATEGY_LABEL } from './labels';

const STRATEGIES: StrategyKey[] = ['random', 'unseen_first', 'weak_first', 'spaced'];
const ORDERS: OrderKey[] = ['random', 'syllabus', 'easy_first', 'hard_first'];
const DIFFS: { key: Difficulty; label: string }[] = [{ key: 'easy', label: 'Easy' }, { key: 'medium', label: 'Medium' }, { key: 'hard', label: 'Hard' }];
const MARKING: { key: MarkingPreset; label: string }[] = [{ key: 'neet', label: 'NEET (+4 / −1)' }, { key: 'no_negative', label: 'No negative' }];

/**
 * Admin: create / edit a builder preset (FE-5.12). Covers the fields presets
 * use — count, timing, marking, strategy, order, difficulty, PYQ-only — with a
 * live plain-English preview. The server re-validates the blueprint.
 */
export function PresetEditorSheet({
  visible, preset, onClose, onSaved,
}: { visible: boolean; preset: AdminPreset | null; onClose: () => void; onSaved: (p: AdminPreset) => void }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [courses, setCourses] = useState<{ value: string; label: string }[]>([]);
  const [courseId, setCourseId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    listCourses()
      .then((r) => {
        const opts = (r.courses ?? []).map((c) => ({ value: c.id, label: c.name }));
        setCourses(opts);
        const cid = preset?.course_id ?? opts[0]?.value;
        setCourseId(cid);
        setBp(withDefaults(cid ?? '', preset?.blueprint ?? { count: 20 }));
      })
      .catch(() => setBp(withDefaults(preset?.course_id ?? '', preset?.blueprint ?? { count: 20 })));
    setTitle(preset?.title ?? '');
    setDescription(preset?.description ?? '');
  }, [visible, preset]);

  const patch = (p: Partial<Blueprint>) => setBp((b) => (b ? { ...b, ...p } : b));
  const filters = bp?.filters ?? {};
  const pyqOnly = (filters.source_types ?? []).length === 1 && filters.source_types![0] === 'pyq';

  const save = async () => {
    if (!bp || !courseId || !title.trim()) return;
    setBusy(true);
    const blueprint = { ...bp, course_id: courseId };
    try {
      const saved = preset
        ? await updatePreset(preset.id, { title: title.trim(), description: description.trim(), blueprint })
        : await createPreset({ course_id: courseId, title: title.trim(), description: description.trim(), blueprint });
      onSaved(saved);
      show(preset ? 'Preset saved' : 'Preset created — it appears in the builder', 'success');
      onClose();
    } catch (e) {
      const issues = e instanceof ApiError && Array.isArray(e.details) ? (e.details as { message: string }[]).map((i) => i.message).join('; ') : '';
      show(issues ? `Invalid preset: ${issues}` : 'Couldn’t save the preset. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={preset ? 'Edit preset' : 'New preset'} dismissable={!busy} maxHeightPct={0.92}>
      {bp ? (
        <View style={{ gap: space.md }}>
          <InputField label="Title" value={title} onChangeText={setTitle} maxLength={60} />
          <InputField label="Description (optional)" value={description} onChangeText={setDescription} maxLength={160} />
          <SelectField label="Course" value={courseId} options={courses} onChange={setCourseId} disabled={!!preset} disabledHint={preset ? 'A preset’s course can’t be changed' : undefined} />

          <Stepper label="Questions" value={bp.count} min={5} max={180} onChange={(n) => patch({ count: n })} presets={[10, 20, 45, 90]} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Timed</Text>
            <Switch
              value={!!bp.timing.timed}
              onValueChange={(v) => patch({ timing: v ? { timed: true, duration_minutes: bp.timing.duration_minutes || bp.count } : { timed: false } })}
              accessibilityLabel="Timed"
            />
          </View>
          {bp.timing.timed ? (
            <Stepper label="Duration" unit="min" value={bp.timing.duration_minutes ?? bp.count} min={5} max={240} step={5} onChange={(n) => patch({ timing: { timed: true, duration_minutes: n } })} />
          ) : null}

          <Field label="Marking">
            <ChipGroup single options={MARKING} selected={[bp.marking?.preset === 'no_negative' ? 'no_negative' : 'neet']} onToggle={(k) => patch({ marking: { preset: k } })} />
          </Field>
          <Field label="Question selection">
            <ChipGroup single options={STRATEGIES.map((k) => ({ key: k, label: STRATEGY_LABEL[k] }))} selected={[bp.strategy ?? 'random']} onToggle={(k) => patch({ strategy: k })} />
          </Field>
          <Field label="Order">
            <ChipGroup single options={ORDERS.map((k) => ({ key: k, label: ORDER_LABEL[k] }))} selected={[bp.order ?? 'random']} onToggle={(k) => patch({ order: k })} />
          </Field>
          <Field label="Difficulty (none = all)">
            <ChipGroup
              options={DIFFS}
              selected={filters.difficulty ?? []}
              onToggle={(k) => {
                const cur = filters.difficulty ?? [];
                const next = cur.includes(k) ? cur.filter((d) => d !== k) : [...cur, k];
                patch({ filters: { ...filters, difficulty: next.length ? next : undefined } });
              }}
            />
          </Field>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Previous-year questions only</Text>
            <Switch value={pyqOnly} onValueChange={(v) => patch({ filters: { ...filters, source_types: v ? ['pyq'] : undefined } })} accessibilityLabel="Previous-year questions only" />
          </View>

          <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.sm }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>STUDENTS WILL SEE</Text>
            <Text style={[type['type/body-m'], { color: color('text/primary'), marginTop: 2 }]}>{summarizeBlueprint(bp)}</Text>
          </View>

          <PrimaryButton label={preset ? 'Save preset' : 'Create preset'} onPress={save} loading={busy} disabled={!title.trim() || !courseId} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { color, type, space } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{label}</Text>
      {children}
    </View>
  );
}
