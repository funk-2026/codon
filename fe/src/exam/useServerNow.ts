import { useEffect, useState } from 'react';

/** The current time by the server's clock, re-read every second while `active`. `offset` comes from `clockOffset`. */
export function useServerNow(offset: number, active = true): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset, active]);
  return now;
}
