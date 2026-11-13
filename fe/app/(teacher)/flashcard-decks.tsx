import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: decks are now the Decks segment of the Content tab. Kept so old links still open. */
export default function RetiredFlashcardDecksRoute() {
  return <Redirect href={{ pathname: ROUTES.teacher.content, params: { segment: 'decks' } }} />;
}
