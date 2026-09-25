/**
 * Single analytics sink (FE-0.5 / CM-E13). Every event goes through `track()`
 * so a vendor can be plugged in later by calling `setSink()` once — no screen
 * changes. Until a sink is registered, events are dropped (no-op) and, in dev,
 * logged.
 */
export type EventName =
  | 'custom.builder_opened'
  | 'custom.filter_changed'
  | 'custom.count_shortfall'
  | 'custom.generated'
  | 'custom.started'
  | 'custom.submitted'
  | 'custom.review_opened'
  | 'custom.practise_mistakes'
  | 'report.submitted'
  | 'bookmark.toggled'
  | 'rating.submitted'
  | 'media.upload_failed'
  | 'media.upload_succeeded'
  | 'import.preflight'
  | 'import.committed'
  | 'flashcards.reviewed'
  | 'notes.saved';

type Props = Record<string, string | number | boolean | null | undefined>;
type Sink = (event: EventName, props: Props) => void;

let sink: Sink | null = null;
let consent = true;

export function setSink(s: Sink | null) {
  sink = s;
}

/** Respect the user's privacy choice: when false nothing is emitted. */
export function setAnalyticsConsent(v: boolean) {
  consent = v;
}

export function track(event: EventName, props: Props = {}) {
  if (!consent) return;
  try {
    if (sink) sink(event, props);
    else if (__DEV__) console.log('[track]', event, props);
  } catch {
    /* analytics must never break the app */
  }
}
