import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'es' | 'en';

export type Preferences = {
  themeMode: ThemeMode;
  language: Language | null; // null = follow device
  reduceMotion: boolean; // user override on top of the system setting
  onboardingDone: boolean;
};

const KEY = '@gestion_averias/preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  language: null,
  reduceMotion: false,
  onboardingDone: false,
};

export function sanitizePreferences(raw: unknown): Preferences {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    themeMode:
      value.themeMode === 'light' || value.themeMode === 'dark' || value.themeMode === 'system'
        ? value.themeMode
        : DEFAULT_PREFERENCES.themeMode,
    language: value.language === 'es' || value.language === 'en' ? value.language : null,
    reduceMotion: value.reduceMotion === true,
    onboardingDone: value.onboardingDone === true,
  };
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return sanitizePreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Could not save preferences:', error);
  }
}
