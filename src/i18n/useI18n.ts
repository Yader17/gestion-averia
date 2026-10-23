import { useCallback, useMemo } from 'react';
import { getLocales } from 'expo-localization';
import { useTheme } from '../theme/ThemeContext';
import type { Language } from '../services/preferencesService';
import { TranslationKey, detectDeviceLanguage, translate } from './index';

export function useI18n() {
  const { preferences, updatePreferences } = useTheme();
  const language: Language = preferences.language ?? detectDeviceLanguage(getLocales()[0]?.languageTag);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language]
  );

  const setLanguage = useCallback(
    (next: Language) => updatePreferences({ language: next }),
    [updatePreferences]
  );

  return useMemo(() => ({ t, language, setLanguage }), [t, language, setLanguage]);
}
