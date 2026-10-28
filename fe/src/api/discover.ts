import { apiFetch, arr, qs, type Paginated } from './client';
import type { MediaMap, MediaView } from '@/src/rich/ast';

// ── Home updates (admin-curated carousel) ───────────────────────────────────
export type HomeUpdate = {
  id: string;
  title: string;
  body?: string;
  cta_label?: string;
  cta_route?: string;
  media_id?: string;
  order_index: number;
};
/** GET /home/updates — empty means HIDE the carousel (no placeholder content). */
export const getHomeUpdates = () => apiFetch<{ updates: HomeUpdate[]; media: MediaMap }>('/home/updates');

// ── Brain hacks ─────────────────────────────────────────────────────────────
export type BrainHack = {
  id: string;
  title: string;
  category: string;
  body: string;
  content_format: string;
  cover_media_id?: string;
  read_minutes: number;
  rating_avg: number;
  rating_count: number;
  my_rating?: number;
};
export const listBrainHacks = (p: { category?: string; sort?: 'rating'; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<{ brain_hacks: BrainHack[]; next_cursor: string | null; media: MediaMap }>(`/brain-hacks${qs({ ...p, cursor: p.cursor ?? undefined })}`);
export const getBrainHackCategories = () => apiFetch<{ categories: string[] | { key: string; label: string }[] }>('/brain-hacks/categories');
export const getBrainHack = (id: string) => apiFetch<{ brain_hack: BrainHack; media: MediaMap }>(`/brain-hacks/${id}`);

// Teacher authoring
export type BrainHackInput = { title: string; category: string; body: string; content_format?: 'rich_v1'; cover_media_id?: string; read_minutes?: number };
// Teacher Brain Hacks. The server wraps one hack as `{ brain_hack, media }` — unwrap it here
// (reading `.id` off the envelope was undefined, which broke "Submit for review" on new hacks).
export type TeacherBrainHack = BrainHack & { status: 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected'; rejection_reason?: string; created_at?: string };
type HackEnvelope = { brain_hack: TeacherBrainHack; media: MediaMap };
export const createBrainHackApi = (b: BrainHackInput) =>
  apiFetch<HackEnvelope>('/teacher/brain-hacks', { method: 'POST', body: JSON.stringify({ content_format: 'rich_v1', ...b }) }).then((r) => r.brain_hack);
export const updateBrainHackApi = (id: string, b: Partial<BrainHackInput>) =>
  apiFetch<HackEnvelope>(`/teacher/brain-hacks/${id}`, { method: 'PATCH', body: JSON.stringify(b) }).then((r) => r.brain_hack);
export const submitBrainHack = (id: string) => apiFetch<{ message: string }>(`/teacher/brain-hacks/${id}/submit-for-review`, { method: 'POST' });
export const listTeacherBrainHacks = () =>
  apiFetch<{ brain_hacks: TeacherBrainHack[]; media: MediaMap }>('/teacher/brain-hacks').then((r) => ({ brain_hacks: arr(r.brain_hacks), media: r.media ?? {} }));
export const getTeacherBrainHack = (id: string) =>
  apiFetch<HackEnvelope>(`/teacher/brain-hacks/${id}`).then((r) => ({ ...r, media: r.media ?? {} }));
export const publishBrainHack = (id: string) => apiFetch<{ message: string }>(`/teacher/brain-hacks/${id}/publish`, { method: 'POST' });
export const deleteBrainHack = (id: string) => apiFetch<{ message: string }>(`/teacher/brain-hacks/${id}`, { method: 'DELETE' });

// ── Flashcards ──────────────────────────────────────────────────────────────
export type Deck = {
  id: string;
  title: string;
  description: string;
  course_id: string;
  subject_id?: string;
  chapter_id?: string;
  requires_subscription: boolean;
  card_count: number;
  rating_avg: number;
  rating_count: number;
  locked?: boolean;
  progress?: { new: number; due: number; learned: number };
};
export type Flashcard = { id: string; deck_id: string; front: string; back: string; content_format: string; position: number };
export type StudyCard = Flashcard & { state: 'due' | 'new' };
export type ReviewResult = 'again' | 'hard' | 'good' | 'easy';

export const listDecks = (p: { course_id?: string; subject_id?: string; chapter_id?: string; q?: string; sort?: 'rating'; cursor?: string | null } = {}) =>
  apiFetch<{ decks: Deck[]; next_cursor: string | null }>(`/flashcards/decks${qs({ ...p, cursor: p.cursor ?? undefined })}`);
/** The deck's spaced-repetition queue: due cards first, then new. */
export const studyDeck = (id: string, limit = 20) => apiFetch<{ deck: Deck; cards: StudyCard[]; media: MediaMap }>(`/flashcards/decks/${id}/study${qs({ limit })}`);
export const quickCards = (p: { course_id?: string; chapter_id?: string; limit?: number } = {}) =>
  apiFetch<{ cards: StudyCard[]; media: MediaMap; minutes_estimate: number }>(`/flashcards/quick${qs(p)}`);
export const reviewCard = (id: string, result: ReviewResult) =>
  apiFetch<unknown>(`/flashcards/cards/${id}/review`, { method: 'POST', body: JSON.stringify({ result }) });

// ── Explore ─────────────────────────────────────────────────────────────────
export type ExploreContinue = { attempt_id: string; test_id: string; title: string; module: string; expires_at?: string | null };
export type ExploreRecommendation = { code: string; title: string; reason: string; patch: Record<string, unknown> };
export type ExploreQbank = { chapter_id: string; chapter: string; subject: string; questions: number };
export type ExplorePreset = { id: string; title: string; description?: string; blueprint: Record<string, unknown> };

/** GET /explore — discovery for the student's course. Every list may be empty. */
export type Explore = {
  continue: ExploreContinue[];
  recommended: ExploreRecommendation[];
  /** Chapters with the most custom-test-eligible questions (max 8). */
  qbank: ExploreQbank[];
  /** Active builder presets (empty when custom tests are off). */
  presets: ExplorePreset[];
  flashcard_decks: { newest: Deck[]; top_rated: Deck[] };
  brain_hacks: BrainHack[];
  media: MediaMap;
};
export const getExplore = (courseId: string) =>
  apiFetch<Explore>(`/explore${qs({ course_id: courseId })}`).then((r) => ({
    continue: arr(r.continue),
    recommended: arr(r.recommended),
    qbank: arr(r.qbank),
    presets: arr(r.presets),
    flashcard_decks: { newest: arr(r.flashcard_decks?.newest), top_rated: arr(r.flashcard_decks?.top_rated) },
    brain_hacks: arr(r.brain_hacks),
    media: r.media ?? {},
  }));

// ── Notifications & push ────────────────────────────────────────────────────
export type NotificationItem = { id: string; type: string; title: string; body: string; data?: Record<string, unknown>; read_at?: string | null; pushed_at?: string | null; created_at: string };
export const listNotifications = (p: { unread?: boolean; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<Paginated<NotificationItem> & { unread_count: number }>(`/me/notifications${qs({ ...p, cursor: p.cursor ?? undefined })}`);
export const markNotificationsRead = (ids?: string[]) => apiFetch<{ message: string }>('/me/notifications/read', { method: 'POST', body: JSON.stringify(ids ? { ids } : { all: true }) });

export const registerPushToken = (token: string, platform: 'ios' | 'android', deviceId?: string) => apiFetch<unknown>('/me/push-tokens', { method: 'POST', body: JSON.stringify({ token, platform, device_id: deviceId }) });
export const removePushToken = (token: string) => apiFetch<unknown>(`/me/push-tokens/${encodeURIComponent(token)}`, { method: 'DELETE' });

export type NotificationPrefs = { push_enabled: boolean; streak_nudges: boolean; report_updates: boolean };
export const getNotificationPrefs = () => apiFetch<NotificationPrefs>('/me/notification-preferences');
export const putNotificationPrefs = (p: Partial<NotificationPrefs>) => apiFetch<NotificationPrefs>('/me/notification-preferences', { method: 'PUT', body: JSON.stringify(p) });

// ── Video notes ─────────────────────────────────────────────────────────────
export type VideoNote = { id: string; content_item_id: string; timestamp_seconds: number; body: string; created_at: string; updated_at?: string };
/** My notes on one video, ordered by timestamp. Bodies are rich text v1 (formatting, no images). */
export const listVideoNotes = (contentId: string) =>
  apiFetch<{ notes: VideoNote[] }>(`/me/video-notes${qs({ content_id: contentId })}`).then((r) => ({ notes: arr(r.notes) }));
export const createVideoNote = (b: { content_id: string; timestamp_seconds: number; body: string }) => apiFetch<VideoNote>('/me/video-notes', { method: 'POST', body: JSON.stringify(b) });
export const updateVideoNote = (id: string, body: string) => apiFetch<VideoNote>(`/me/video-notes/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
export const deleteVideoNote = (id: string) => apiFetch<{ message: string }>(`/me/video-notes/${id}`, { method: 'DELETE' });

export type { MediaView };
