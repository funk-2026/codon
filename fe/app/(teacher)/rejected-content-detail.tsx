import { Redirect, useLocalSearchParams } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: the reviewer feedback now sits at the top of the one detail screen. Kept so old links still open. */
export default function RejectedContentDetailRoute() {
  const { id, type } = useLocalSearchParams<{ id?: string; type?: string }>();
  return <Redirect href={{ pathname: ROUTES.teacher.contentPreview, params: { id: id ?? '', type: type ?? 'Test' } }} />;
}
