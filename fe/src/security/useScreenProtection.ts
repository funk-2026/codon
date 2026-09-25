import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/src/auth/AuthContext';

/**
 * Blocks screenshots / screen recording while the calling screen is mounted
 * (CM-RC11: question content is the product). Applies to STUDENTS only —
 * teachers and admins need screenshots to author, review and support.
 *
 * The native module is loaded lazily inside a try/catch: a build that doesn't
 * include it (or web) simply doesn't protect, it never crashes.
 */
export function useScreenProtection(enabled = true) {
  const { user } = useAuth();
  const active = enabled && user?.role === 'student' && Platform.OS !== 'web';

  useEffect(() => {
    if (!active) return;
    let release: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const SC = await import('expo-screen-capture');
        const key = `codon-${Math.random().toString(36).slice(2)}`;
        await SC.preventScreenCaptureAsync(key);
        release = () => void SC.allowScreenCaptureAsync(key).catch(() => {});
        if (cancelled) release();
      } catch {
        /* native module unavailable in this build */
      }
    })();
    return () => {
      cancelled = true;
      release?.();
    };
  }, [active]);
}
