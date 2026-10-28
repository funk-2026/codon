import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { searchTags, type TagRow } from '@/src/api/questionBank';

const MAX_TAGS = 12;

/** Free-form tags with autocomplete from existing canonical tags (aliases resolve server-side). */
export function TagInput({ value, onChange, label = 'Tags', suggest = true }: { value: string[]; onChange: (v: string[]) => void; label?: string; suggest?: boolean }) {
  const { color, type, space, radius } = useTheme();
  const [text, setText] = useState('');
  const [hits, setHits] = useState<TagRow[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim().replace(/^#/, '');
    if (!suggest || q.length < 1) return setHits([]);
    const my = ++seq.current;
    const t = setTimeout(() => {
      searchTags(q).then((r) => my === seq.current && setHits(r.tags.filter((h) => !value.some((v) => v.toLowerCase() === h.label.toLowerCase())))).catch(() => my === seq.current && setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [text, value]);

  const add = (label: string) => {
    const l = label.trim().replace(/^#/, '').slice(0, 40);
    if (!l || value.length >= MAX_TAGS || value.some((v) => v.toLowerCase() === l.toLowerCase())) return setText('');
    onChange([...value, l]);
    setText('');
    setHits([]);
  };

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {value.map((t) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingLeft: space.sm, paddingRight: 4, minHeight: 32 }}>
            <Text style={[type['type/caption'], { color: color('accent/default') }]}>#{t}</Text>
            <Pressable onPress={() => onChange(value.filter((x) => x !== t))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove tag ${t}`} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} color={color('accent/default')} />
            </Pressable>
          </View>
        ))}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => add(text)}
        placeholder={value.length >= MAX_TAGS ? 'Tag limit reached' : 'Add a tag (e.g. genetics)…'}
        placeholderTextColor={color('text/tertiary')}
        editable={value.length < MAX_TAGS}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel={`${label}: add a tag`}
        style={[type['type/body-m'], { minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: color('border/subtle'), backgroundColor: color('bg/surface'), paddingHorizontal: space.md, color: color('text/primary') }]}
      />
      {hits.length > 0 || text.trim() ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {hits.slice(0, 6).map((h) => (
            <Pressable key={h.id} onPress={() => add(h.label)} accessibilityRole="button" style={{ minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: color('bg/sunken'), justifyContent: 'center' }}>
              <Text style={[type['type/caption'], { color: color('text/primary') }]}>#{h.label} · {h.uses}</Text>
            </Pressable>
          ))}
          {text.trim() && !hits.some((h) => h.label.toLowerCase() === text.trim().toLowerCase()) ? (
            <Pressable onPress={() => add(text)} accessibilityRole="button" style={{ minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: color('accent/default'), justifyContent: 'center' }}>
              <Text style={[type['type/caption'], { color: color('accent/default') }]}>Add “{text.trim()}”</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
