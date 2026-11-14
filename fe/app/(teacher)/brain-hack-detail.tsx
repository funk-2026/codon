import { Redirect, useLocalSearchParams } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: every item now opens the one detail screen. Kept so old links still open. */
export default function TeacherBrainHackDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={{ pathname: ROUTES.teacher.contentPreview, params: { id: id ?? '', type: 'Brain Hack' } }} />;
}
