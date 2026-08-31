'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  HelpLanguage,
  DEFAULT_HELP_LANGUAGE,
  HELP_LANGUAGE_STORAGE_KEY,
  isValidHelpLanguage,
  resolveLocalizedText,
  resolveLocalizedArray,
} from '@/lib/help/help-language';

interface HelpLanguageContextType {
  language: HelpLanguage;
  setLanguage: (lang: HelpLanguage) => void;
  isMounted: boolean;
  t: (enText: string, siEnText?: string) => string;
  tArray: (enArray?: string[], siEnArray?: string[]) => string[];
}

const HelpLanguageContext = createContext<HelpLanguageContextType>({
  language: DEFAULT_HELP_LANGUAGE,
  setLanguage: () => {},
  isMounted: false,
  t: (enText) => enText,
  tArray: (enArray) => enArray || [],
});

export const HelpLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<HelpLanguage>(DEFAULT_HELP_LANGUAGE);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(HELP_LANGUAGE_STORAGE_KEY);
        if (stored && isValidHelpLanguage(stored)) {
          setLanguageState(stored);
        }
      }
    } catch {
      // ignore in sandboxed environments
    }

    const handleCustomChange = (e: CustomEvent<HelpLanguage>) => {
      if (e.detail && isValidHelpLanguage(e.detail)) {
        setLanguageState(e.detail);
      }
    };

    window.addEventListener('wsnexa_help_language_change' as any, handleCustomChange);
    return () => {
      window.removeEventListener('wsnexa_help_language_change' as any, handleCustomChange);
    };
  }, []);

  const setLanguage = useCallback((newLang: HelpLanguage) => {
    if (!isValidHelpLanguage(newLang)) return;
    setLanguageState(newLang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(HELP_LANGUAGE_STORAGE_KEY, newLang);
        window.dispatchEvent(new CustomEvent('wsnexa_help_language_change', { detail: newLang }));
      }
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (enText: string, siEnText?: string) => {
      return resolveLocalizedText(language, enText, siEnText);
    },
    [language]
  );

  const tArray = useCallback(
    (enArray?: string[], siEnArray?: string[]) => {
      return resolveLocalizedArray(language, enArray, siEnArray);
    },
    [language]
  );

  return (
    <HelpLanguageContext.Provider value={{ language, setLanguage, isMounted, t, tArray }}>
      {children}
    </HelpLanguageContext.Provider>
  );
};

export function useHelpLanguage() {
  return useContext(HelpLanguageContext);
}
