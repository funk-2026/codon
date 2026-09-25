import { apiFetch } from './client';
import type { Blueprint } from './customTests';

export type AdminSetting = { key: string; value: string; default: string };

/** GET /admin/settings/custom-test — every tunable with its current value and default. */
export const getCustomTestSettings = () => apiFetch<{ settings: AdminSetting[] }>('/admin/settings/custom-test');

/** PATCH /admin/settings/custom-test — unknown keys / badly-typed values are rejected; every change is audit-logged. */
export const patchCustomTestSettings = (values: Record<string, string>) =>
  apiFetch<{ settings?: AdminSetting[]; updated?: string[] }>('/admin/settings/custom-test', { method: 'PATCH', body: JSON.stringify({ values }) });

export type PoolChapter = {
  chapter_id: string | null;
  chapter: string;
  subject: string;
  eligible: number;
  easy?: number;
  medium?: number;
  hard?: number;
  under_review?: number;
  open_reports?: number;
  missing_topic?: number;
  missing_tags?: number;
  missing_ncert?: number;
  missing_difficulty?: number;
};

/** GET /admin/pool-health */
export const getPoolHealth = () =>
  apiFetch<{ chapters: PoolChapter[]; totals: { eligible: number; low_inventory_chapters: number; floor: number } }>('/admin/pool-health');

export type Metrics = {
  process: { generated: number; with_relaxations: number; empty_pool_rejections: number; avg_latency_ms: number; max_latency_ms: number };
  last_24h: { generated_tests: number; auto_submitted_attempts: number; rejected_uploads: number };
  now: { active_generated_tests: number; questions_under_review: number; open_reports: number };
};

/** GET /admin/custom-test/metrics */
export const getCustomTestMetrics = () => apiFetch<Metrics>('/admin/custom-test/metrics');

export type AdminPreset = {
  id: string; course_id: string; title: string; description: string; blueprint: Blueprint; order_index: number; is_active: boolean;
};

export const listPresets = () => apiFetch<{ presets: AdminPreset[] }>('/admin/custom-test/presets');
export const updatePreset = (id: string, p: Partial<{ title: string; description: string; order_index: number; is_active: boolean }>) =>
  apiFetch<AdminPreset>(`/admin/custom-test/presets/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
export const deletePreset = (id: string) => apiFetch<{ message: string }>(`/admin/custom-test/presets/${id}`, { method: 'DELETE' });
export const createPreset = (p: { course_id: string; title: string; description?: string; blueprint: Blueprint; order_index?: number }) =>
  apiFetch<AdminPreset>('/admin/custom-test/presets', { method: 'POST', body: JSON.stringify(p) });

export type CollectionAdmin = { id: string; key: string; label: string; order_index: number; is_active: boolean };
export const listAdminCollections = () => apiFetch<{ collections: CollectionAdmin[] }>('/admin/bookmark-collections');
export const patchCollection = (id: string, p: Partial<{ label: string; order_index: number; is_active: boolean }>) =>
  apiFetch<CollectionAdmin>(`/admin/bookmark-collections/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
