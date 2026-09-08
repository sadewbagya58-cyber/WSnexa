'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  GuestLanguage,
  DEFAULT_GUEST_LANGUAGE,
  getStoredGuestLanguage,
  setStoredGuestLanguage,
  resolveGuestText,
} from './guest-language';

interface GuestLanguageContextValue {
  language: GuestLanguage;
  setLanguage: (lang: GuestLanguage) => void;
  t: (enText: string, siText?: string) => string;
}

const GuestLanguageContext = createContext<GuestLanguageContextValue>({
  language: DEFAULT_GUEST_LANGUAGE,
  setLanguage: () => {},
  t: (en) => en,
});

export const GuestLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<GuestLanguage>(DEFAULT_GUEST_LANGUAGE);

  // Initialize from storage on client mount
  useEffect(() => {
    const saved = getStoredGuestLanguage();
    if (saved && saved !== DEFAULT_GUEST_LANGUAGE) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((newLang: GuestLanguage) => {
    setLanguageState(newLang);
    setStoredGuestLanguage(newLang);
  }, []);

  const t = useCallback(
    (enText: string, siText?: string) => {
      return resolveGuestText(language, enText, siText);
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return (
    <GuestLanguageContext.Provider value={contextValue}>
      {children}
    </GuestLanguageContext.Provider>
  );
};

export function useGuestLanguage(): GuestLanguageContextValue {
  return useContext(GuestLanguageContext);
}

export const GuestLanguageToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage } = useGuestLanguage();

  return (
    <div
      role="radiogroup"
      aria-label="Menu Language"
      className={`inline-flex items-center rounded-full bg-zinc-100 p-0.5 border border-zinc-200 shadow-2xs ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={language === 'en'}
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer select-none ${
          language === 'en'
            ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80'
            : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        English
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={language === 'si'}
        onClick={() => setLanguage('si')}
        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer select-none ${
          language === 'si'
            ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80'
            : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        සිංහල
      </button>
    </div>
  );
};
