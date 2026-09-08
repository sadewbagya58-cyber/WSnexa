/**
 * WSNexa — QR Menu Guest Language Helper
 * Default is strictly English ('en').
 * Sinhala + English mix ('si') is activated ONLY upon explicit customer selection.
 */

export type GuestLanguage = 'en' | 'si';

export const GUEST_LANGUAGE_STORAGE_KEY = 'wsnexa_guest_lang';
export const DEFAULT_GUEST_LANGUAGE: GuestLanguage = 'en';

export function getStoredGuestLanguage(): GuestLanguage {
  if (typeof window === 'undefined') return DEFAULT_GUEST_LANGUAGE;
  try {
    const val = localStorage.getItem(GUEST_LANGUAGE_STORAGE_KEY);
    if (val === 'si' || val === 'en') {
      return val;
    }
  } catch {
    // Ignore storage restrictions
  }
  return DEFAULT_GUEST_LANGUAGE;
}

export function setStoredGuestLanguage(lang: GuestLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Helper to resolve text based on active guest language.
 * Always returns enText when lang === 'en'.
 * Returns siText only when lang === 'si' and siText is non-empty.
 */
export function resolveGuestText(lang: GuestLanguage, enText: string, siText?: string): string {
  if (lang === 'si' && siText && siText.trim().length > 0) {
    return siText;
  }
  return enText;
}
