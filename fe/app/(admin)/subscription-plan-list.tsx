import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: plans are now the Plans segment of the Payments tab. Kept so old links still open. */
export default function RetiredSubscriptionPlanListRoute() {
  return <Redirect href={{ pathname: ROUTES.admin.payments, params: { segment: 'plans' } }} />;
}
