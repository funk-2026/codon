import { Redirect } from 'expo-router';
import { ROUTES } from '@/src/navigation/routes';

/** Retired screen: flashcard decks now live in the Learn tab. Kept so old links still open. */
export default function FlashcardDecksRoute() {
  return <Redirect href={{ pathname: ROUTES.student.learn, params: { kind: 'flashcards' } }} />;
}
