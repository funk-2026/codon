import { Redirect, useLocalSearchParams } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: browsing now lives inside the Practice tab. Kept so old links still open. */
export default function PracticeHierarchyRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <Redirect href={{ pathname: ROUTES.student.practice, params: kind ? { kind } : {} }} />;
}
