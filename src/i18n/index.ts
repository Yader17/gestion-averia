import { es } from './es';
import { en } from './en';
import type { Language } from '../services/preferencesService';

export type TranslationKey = keyof typeof es;
export type Dictionary = Record<TranslationKey, string>;

export const dictionaries: Record<Language, Dictionary> = { es, en };

export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const template = dictionaries[language][key] ?? dictionaries.es[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`
  );
}

export function detectDeviceLanguage(locale: string | undefined | null): Language {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'es';
}
