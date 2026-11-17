import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Cards } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useQuickPreview } from '@/src/queries/discover';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** Flash cards due today, one tap to start. Hidden when there is nothing to review. */
export function QuickReviewCard() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const quick = useQuickPreview(user?.selected_course_id, true);
  useRefetchOnFocus(() => void quick.refetch());
  const due = quick.data?.cards.filter((c) => c.state === 'due').length ?? 0;
  if (due === 0) return null;
  const mins = quick.data ? Math.max(1, Math.round(quick.data.minutes_estimate)) : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: ROUTES.student.flashcardStudy, params: { quick: '1' } })}
      accessibilityRole="button"
      accessibilityLabel={`Quick review, ${due} cards due`}
      style={({ pressed }) => [{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
        <Cards size={26} color={color('accent/default')} weight="duotone" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type['type/h3'], { color: color('text/primary') }]}>Quick review</Text>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{due} flash card{due === 1 ? '' : 's'} due{mins ? ` · about ${mins} min` : ''}</Text>
      </View>
    </Pressable>
  );
}
