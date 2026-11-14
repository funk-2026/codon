// Where a teacher's notification opens. Pure (no React Native) so it is unit-tested.
import { ROUTES } from '@/src/navigation/routes';

const idOf = (data: unknown): string | null => {
  const id = (data as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
};

/** Review outcomes and hand-overs open the item; anything else opens nothing. */
export function teacherRouteFor(type: string | undefined, data: unknown): string | null {
  const id = idOf(data);
  if (!id || !type) return null;
  if (type.startsWith('brain_hack_')) return `${ROUTES.teacher.contentPreview}?type=Brain%20Hack&id=${id}`;
  if (type.startsWith('deck_')) return `${ROUTES.teacher.flashcardDeck}?id=${id}`;
  if (type.startsWith('test_')) return `${ROUTES.teacher.contentPreview}?type=Test&id=${id}`;
  if (type.startsWith('content_')) return `${ROUTES.teacher.contentPreview}?id=${id}`;
  return null;
}
