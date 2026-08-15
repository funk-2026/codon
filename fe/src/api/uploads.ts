import { apiFetch } from './client';

export type PresignRequest = {
  filename: string;
  content_type: string;
};

export type PresignResponse = {
  upload_url: string;
  file_key: string;
};

/** POST /api/v1/uploads/presign */
export function getPresignedUrl(data: PresignRequest): Promise<PresignResponse> {
  return apiFetch<PresignResponse>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
