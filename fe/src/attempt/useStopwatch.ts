import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Seconds elapsed since `startMs` (device clock), ticking every second.
 * Derived from the start time rather than counted up, so backgrounding the
 * app or resuming an attempt shows the real elapsed time. null when no start.
 */
export function useStopwatch(startMs: number | null): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    if (startMs == null) {
      setElapsed(null);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [startMs]);
  return elapsed;
}
