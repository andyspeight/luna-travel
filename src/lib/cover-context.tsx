'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface CoverContextValue {
  /** True when the user wants the full-bleed splash as their welcome screen. */
  coverEnabled: boolean;
  /** Whether the splash has been dismissed within this session (so the dashboard
   *  reappears after the user taps a dock action and comes back). */
  coverDismissed: boolean;
  setCoverEnabled: (v: boolean) => void;
  toggle: () => void;
  dismiss: () => void;
  reset: () => void;
}

const CoverContext = createContext<CoverContextValue | null>(null);

const STORAGE_KEY = 'luna-travel.cover';

export function CoverProvider({ children }: { children: ReactNode }) {
  const [coverEnabled, setEnabled] = useState<boolean>(false);
  const [coverDismissed, setDismissed] = useState<boolean>(false);

  // Restore preference on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'on') setEnabled(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCoverEnabled = (v: boolean) => {
    setEnabled(v);
    setDismissed(false); // re-arm the splash when toggling
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  };

  const toggle = () => setCoverEnabled(!coverEnabled);
  const dismiss = () => setDismissed(true);
  const reset = () => setDismissed(false);

  return (
    <CoverContext.Provider
      value={{ coverEnabled, coverDismissed, setCoverEnabled, toggle, dismiss, reset }}
    >
      {children}
    </CoverContext.Provider>
  );
}

export function useCover(): CoverContextValue {
  const ctx = useContext(CoverContext);
  if (!ctx) throw new Error('useCover must be used within CoverProvider');
  return ctx;
}
