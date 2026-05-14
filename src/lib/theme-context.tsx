'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'luna-travel.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light is always the default. Dark is opt-in via the toggle and persisted.
  const [theme, setTheme] = useState<Theme>('light');

  // Restore the user's saved choice on mount (if any)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
      // If nothing saved, stay on light — don't fall through to OS preference.
    } catch {
      /* ignore */
    }
  }, []);

  // Apply to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const set = (t: Theme) => {
    setTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => set(theme === 'dark' ? 'light' : 'dark'), set }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
