import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlatformSettingsKYC, adminListKYC, getAdminDashboardSummary, getPayment, listPayments, listUsers } from '@/src/api/admin';
import { keys } from './keys';

export const useAdminSummary = () =>
  useQuery({ queryKey: keys.admin.summary, queryFn: getAdminDashboardSummary });

export const useAdminUsers = () =>
  useQuery({ queryKey: keys.admin.users, queryFn: listUsers, select: (r) => r.users ?? [] });

export const useAdminPayments = () =>
  useQuery({ queryKey: keys.admin.payments, queryFn: listPayments, select: (r) => (r?.payments ?? []) as PaymentRecordLike[] });

// Payments come back loosely typed from the API layer; screens narrow this to their own record type.
type PaymentRecordLike = any;

type KycStatus = 'pending' | 'approved' | 'rejected';

export const useAdminKyc = (status: KycStatus) =>
  useQuery({ queryKey: ['admin', 'kyc', status], queryFn: () => adminListKYC(status), select: (r) => r.records ?? [] });

/** Drops a record from the cached pending list right after it's been approved or rejected. */
export function useRemovePendingKyc() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.setQueryData(['admin', 'kyc', 'pending'], (old: { records: { id: string }[] } | undefined) =>
      old ? { ...old, records: old.records.filter((r) => r.id !== id) } : old);
    void qc.invalidateQueries({ queryKey: ['admin', 'kyc'] });
  };
}

/** The review detail screen has no get-by-id endpoint, so look across all three statuses. */
export const useAdminKycRecord = (id: string | undefined) =>
  useQuery({
    queryKey: ['admin', 'kyc', 'record', id],
    queryFn: async () => {
      const [pending, approved, rejected] = await Promise.all([adminListKYC('pending'), adminListKYC('approved'), adminListKYC('rejected')]);
      return {
        pendingCount: pending.records.length,
        record: [...pending.records, ...approved.records, ...rejected.records].find((r) => r.id === id) ?? null,
      };
    },
    enabled: !!id,
  });

export const useAdminPayment = (id: string | undefined) =>
  useQuery({ queryKey: ['admin', 'payment', id], queryFn: () => getPayment(id as string), enabled: !!id });

export const useKycRequirement = () =>
  useQuery({ queryKey: ['admin', 'settings', 'kyc'], queryFn: getPlatformSettingsKYC, select: (r) => r.required });
