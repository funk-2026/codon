import React, { createContext, useContext } from 'react';
import { TextStyle } from 'react-native';
import { ColorToken, TypeToken, colors, radius, space, typography } from './tokens';

type ThemeContextValue = {
  color: (token: ColorToken) => string;
  colors: Record<ColorToken, string>;
  type: Record<TypeToken, TextStyle>;
  space: typeof space;
  radius: typeof radius;
};

// The app ships a single light theme, so the value is static.
const theme: ThemeContextValue = {
  color: (token: ColorToken) => colors[token],
  colors,
  type: typography,
  space,
  radius,
};

const ThemeContext = createContext<ThemeContextValue>(theme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
