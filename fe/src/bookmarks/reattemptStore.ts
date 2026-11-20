import type { BookmarkRow } from '@/src/api/bookmarks';
import type { MediaMap } from '@/src/rich/ast';

/** The list being re-attempted, handed from the Bookmarks screen to the solver without going through the URL. */
type Session = { rows: BookmarkRow[]; media: MediaMap; collectionKey: Record<string, string> };
let session: Session | null = null;
export const setReattempt = (s: Session) => { session = s; };
export const getReattempt = () => session;
export const clearReattempt = () => { session = null; };
