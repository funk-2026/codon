import { Redirect, useLocalSearchParams } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: browsing now lives inside the Learn tab. Kept so old links still open. */
export default function LearnHierarchyRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <Redirect href={{ pathname: ROUTES.student.learn, params: kind ? { kind } : {} }} />;
}
