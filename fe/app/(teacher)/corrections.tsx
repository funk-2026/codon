import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: corrections are now the Edits segment of the Questions tab. Kept so old links still open. */
export default function RetiredCorrectionsRoute() {
  return <Redirect href={{ pathname: ROUTES.teacher.questions, params: { segment: 'corrections' } }} />;
}
