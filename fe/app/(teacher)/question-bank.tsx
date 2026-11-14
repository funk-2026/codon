import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: the question bank is now the Bank segment of the Questions tab. Kept so old links still open. */
export default function RetiredQuestionBankRoute() {
  return <Redirect href={{ pathname: ROUTES.teacher.questions, params: { segment: 'bank' } }} />;
}
