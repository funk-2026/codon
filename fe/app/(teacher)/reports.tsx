import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: reports are now the Reports segment of the Questions tab. Kept so old links still open. */
export default function RetiredReportsRoute() {
  return <Redirect href={{ pathname: ROUTES.teacher.questions, params: { segment: 'reports' } }} />;
}
