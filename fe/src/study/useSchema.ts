import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/auth/AuthContext';
import { getSchema, setSchemaStatus, type SchemaOverview, type SchemaStatus } from '@/src/api/study';
import { kvGet, kvSet } from '@/src/storage/kv';
import { withStatus, type SchemaSort } from './logic';

/** The syllabus tree with my statuses. A status change shows everywhere at once, then is saved; a failed save puts it back. */
export function useSchema() {
  const { user } = useAuth();
  const course = user?.selected_course_id ?? undefined;
  const key = ['schema', course ?? 'all'];
  const qc = useQueryClient();
  const q = useQuery({ queryKey: key, queryFn: () => getSchema(course) });
  const m = useMutation({
    mutationFn: (v: { id: string; status: SchemaStatus }) => setSchemaStatus(v.id, v.status),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SchemaOverview>(key);
      if (prev) qc.setQueryData(key, withStatus(prev, v.id, v.status));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['area-done', 'schema'] }),
  });
  const setStatus = useCallback((id: string, status: SchemaStatus) => m.mutate({ id, status }), [m]);
  return { ...q, setStatus, saveFailed: m.isError };
}

/** Idx or Frq, remembered on the phone. */
export function useSchemaSort() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['schema-sort'], queryFn: () => kvGet<SchemaSort>('schema-sort', 'idx'), staleTime: Infinity });
  const set = useCallback((s: SchemaSort) => {
    qc.setQueryData(['schema-sort'], s);
    void kvSet('schema-sort', s);
  }, [qc]);
  return [q.data ?? 'idx', set] as const;
}
