/**
 * WSNexa — Phase 37 Step 3: Help & Guides Bilingual Engine
 * Language resolution and persistence helpers.
 */

export type HelpLanguage = 'en' | 'si-en';

export const HELP_LANGUAGE_STORAGE_KEY = 'wsnexa_help_language';

export const DEFAULT_HELP_LANGUAGE: HelpLanguage = 'en';

export function isValidHelpLanguage(val: unknown): val is HelpLanguage {
  return val === 'en' || val === 'si-en';
}

/**
 * Resolves text according to the user's active Help language preference.
 * If language is 'si-en' and Sinhala+English text is provided, returns that.
 * Otherwise returns the standard English text.
 */
export function resolveLocalizedText(
  lang: HelpLanguage,
  enText: string,
  siEnText?: string
): string {
  if (lang === 'si-en' && siEnText && siEnText.trim().length > 0) {
    return siEnText;
  }
  return enText;
}

/**
 * Resolves string array according to active Help language preference.
 */
export function resolveLocalizedArray(
  lang: HelpLanguage,
  enArray?: string[],
  siEnArray?: string[]
): string[] {
  if (lang === 'si-en' && siEnArray && siEnArray.length > 0) {
    return siEnArray;
  }
  return enArray || [];
}
