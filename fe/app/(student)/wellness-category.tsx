import { Redirect, useLocalSearchParams } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: categories are now a segmented control on the Support tab. Kept so old links still open. */
export default function WellnessCategoryRoute() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <Redirect href={{ pathname: ROUTES.student.support, params: category ? { category } : {} }} />;
}
