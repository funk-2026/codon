import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: KYC review is now the KYC segment of the Review tab. Kept so old links still open. */
export default function RetiredKycQueueRoute() {
  return <Redirect href={{ pathname: ROUTES.admin.review, params: { segment: 'kyc' } }} />;
}
