import { apiFetch } from './client';

export type UploadPurpose = 'kyc_document' | 'video' | 'csv' | 'profile_photo' | 'lecture_pdf';

export type PresignRequest = {
  file_name: string;
  content_type: string;
  purpose: UploadPurpose;
};

export type PresignResponse = {
  upload_url: string;
  file_key: string;
  tus_auth?: {
    signature: string;
    expires: number;
    library_id: string;
    video_id: string;
  };
};

/** POST /api/v1/uploads/presign */
export function getPresignedUrl(data: PresignRequest): Promise<PresignResponse> {
  return apiFetch<PresignResponse>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
