import type { SubjectVideo } from '@/src/api/content';

export type LectureFilter = 'all' | 'free' | 'paused' | 'completed' | 'unattempted';
export const LECTURE_FILTERS: { key: LectureFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'unattempted', label: 'Unattempted' },
];

/** Completed beats everything; a lecture with some watch time but not finished is paused; otherwise not started. */
export const lectureState = (v: Pick<SubjectVideo, 'is_completed' | 'progress_seconds'>): 'completed' | 'paused' | 'unattempted' =>
  v.is_completed ? 'completed' : v.progress_seconds > 0 ? 'paused' : 'unattempted';

/** Free means no plan is needed. The four other states are about progress. */
export function matchesFilter(v: SubjectVideo, f: LectureFilter): boolean {
  if (f === 'all') return true;
  if (f === 'free') return !v.requires_subscription;
  return lectureState(v) === f;
}

export type ChapterGroup = { chapterId: string; name: string; videos: SubjectVideo[] };
export function groupByChapter(videos: SubjectVideo[]): ChapterGroup[] {
  const out: ChapterGroup[] = [];
  for (const v of [...videos].sort((a, b) => a.chapter_order - b.chapter_order)) {
    const g = out.find((x) => x.chapterId === v.chapter_id);
    if (g) g.videos.push(v);
    else out.push({ chapterId: v.chapter_id, name: v.chapter_name, videos: [v] });
  }
  return out;
}

/** 90 -> "1:30", 3725 -> "1:02:05"; empty when the length is not known yet. */
export function lectureLength(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** The speeds offered in the player, once each, in this order. */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.2, 1.5, 1.8, 2, 3] as const;
export const speedLabel = (s: number) => `${s}x`;
