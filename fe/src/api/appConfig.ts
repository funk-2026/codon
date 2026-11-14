import { apiFetch } from './client';

export type AppConfig = {
  version: number;
  flags: Record<string, boolean>;
  limits: {
    media: { max_bytes: number; max_dimension: number; allowed_mimes: string[]; max_images_per_question: number; max_images_per_field: number };
    rich_text: { max_stem_chars: number; max_option_chars: number; max_explanation_chars: number };
    import: { max_rows: number; max_bundle_bytes: number };
    custom_test: { min_questions: number; max_questions: number; min_duration_minutes: number; max_duration_minutes: number };
    ratings: { min_count_display: number };
  };
  report_reasons: { key: string; label: string }[];
  rating_rules: Record<string, { type: 'stars' | 'thumbs'; min?: number; max?: number; values?: number[] }>;
  bookmark_collections: { id: string; key: string; label: string }[];
} & PublicConfig;

/** Links and the version gate; readable before sign-in (GET /public-config). Blank values mean "not set". */
export type PublicConfig = {
  app: { min_version: string; store_url_android: string; store_url_ios: string };
  legal: { terms_url: string; privacy_url: string };
  support: { email: string; whatsapp: string };
};

export const getPublicConfig = () => apiFetch<PublicConfig>('/public-config', { method: 'GET' });

/** GET /api/v1/app-config */
export function getAppConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/app-config', { method: 'GET' });
}
