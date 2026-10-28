import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Per-question countdown for Review ("max 2 minutes per question"). Restarts
 * whenever `key` (the question) changes; fires `onExpire` once per question.
 * Time-based, so backgrounding the app doesn't freeze it. null when disabled.
 */
export function useQuestionCountdown(key: string | undefined, limitSeconds: number, enabled: boolean, onExpire: () => void): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const cb = useRef(onExpire);
  useEffect(() => {
    cb.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!enabled || !key) {
      setLeft(null);
      return;
    }
    const start = Date.now();
    let fired = false;
    const tick = () => {
      const l = Math.max(0, limitSeconds - Math.floor((Date.now() - start) / 1000));
      setLeft(l);
      if (l === 0 && !fired) {
        fired = true;
        cb.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [key, limitSeconds, enabled]);

  return left;
}
