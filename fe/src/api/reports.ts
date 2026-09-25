import { apiFetch, qs, type Paginated } from './client';

export type ReportReason = 'wrong_answer' | 'typo_unclear' | 'duplicate' | 'outdated' | 'image_issue' | 'other';
export type ReportContext = 'runtime' | 'review' | 'tutor';
export type ReportStatus = 'open' | 'fixed' | 'no_change' | 'dismissed';

export type ContentReport = {
  id: string;
  item_type: string;
  item_id: string;
  reason: ReportReason | string;
  note?: string;
  context?: ReportContext;
  attempt_id?: string;
  status: ReportStatus;
  resolution_note?: string;
  resolved_at?: string;
  created_at: string;
};

export type CreateReportInput = {
  item_type: 'question';
  item_id: string;
  reason: string;
  note?: string;
  context?: ReportContext;
  attempt_id?: string;
};

/** POST /reports — one open report per (student,item); repeat returns 200 + already_reported. */
export const createReport = (r: CreateReportInput) =>
  apiFetch<{ report: ContentReport; already_reported: boolean }>('/reports', { method: 'POST', body: JSON.stringify(r) });

/** GET /me/reports */
export const listMyReports = (p: { cursor?: string | null; limit?: number } = {}) =>
  apiFetch<Paginated<ContentReport>>(`/me/reports${qs({ ...p, cursor: p.cursor ?? undefined })}`);
