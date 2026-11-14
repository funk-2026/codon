import { useQuery } from '@tanstack/react-query';
import { getPublicConfig, type PublicConfig } from '@/src/api/appConfig';

/** Links and the minimum version, fetched once at launch (works before sign-in). Missing = nothing configured. */
export function usePublicConfig(): PublicConfig | null {
  const q = useQuery({ queryKey: ['public-config'], queryFn: getPublicConfig, staleTime: 5 * 60_000, retry: 1 });
  return q.data ?? null;
}

export { isOlderThan } from './versionCompare';
