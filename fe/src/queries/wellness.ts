import { useQuery } from '@tanstack/react-query';
import { listWellness } from '@/src/api/wellness';
import { keys } from './keys';

/** Published wellness articles (Support tab). Rarely changes, so cache for 10 minutes. */
export const useWellness = () =>
  useQuery({ queryKey: keys.wellness, queryFn: () => listWellness(), staleTime: 10 * 60_000 });

import { getWellnessItem } from '@/src/api/wellness';

/** Published articles in one category (the built-in starters show only while this is empty). */
export const useWellnessCategory = (categoryKey: Parameters<typeof listWellness>[0]) =>
  useQuery({ queryKey: [...keys.wellness, 'category', categoryKey], queryFn: () => listWellness(categoryKey), staleTime: 10 * 60_000 });

/** One live article; `undefined` id means a built-in starter, so nothing is fetched. */
export const useWellnessItem = (id: string | null) =>
  useQuery({
    queryKey: [...keys.wellness, 'item', id],
    queryFn: () => getWellnessItem(id as string),
    enabled: !!id,
    staleTime: 10 * 60_000,
  });
