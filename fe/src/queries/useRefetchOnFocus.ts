import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Tab screens stay mounted, so a query won't refetch when you come back to the tab.
 * Call this with a query's `refetch` to refresh whenever the screen regains focus
 * (the first focus is skipped because the query already loaded on mount).
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
