import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Folder, MagnifyingGlass } from 'phosphor-react-native';
import { BottomSheet } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getQBankOverview } from '@/src/api/qbank';
import { ROUTES } from '@/src/navigation/routes';
import { searchQBank } from './logic';

/** Search over QBank subjects and chapters only. A subject opens its chapter list; a chapter opens its page. */
export function QBankSearchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const overview = useQuery({ queryKey: ['qbank-overview', user?.selected_course_id], queryFn: () => getQBankOverview(user?.selected_course_id ?? undefined), enabled: visible });
  const hits = searchQBank(overview.data ?? [], q);
  const close = () => { setQ(''); onClose(); };
  return (
    <BottomSheet visible={visible} onClose={close} title="Search QBank" maxHeightPct={0.85}>
      <View style={{ gap: space.sm, paddingBottom: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color('border/subtle'), paddingHorizontal: space.sm }}>
          <MagnifyingGlass size={18} color={color('text/tertiary')} />
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Subject or chapter" placeholderTextColor={color('text/tertiary')} style={[type['type/body-m'], { flex: 1, color: color('text/primary'), minHeight: 44 }]} />
        </View>
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          {q.trim() && hits.length === 0 ? <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Nothing matches “{q.trim()}”.</Text> : null}
          {hits.map((h) => (
            <Pressable
              key={h.key}
              onPress={() => { close(); router.push(h.kind === 'subject' ? { pathname: ROUTES.student.qbankSubject, params: { subjectId: h.subjectId } } : { pathname: ROUTES.student.qbankChapter, params: { testId: h.testId } }); }}
              accessibilityRole="button"
              style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Folder size={22} color={color('accent/default')} weight={h.kind === 'subject' ? 'duotone' : 'regular'} />
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{h.title}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{h.sub}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
