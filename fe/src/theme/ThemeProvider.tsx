import React, { createContext, useContext, useMemo, useState } from 'react';
import { TextStyle, useColorScheme } from 'react-native';
import {
  ColorToken,
  ThemeMode,
  TypeToken,
  colors,
  radius,
  space,
  typography,
} from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  color: (token: ColorToken) => string;
  colors: Record<ColorToken, string>;
  type: Record<TypeToken, TextStyle>;
  space: typeof space;
  radius: typeof radius;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  const mode: ThemeMode =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(() => {
    const palette = colors[mode];
    return {
      mode,
      preference,
      setPreference,
      color: (token: ColorToken) => palette[token],
      colors: palette,
      type: typography,
      space,
      radius,
    };
  }, [mode, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
