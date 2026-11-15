import { track } from './track';
import { flushNow } from './collector';

/**
 * Reports uncaught JS errors as `app.crash` events through the same collector (so it is also off unless
 * analytics is switched on), then lets React Native's own handler run. A real crash reporter (Sentry,
 * Crashlytics) can replace this; see docs/future-gaps.md.
 */
let installed = false;

export function installCrashReporting() {
  if (installed) return;
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (!utils) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    try {
      track('app.crash', {
        message: String(error?.message ?? error).slice(0, 300),
        stack: String(error?.stack ?? '').slice(0, 900),
        fatal: !!isFatal,
      });
      void flushNow();
    } catch {
      /* reporting must never make a crash worse */
    }
    previous(error, isFatal);
  });
}
