import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TextStyle, useColorScheme } from 'react-native';
import { ColorToken, TypeToken, colors, darkColors, radius, space, typography } from './tokens';
import { kvGet, kvSet } from '@/src/storage/kv';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  color: (token: ColorToken) => string;
  colors: Record<ColorToken, string>;
  type: Record<TypeToken, TextStyle>;
  space: typeof space;
  radius: typeof radius;
  /** What the student chose in Settings; `scheme` is what is actually showing. */
  preference: ThemePreference;
  scheme: 'light' | 'dark';
  setPreference: (p: ThemePreference) => void;
};

const KEY = 'theme-preference';
const build = (scheme: 'light' | 'dark', preference: ThemePreference, setPreference: (p: ThemePreference) => void): ThemeContextValue => {
  const palette = scheme === 'dark' ? darkColors : colors;
  return { color: (token) => palette[token], colors: palette, type: typography, space, radius, preference, scheme, setPreference };
};

const ThemeContext = createContext<ThemeContextValue>(build('light', 'system', () => {}));

/** The scheme to show: the student's choice, or the phone's own setting when they chose System. */
export const resolveScheme = (preference: ThemePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' =>
  preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');
  useEffect(() => {
    kvGet<ThemePreference>(KEY, 'system').then((p) => setPref(p === 'light' || p === 'dark' ? p : 'system'));
  }, []);
  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    void kvSet(KEY, p);
  }, []);
  const scheme = resolveScheme(preference, system);
  const value = useMemo(() => build(scheme, preference, setPreference), [scheme, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
