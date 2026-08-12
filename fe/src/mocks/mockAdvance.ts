import { router } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * MOCK — remove when a real backend exists.
 *
 * Central "fake submit" helper. Every button that would normally submit,
 * validate, or call an API routes through this instead of scattering inline
 * navigation across screens. When a real backend arrives, delete `src/mocks/`
 * and replace the call sites with real API calls.
 *
 * Navigation is unconditional — never blocked on validation.
 */
export function mockAdvance(to: Href) {
  router.push(to);
}

/**
 * MOCK — remove when a real backend exists.
 * Same as mockAdvance but replaces the current route (for one-way flows like
 * splash/onboarding/auth where back-navigation should not return).
 */
export function mockAdvanceReplace(to: Href) {
  router.replace(to);
}
