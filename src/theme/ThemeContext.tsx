import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import {
  DEFAULT_PREFERENCES,
  Preferences,
  loadPreferences,
  savePreferences,
} from '../services/preferencesService';
import { Palette, darkPalette, lightPalette } from './palettes';

type ThemeContextValue = {
  colors: Palette;
  isDark: boolean;
  reduceMotion: boolean;
  preferences: Preferences;
  preferencesReady: boolean;
  updatePreferences: (patch: Partial<Preferences>) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightPalette,
  isDark: false,
  reduceMotion: false,
  preferences: DEFAULT_PREFERENCES,
  preferencesReady: false,
  updatePreferences: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void loadPreferences().then((loaded) => {
      if (!active) return;
      setPreferences(loaded);
      setPreferencesReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setSystemReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...patch };
      void savePreferences(next);
      return next;
    });
  }, []);

  const isDark =
    preferences.themeMode === 'system' ? systemScheme === 'dark' : preferences.themeMode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? darkPalette : lightPalette,
      isDark,
      reduceMotion: systemReduceMotion || preferences.reduceMotion,
      preferences,
      preferencesReady,
      updatePreferences,
    }),
    [isDark, systemReduceMotion, preferences, preferencesReady, updatePreferences]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Builds a StyleSheet from the active palette; recomputed only when the theme changes.
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(colors), [colors]);
}
