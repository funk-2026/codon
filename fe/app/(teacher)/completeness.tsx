import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: completeness is now the Tags segment of the Questions tab. Kept so old links still open. */
export default function RetiredCompletenessRoute() {
  return <Redirect href={{ pathname: ROUTES.teacher.questions, params: { segment: 'tags' } }} />;
}
