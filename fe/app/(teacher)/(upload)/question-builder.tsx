import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, PencilSimple, Trash } from 'phosphor-react-native';
import { InputField, PrimaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Question = {
  id: string;
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const TEST_TITLE = 'Thermodynamics — Practice Set 4';

const EMPTY_FORM = { text: '', options: ['', '', '', ''] as [string, string, string, string], correct: null as 0 | 1 | 2 | 3 | null, explanation: '' };

export default function QuestionBuilderRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { prefillText } = useLocalSearchParams<{ prefillText?: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(prefillText ? { ...EMPTY_FORM, text: prefillText } : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = () => setForm(EMPTY_FORM);

  const setOption = (i: number, value: string) => {
    setForm((f) => {
      const next = [...f.options] as [string, string, string, string];
      next[i] = value;
      return { ...f, options: next };
    });
  };

  const valid = form.text.trim().length > 0 && form.options.every((o) => o.trim().length > 0) && form.correct !== null;

  const handleSubmit = () => {
    if (!valid) {
      setError('Fill in the question, all four options, and mark the correct answer before adding.');
      return;
    }
    setError(null);

    if (editingId) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingId
            ? { ...q, text: form.text, options: form.options, correct: form.correct as 0 | 1 | 2 | 3, explanation: form.explanation }
            : q
        )
      );
      setEditingId(null);
      resetForm();
      show('Changes saved', 'success');
      return;
    }

    const newQuestion: Question = {
      id: `q${Date.now()}`,
      text: form.text,
      options: form.options,
      correct: form.correct as 0 | 1 | 2 | 3,
      explanation: form.explanation,
    };
    setQuestions((prev) => [...prev, newQuestion]);
    resetForm();
    show(`Question ${questions.length + 1} added`, 'success');
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({ text: q.text, options: q.options, correct: q.correct, explanation: q.explanation });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
    setError(null);
  };

  const confirmDelete = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setDeleteConfirmId(null);
    if (editingId === id) cancelEdit();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <View style={{ marginLeft: space.sm }}>
          <Text style={[type['type/h1'], { color: color('text/primary') }]}>Questions</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {TEST_TITLE} · {questions.length} added so far
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {questions.length > 0 ? (
          <View style={{ gap: space.xs, marginBottom: space.xl }}>
            {questions.map((q, i) =>
              editingId === q.id ? (
                <View
                  key={q.id}
                  style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}
                >
                  <QuestionForm
                    form={form}
                    setForm={setForm}
                    setOption={setOption}
                    error={error}
                  />
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'center' }}>
                    <PrimaryButton label="Save Changes" onPress={handleSubmit} style={{ flex: 1 }} />
                    <TextButton label="Cancel" onPress={cancelEdit} />
                  </View>
                </View>
              ) : (
                <View key={q.id}>
                  <Pressable
                    onPress={() => startEdit(q)}
                    style={({ pressed }) => [
                      styles.qRow,
                      { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.94 : 1 },
                      shadow(),
                    ]}
                  >
                    <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>
                      Q{i + 1}. {q.text}
                    </Text>
                    <Pressable onPress={() => startEdit(q)} hitSlop={space.xs} style={{ marginLeft: space.sm }}>
                      <PencilSimple size={18} color={color('text/tertiary')} />
                    </Pressable>
                    <Pressable onPress={() => setDeleteConfirmId(q.id)} hitSlop={space.xs} style={{ marginLeft: space.sm }}>
                      <Trash size={18} color={color('text/tertiary')} />
                    </Pressable>
                  </Pressable>
                  {deleteConfirmId === q.id ? (
                    <View
                      style={[
                        styles.deleteConfirm,
                        { backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.sm, marginTop: 4 },
                      ]}
                    >
                      <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
                        Delete this question?
                      </Text>
                      <TextButton label="Yes" onPress={() => confirmDelete(q.id)} style={{ marginRight: space.sm }} />
                      <TextButton label="No" onPress={() => setDeleteConfirmId(null)} />
                    </View>
                  ) : null}
                </View>
              )
            )}
          </View>
        ) : null}

        {!editingId ? (
          <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }, shadow()]}>
            <QuestionForm
              form={form}
              setForm={setForm}
              setOption={setOption}
              error={error}
            />
            <PrimaryButton label="Add Question" onPress={handleSubmit} style={{ marginTop: space.md }} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuestionForm({
  form,
  setForm,
  setOption,
  error,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  setOption: (i: number, value: string) => void;
  error: string | null;
}) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <InputField
        label="Question Text"
        multiline
        value={form.text}
        onChangeText={(v) => setForm((f) => ({ ...f, text: v }))}
      />
      {OPTION_LABELS.map((label, i) => (
        <InputField
          key={label}
          label={`Option ${label}`}
          value={form.options[i]}
          onChangeText={(v) => setOption(i, v)}
        />
      ))}
      <View>
        <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
          Correct Answer
        </Text>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {OPTION_LABELS.map((label, i) => {
            const active = form.correct === i;
            return (
              <Pressable
                key={label}
                onPress={() => setForm((f) => ({ ...f, correct: i as 0 | 1 | 2 | 3 }))}
                style={[
                  styles.answerChip,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: active ? color('semantic/success') : color('bg/sunken'),
                  },
                ]}
              >
                <Text style={[type['type/body-m-medium'], { color: active ? color('text/inverse') : color('text/primary') }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <InputField
        label="Explanation (optional)"
        multiline
        value={form.explanation}
        onChangeText={(v) => setForm((f) => ({ ...f, explanation: v }))}
        placeholder="Shown to students after they submit."
      />
      {error ? (
        <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text>
      ) : null}
    </View>
  );
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  qRow: { flexDirection: 'row', alignItems: 'center' },
  deleteConfirm: { flexDirection: 'row', alignItems: 'center' },
  answerChip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
