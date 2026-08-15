import { apiFetch } from './client';

export type KYCRecord = {
  id: string;
  user_id: string;
  id_type: 'aadhaar' | 'pan';
  id_number: string;
  document_file_key: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
};

export type SubmitKYCRequest = {
  id_type: 'aadhaar' | 'pan';
  id_number: string;
  document_file_key: string;
};

/** POST /api/v1/me/kyc */
export function submitKYC(data: SubmitKYCRequest): Promise<KYCRecord> {
  return apiFetch<KYCRecord>('/me/kyc', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** GET /api/v1/me/kyc */
export function getMyKYC(): Promise<KYCRecord> {
  return apiFetch<KYCRecord>('/me/kyc', { method: 'GET' });
}
