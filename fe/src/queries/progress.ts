import { useQuery } from '@tanstack/react-query';
import { getProgress, getProgressBreakdown } from '@/src/api/profile';
import { keys } from './keys';

export const useProgress = () => useQuery({ queryKey: keys.progress, queryFn: getProgress });
export const useProgressBreakdown = () =>
  useQuery({ queryKey: keys.progressBreakdown, queryFn: getProgressBreakdown });
