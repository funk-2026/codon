import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, Camera } from 'phosphor-react-native';
import { InputField, PrimaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const CATEGORIES = ['Focus', 'Memory', 'Exam Day'] as const;
type Category = (typeof CATEGORIES)[number];

export default function CreateBrainHackRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [content, setContent] = useState('');
  const [image, setImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid = title.trim().length > 0 && !!category && content.trim().length > 0;

  const handleSaveDraft = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      show('Draft saved', 'success');
    }, 600);
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
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
          New Brain Hack
        </Text>
        <TextButton label={saving ? 'Saving…' : 'Save Draft'} onPress={handleSaveDraft} disabled={saving} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <InputField
            label="Title"
            value={title}
            onChangeText={setTitle}
            helperText="Keep it specific and practical, e.g. 'The 2-minute recall trick.'"
          />

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
              Category
            </Text>
            <View style={[styles.chipRow, { gap: space.xs }]}>
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.pill,
                        paddingHorizontal: space.md,
                        backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                        borderWidth: 1,
                        borderColor: active ? color('accent/default') : color('border/subtle'),
                      },
                    ]}
                  >
                    <Text style={[type['type/body-m-medium'], { color: active ? color('accent/default') : color('text/primary') }]}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <InputField
            label="Content"
            multiline
            value={content}
            onChangeText={setContent}
            helperText="150-400 words. Give the student one concrete thing to do, not just encouragement."
          />

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
              Image
            </Text>
            {image ? (
              <View
                style={[
                  styles.imageAttached,
                  { backgroundColor: color('bg/sunken'), borderRadius: radius.md },
                ]}
              >
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Image attached</Text>
                <TextButton label="Remove" onPress={() => setImage(false)} />
              </View>
            ) : (
              <Pressable
                onPress={() => setImage(true)}
                style={[
                  styles.attachZone,
                  { backgroundColor: color('bg/sunken'), borderRadius: radius.sm, borderColor: color('border/strong'), padding: space.md },
                ]}
              >
                <Camera size={20} color={color('text/tertiary')} />
                <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
                  Add an image (optional)
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label="Preview & Submit"
          onPress={() =>
            router.push({
              pathname: '/(teacher)/(tabs)/(content)/content-preview',
              params: {
                type: 'Brain Hack',
                draftTitle: title,
                draftCategory: category ?? '',
                draftContent: content,
              },
            })
          }
          disabled={!valid}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  attachZone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', minHeight: 56 },
  imageAttached: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
});
