import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: custom test settings are now a segment of Platform settings. Kept so old links still open. */
export default function RetiredCustomTestAdminRoute() {
  return <Redirect href={{ pathname: ROUTES.admin.platformSettings, params: { segment: 'custom' } }} />;
}
