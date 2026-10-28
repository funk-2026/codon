import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { secondsLeft } from './logic';

/**
 * Countdown derived from an absolute deadline (device-clock ms), never from
 * decrementing a counter — so backgrounding the app, JS pauses or a slow render
 * can't make it drift. `onExpire` fires exactly once.
 */
export function useAttemptTimer(deadlineMs: number | null, onExpire: () => void) {
  const [left, setLeft] = useState<number | null>(() => secondsLeft(deadlineMs, Date.now()));
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    fired.current = false;
    if (deadlineMs == null) {
      setLeft(null);
      return;
    }
    const tick = () => {
      const s = secondsLeft(deadlineMs, Date.now());
      setLeft(s);
      if (s === 0 && !fired.current) {
        fired.current = true;
        cb.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && tick());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [deadlineMs]);

  return left;
}
