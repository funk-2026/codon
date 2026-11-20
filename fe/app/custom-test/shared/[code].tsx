import { Redirect, useLocalSearchParams } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Deep link target for codon://custom-test/shared/<code> → opens Challenges with the code ready to open. */
export default function SharedCustomTestRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: ROUTES.student.customChallenges, params: { code: String(code ?? '') } }} />;
}
