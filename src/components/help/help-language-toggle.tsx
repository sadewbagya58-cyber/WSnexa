'use client';

import React from 'react';
import { useHelpLanguage } from './help-language-context';

interface HelpLanguageToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const HelpLanguageToggle: React.FC<HelpLanguageToggleProps> = ({
  className = '',
  showLabel = true,
}) => {
  const { language, setLanguage, isMounted } = useHelpLanguage();

  // Render stable placeholder until mounted to prevent hydration flicker
  const currentLang = isMounted ? language : 'en';

  return (
    <div className={`flex items-center gap-2.5 flex-wrap ${className}`}>
      {showLabel && (
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider select-none">
          Guide Language
        </span>
      )}
      <div
        role="radiogroup"
        aria-label="Guide Language Selection"
        className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs"
      >
        <button
          type="button"
          role="radio"
          aria-checked={currentLang === 'en'}
          onClick={() => setLanguage('en')}
          className={`flex min-h-[36px] items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-black transition-all touch-manipulation cursor-pointer ${
            currentLang === 'en'
              ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80 dark:bg-zinc-900 dark:text-white dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          English
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={currentLang === 'si-en'}
          onClick={() => setLanguage('si-en')}
          className={`flex min-h-[36px] items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-black transition-all touch-manipulation cursor-pointer ${
            currentLang === 'si-en'
              ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80 dark:bg-zinc-900 dark:text-white dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          සිංහල + English
        </button>
      </div>
    </div>
  );
};
