import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: adding subjects and chapters now lives in Course structure. Kept so old links still open. */
export default function RetiredManageSubjectsRoute() {
  return <Redirect href={ROUTES.admin.courseStructure} />;
}
