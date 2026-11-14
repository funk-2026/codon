import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { installCrashReporting } from './crash';
import { startCollector } from './collector';
import { track } from './track';

/** Starts the collector and crash reporting (both inert unless the build switches analytics on) and logs screen views. */
export function AnalyticsBootstrap() {
  const path = usePathname();
  useEffect(() => {
    installCrashReporting();
    startCollector();
    track('app.opened');
  }, []);
  useEffect(() => {
    // Only the route shape, never ids or search text: "/(student)/test-result", not the attempt.
    track('screen.viewed', { path });
  }, [path]);
  return null;
}
