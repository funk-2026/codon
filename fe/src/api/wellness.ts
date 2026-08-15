import { apiFetch } from './client';

export type WellnessContent = {
  id: string;
  title: string;
  category: 'guidance' | 'motivation' | 'reflection_prompt';
  body_text: string;
  media_url?: string;
  is_active: boolean;
};

export type ListWellnessResponse = {
  content: WellnessContent[];
};

/** GET /api/v1/wellness/content */
export function listWellness(category?: string): Promise<ListWellnessResponse> {
  const qs = category ? `?category=${category}` : '';
  return apiFetch<ListWellnessResponse>(`/wellness/content${qs}`, { method: 'GET' });
}

export type GetWellnessResponse = {
  content: WellnessContent;
};

/** GET /api/v1/wellness/content/:id (Requires BE implementation) */
export function getWellnessItem(id: string): Promise<GetWellnessResponse> {
  return apiFetch<GetWellnessResponse>(`/wellness/content/${id}`, { method: 'GET' });
}
