/**
 * One place for every query key. Keys are arrays from general to specific, so
 * `invalidateQueries({ queryKey: keys.teacher.all })` refreshes a whole area.
 */
export const keys = {
  me: ['me'] as const,
  teacher: {
    all: ['teacher'] as const,
    contentCount: () => ['teacher', 'content-count'] as const,
  },
  devices: ['devices'] as const,
  attempts: ['attempts'] as const,
  admin: {
    summary: ['admin', 'summary'] as const,
    users: ['admin', 'users'] as const,
    payments: ['admin', 'payments'] as const,
  },
  plans: ['plans'] as const,
  recentContent: ['recent-content'] as const,
  wellness: ['wellness'] as const,
  progress: ['progress'] as const,
  progressBreakdown: ['progress', 'breakdown'] as const,
  notifications: ['notifications'] as const,
  myReports: ['my-reports'] as const,
  decks: (courseId: string | null | undefined, q: string) => ['decks', courseId, q] as const,
  myKyc: ['kyc', 'me'] as const,
  curriculum: (courseId: string | null | undefined) => ['curriculum', courseId] as const,
  chapterContent: (chapterId: string | undefined) => ['chapter-content', chapterId] as const,
  chapterTests: (chapterId: string | undefined, kind: string | undefined, topRated: boolean) =>
    ['chapter-tests', chapterId, kind ?? 'all', topRated] as const,
} as const;
