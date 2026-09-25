import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAppConfig, type AppConfig } from '@/src/api/appConfig';
import { useAuth } from '@/src/auth/AuthContext';

/**
 * Runtime config + feature flags from GET /app-config (FE-0.4).
 *
 * Every flag defaults to OFF: while the config is loading, offline or the
 * request fails, nothing dark-launched appears. Fetched once after sign-in and
 * whenever `reload()` is called (e.g. app returning to the foreground).
 */
type Ctx = {
  config: AppConfig | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  reload: () => Promise<void>;
};

const AppConfigContext = createContext<Ctx>({ config: null, status: 'idle', reload: async () => {} });

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<Ctx['status']>('idle');

  const reload = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      setConfig(await getAppConfig());
      setStatus('ready');
    } catch (e) {
      console.error('Failed to load app config', e);
      setStatus((s) => (s === 'ready' ? s : 'error')); // keep the last good config
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      reload();
    } else {
      setConfig(null);
      setStatus('idle');
    }
  }, [auth.status, reload]);

  const value = useMemo(() => ({ config, status, reload }), [config, status, reload]);
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export const useAppConfig = () => useContext(AppConfigContext);

/** `true` only when the backend says so; missing key / no config → `false`. */
export function useFlag(key: string): boolean {
  const { config } = useContext(AppConfigContext);
  return config?.flags?.[key] === true;
}

/** Report reasons offered to the student (server-driven; falls back to none). */
export function useReportReasons() {
  return useContext(AppConfigContext).config?.report_reasons ?? [];
}
