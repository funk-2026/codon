import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: reports are now the Reports segment of the Review tab. Kept so old links still open. */
export default function RetiredReportsQueueRoute() {
  return <Redirect href={{ pathname: ROUTES.admin.review, params: { segment: 'reports' } }} />;
}
