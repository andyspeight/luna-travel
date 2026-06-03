'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/locale-context';
import { LOCALES } from '@/lib/i18n';
import { IconGlobe, IconCheck, IconChevR } from '@/components/icons';

/**
 * Settings row that shows the current language and opens a sheet to change it.
 * Designed to drop into the Me/settings list (same visual language as the
 * other rows there).
 */
export function LanguageSetting() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal/10 text-teal-dark dark:text-teal-light">
          <IconGlobe size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink">{t('me.language')}</div>
          <div className="text-xs text-ink-2 mt-0.5">
            {current.flag} {current.label}
          </div>
        </div>
        <IconChevR size={18} className="text-ink-3 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 animate-fade-in" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed inset-x-0 bottom-0 z-50 glass border-t border-line rounded-t-3xl p-5 animate-slide-up"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
            role="dialog"
            aria-label={t('me.chooseLanguage')}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-2 px-1">
              {t('me.chooseLanguage')}
            </h2>
            <ul className="rounded-2xl bg-surface border border-line-light overflow-hidden divide-y divide-line-light">
              {LOCALES.map((l) => {
                const active = l.code === locale;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setLocale(l.code);
                        setOpen(false);
                      }}
                      aria-current={active ? 'true' : undefined}
                      className="w-full flex items-center gap-3 p-3.5 hover:bg-surface-2 transition-colors text-left"
                    >
                      <span className="text-xl leading-none" aria-hidden>
                        {l.flag}
                      </span>
                      <span className="flex-1 text-sm font-medium text-ink">{l.label}</span>
                      {active && <IconCheck size={18} className="text-teal-dark dark:text-teal-light" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
