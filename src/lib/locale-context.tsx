'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  type Locale,
  DEFAULT_LOCALE,
  translate,
  detectLocale,
  isLocale,
} from '@/lib/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a key with optional {var} interpolation. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = 'luna-travel.locale';

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Start from the source language for a stable first paint (avoids hydration
  // mismatch); resolve the real locale on mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let resolved: Locale = DEFAULT_LOCALE;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) {
        resolved = saved; // explicit choice wins
      } else {
        resolved = detectLocale(navigator.language); // first-run auto-detect
      }
    } catch {
      /* ignore */
    }
    setLocaleState(resolved);
  }, []);

  // Keep <html lang> in step for accessibility / correct hyphenation.
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useI18n must be used within LocaleProvider');
  return ctx;
}
