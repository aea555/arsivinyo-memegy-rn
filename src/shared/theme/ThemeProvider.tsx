import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, DarkTheme, Theme as NavigationTheme } from '@react-navigation/native';

import { colors, ThemeColors } from './colors';

export type ThemeMode = 'light' | 'dark' | 'auto';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  effectiveMode: 'light' | 'dark';
  palette: ThemeColors;
  navigationTheme: NavigationTheme;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'auto') {
          setModeState(stored);
        }
      });
  }, []);

  const effectiveMode = mode === 'auto' ? systemScheme : mode;
  const palette = colors[effectiveMode];

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = effectiveMode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.background,
        card: palette.surface,
        text: palette.text.primary,
        border: palette.border,
        primary: palette.accent,
      },
    };
  }, [effectiveMode, palette]);

  const setMode = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
  };

  const value = useMemo(
    () => ({ mode, setMode, effectiveMode, palette, navigationTheme }),
    [mode, effectiveMode, palette, navigationTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
