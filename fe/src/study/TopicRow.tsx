import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ROUTES } from '@/src/navigation/routes';
import type { SchemaStatus, SchemaTopic } from '@/src/api/study';
import { StatusDropdown } from './StatusDropdown';
import { STATUS_LABEL, STATUS_TONE, topicCount } from './logic';

/** Status dropdown, topic name, the count in brackets, an arrow. Used in the chapter accordion and in the filtered list. */
export function TopicRow({ topic, years = [], path, onStatus }: { topic: SchemaTopic; years?: string[]; path?: string; onStatus: (id: string, s: SchemaStatus) => void }) {
  const { color, type, space, radius } = useTheme();
  const n = topicCount(topic, years);
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingVertical: 4 }}>
      <StatusDropdown status={topic.status} onChange={(s) => onStatus(topic.id, s)} />
      <Pressable onPress={() => router.push({ pathname: ROUTES.student.schemaTopic, params: { id: topic.id, ...(years.length ? { years: years.join('|') } : {}) } })} accessibilityRole="button" accessibilityLabel={`${topic.name}, ${topicCount(topic, years)} questions`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{topic.name}</Text>
          <Text style={[type['type/caption'], { color: color(STATUS_TONE[topic.status]) }]}>{STATUS_LABEL[topic.status]}</Text>
          {path ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{path}</Text> : null}
        </View>
        <View style={{ minWidth: 40, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: color('bg/surface'), borderWidth: 1, borderColor: color('border/subtle') }}>
          <Text style={[type['type/caption'], { color: color(n > 0 ? 'text/primary' : 'text/tertiary'), fontWeight: '600' }]}>{n}</Text>
        </View>
        <CaretRight size={16} color={color('text/tertiary')} />
      </Pressable>
    </View>
  );
}
