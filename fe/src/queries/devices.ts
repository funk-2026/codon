import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSessions, revokeSession } from '@/src/api/sessions';
import { keys } from './keys';

export type Device = {
  id: string;
  label: string;
  lastActive: string;
  current: boolean;
  kind: 'phone' | 'tablet';
};

export const useDevices = () =>
  useQuery({
    queryKey: keys.devices,
    queryFn: listSessions,
    select: ({ sessions }): Device[] => {
      const mapped = sessions.map((s): Device => {
        const info = s.device_info?.toLowerCase() ?? '';
        return {
          id: s.id,
          label: s.device_info || 'Unknown Device',
          lastActive: new Date(s.last_used_at).toLocaleDateString(),
          current: false,
          kind: info.includes('ipad') || info.includes('tablet') ? 'tablet' : 'phone',
        };
      });
      if (mapped.length > 0) mapped[0].current = true; // best effort for the current-session marker
      return mapped;
    },
  });

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.devices }),
  });
}
