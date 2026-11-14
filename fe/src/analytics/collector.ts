import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiFetch } from '@/src/api/client';
import { setSink, type EventName } from './track';

/**
 * Sends app events to our own backend (`POST /events`): free, no third-party SDK.
 * Two switches must both be on, and both default to off:
 *   1. the build:   EXPO_PUBLIC_ANALYTICS_ENABLED=true
 *   2. the server:  Platform settings → analytics.events (the server discards events otherwise)
 * Events are batched, kept in memory, flushed every 20 s, at 20 events and when the app goes to the
 * background. A failed flush puts the events back (up to 200), so nothing is lost on a bad network.
 */
const BUILD_ENABLED = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true';
const MAX_BATCH = 50;
const FLUSH_EVERY_MS = 20_000;

type Queued = { name: string; props: Record<string, unknown>; at: string };
let queue: Queued[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let sending = false;
let started = false;

export const analyticsBuildEnabled = BUILD_ENABLED;

async function flush() {
  if (sending || queue.length === 0) return;
  sending = true;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await apiFetch('/events', {
      method: 'POST',
      body: JSON.stringify({ events: batch, app_version: Constants.expoConfig?.version ?? '', platform: Platform.OS }),
    });
  } catch {
    queue = [...batch, ...queue].slice(0, 200);
  } finally {
    sending = false;
  }
}

/** Idempotent. Does nothing unless the build has analytics switched on. */
export function startCollector() {
  if (!BUILD_ENABLED || started) return;
  started = true;
  setSink((name: EventName, props) => {
    queue.push({ name, props: { ...props }, at: new Date().toISOString() });
    if (queue.length >= 20) void flush();
  });
  timer = setInterval(() => void flush(), FLUSH_EVERY_MS);
  AppState.addEventListener('change', (s) => {
    if (s !== 'active') void flush();
  });
}

export function stopCollector() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
  queue = [];
  setSink(null);
}

/** Send what is queued now (used right after a crash, before the app may be killed). */
export const flushNow = () => flush();
