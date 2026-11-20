import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { sendHeartbeat } from '@/src/api/content';

export type VideoSessionInfo = { id: string; title: string; url: string };

type Ctx = {
  player: VideoPlayer;
  session: VideoSessionInfo | null;
  /** True while the lesson plays in the small player over other screens. */
  docked: boolean;
  /** Which lesson is loaded right now (stable, safe to read in callbacks). */
  currentId: () => string | undefined;
  /** Load a lesson into the shared player. Same lesson again keeps playing where it was. */
  start: (s: VideoSessionInfo) => void;
  /** Shrink to the small player. The caller then navigates away. */
  dock: () => void;
  /** Stop and forget the lesson. A no-op if a different lesson is loaded (so a screen closing late is harmless). */
  close: (id?: string) => void;
};

const VideoSessionContext = createContext<Ctx | null>(null);
const WATCHED_FRACTION = 0.9;

/**
 * One video player for the whole student app, so a lesson can keep playing in a small player while the student
 * browses other screens. The lesson screen and the small player both draw this same player.
 */
export function VideoSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<VideoSessionInfo | null>(null);
  const [docked, setDocked] = useState(false);
  const idRef = useRef<string | undefined>(undefined);

  const player = useVideoPlayer(session?.url ?? null, (p) => {
    p.timeUpdateEventInterval = 0.5;
  });

  const start = useCallback((s: VideoSessionInfo) => {
    setDocked(false);
    if (idRef.current === s.id) return;
    idRef.current = s.id;
    setSession(s);
  }, []);
  const dock = useCallback(() => setDocked(true), []);
  const close = useCallback((id?: string) => {
    if (id && idRef.current !== id) return;
    idRef.current = undefined;
    setDocked(false);
    setSession(null);
  }, []);
  const currentId = useCallback(() => idRef.current, []);

  // While the lesson screen is closed the screen's own watch-progress heartbeat is gone, so keep saving from here.
  useEffect(() => {
    if (!docked || !session) return;
    const beat = () => {
      const d = player.duration || 0;
      const t = player.currentTime;
      if (d > 0 && t > 0) sendHeartbeat(session.id, Math.floor(t), t >= d * WATCHED_FRACTION).catch(() => {});
    };
    const timer = setInterval(() => player.playing && beat(), 10000);
    return () => {
      clearInterval(timer);
      beat();
    };
  }, [docked, session, player]);

  const value = useMemo(() => ({ player, session, docked, currentId, start, dock, close }), [player, session, docked, currentId, start, dock, close]);
  return <VideoSessionContext.Provider value={value}>{children}</VideoSessionContext.Provider>;
}

export function useVideoSession(): Ctx {
  const c = useContext(VideoSessionContext);
  if (!c) throw new Error('useVideoSession must be used inside VideoSessionProvider');
  return c;
}
