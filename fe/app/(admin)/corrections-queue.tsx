import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: corrections are now the Edits segment of the Review tab. Kept so old links still open. */
export default function RetiredCorrectionsQueueRoute() {
  return <Redirect href={{ pathname: ROUTES.admin.review, params: { segment: 'edits' } }} />;
}
