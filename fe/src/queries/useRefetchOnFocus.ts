import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Tab screens stay mounted, so a query won't refetch when you come back to the tab.
 * Call this with a refetch function to refresh whenever the screen regains focus
 * (the first focus is skipped because the query already loaded on mount).
 *
 * The latest function is kept in a ref, so callers can pass an inline arrow without it
 * re-running the focus effect (and refetching) on every render.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  });
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void latest.current();
    }, []),
  );
}
