import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: lessons are now part of the Content segment of the Review tab. Kept so old links still open. */
export default function RetiredModerationVideosDocsRoute() {
  return <Redirect href={{ pathname: ROUTES.admin.review, params: { segment: 'content' } }} />;
}
