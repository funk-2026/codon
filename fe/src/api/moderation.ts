import { apiFetch, qs, type Paginated } from './client';
import type { ContentReport, ReportStatus } from './reports';
import type { AuthoredQuestion } from './tests';
import type { CorrectionRow } from './questionBank';
import type { MediaMap } from '@/src/rich/ast';

// ── Reports inbox (teacher: own content; admin: everything) ─────────────────

export type ReportInboxRow = ContentReport & {
  question?: AuthoredQuestion;
  open_reports_for_item: number;
  test_id?: string;
};

export type ReportFilters = { status?: ReportStatus | 'all'; reason?: string; cursor?: string | null; limit?: number };

export const listTeacherReports = (p: ReportFilters = {}) =>
  apiFetch<Paginated<ReportInboxRow> & { media?: MediaMap }>(`/teacher/reports${qs({ ...p, cursor: p.cursor ?? undefined })}`);

export const listAdminReports = (p: ReportFilters = {}) =>
  apiFetch<Paginated<ReportInboxRow> & { media?: MediaMap }>(`/admin/reports${qs({ ...p, cursor: p.cursor ?? undefined })}`);

/** POST /teacher/reports/:id/resolve — notifies the reporter; may release an auto-held question. */
export const resolveReport = (id: string, status: 'fixed' | 'no_change' | 'dismissed', note?: string) =>
  apiFetch<ContentReport>(`/teacher/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status, note: note ?? '' }) });

export const dismissReport = (id: string, note?: string) =>
  apiFetch<ContentReport>(`/admin/reports/${id}/dismiss`, { method: 'POST', body: JSON.stringify({ status: 'dismissed', note: note ?? '' }) });

// ── Corrections queue (admin) ───────────────────────────────────────────────

export type CorrectionQueueRow = CorrectionRow & { question?: AuthoredQuestion; rescore?: boolean; snapshot_before?: Record<string, unknown> };

export const listAdminCorrections = (p: { status?: 'pending' | 'approved' | 'rejected' | 'all'; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<Paginated<CorrectionQueueRow> & { media?: MediaMap }>(`/admin/corrections${qs({ ...p, cursor: p.cursor ?? undefined })}`);

export const approveCorrection = (id: string) => apiFetch<CorrectionRow>(`/admin/corrections/${id}/approve`, { method: 'POST' });

export const rejectCorrection = (id: string, reason: string) =>
  apiFetch<CorrectionRow>(`/admin/corrections/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

export const listTeacherCorrections = (p: { status?: string; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<Paginated<CorrectionQueueRow>>(`/teacher/corrections${qs({ ...p, cursor: p.cursor ?? undefined })}`);
