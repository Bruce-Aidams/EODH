import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { getThemeColors, ThemeColors, THEME } from '@/constants/theme';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  themeMode: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: THEME.light,
  isDark: false,
  themeMode: 'system',
  setTheme: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const themeMode = useSettingsStore(state => state.theme);
  const setTheme = useSettingsStore(state => state.setTheme);

  const colors = useMemo(
    () => getThemeColors(themeMode, systemColorScheme),
    [themeMode, systemColorScheme]
  );

  const isDark = useMemo(
    () => themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark'),
    [themeMode, systemColorScheme]
  );

  const value = useMemo(
    () => ({ colors, isDark, themeMode, setTheme }),
    [colors, isDark, themeMode, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
