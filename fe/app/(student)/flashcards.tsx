import { StudyLanding } from '@/src/study/StudyLanding';

/** Flashcards: opens from Home and is no longer part of the Video tab. */
export default function FlashcardDecksRoute() {
  return <StudyLanding kind="flashcards" />;
}
