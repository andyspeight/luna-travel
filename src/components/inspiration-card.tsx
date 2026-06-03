'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Agency } from '@/types/booking';
import type { Inspiration } from '@/data/inspirations';
import { heroImageUrl } from '@/lib/hero';
import { useI18n } from '@/lib/locale-context';
import { formatMoney } from '@/lib/format';
import {
  IconChevR,
  IconMail,
  IconPhone,
  IconChat,
  IconExternal,
  IconSparkle,
} from '@/components/icons';

interface Props {
  inspiration: Inspiration;
  agency: Agency;
  variant?: 'full' | 'compact';
}

export function InspirationCard({ inspiration: ins, agency, variant = 'full' }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const image = heroImageUrl(ins.code, 'landscape');
  const compact = variant === 'compact';

  const priceChip =
    typeof ins.fromPrice === 'number'
      ? `${t('next.from')} ${formatMoneyShort(ins.fromPrice, ins.currency)}${ins.nights ? ` · ${ins.nights} ${t('next.nights')}` : ''}`
      : ins.nights
        ? `${ins.nights} ${t('next.nights')}`
        : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enquire about ${ins.name}, ${ins.country}`}
        className={[
          'group relative block w-full text-left rounded-3xl overflow-hidden shadow-sm border border-line-light',
          'transition-all hover:shadow-md active:scale-[0.99]',
          compact ? 'h-44' : 'min-h-[208px]',
        ].join(' ')}
      >
        <div className="absolute inset-0" style={{ background: ins.gradient }} />
        {image && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `center/cover no-repeat url("${image}")` }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.10) 0%, transparent 32%, rgba(15,23,42,0.78) 100%)',
          }}
        />

        <div className="relative h-full p-4 flex flex-col text-white">
          {/* Tags */}
          {!compact && ins.tags && ins.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ins.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto">
            <div className="text-[11px] uppercase tracking-wider opacity-90">{ins.country}</div>
            <h3 className="font-serif text-2xl leading-none mt-0.5 drop-shadow-sm">
              <em>{ins.name}</em>
            </h3>
            <p className="text-[13px] opacity-90 mt-1 leading-snug">{ins.tagline}</p>
            {!compact && (
              <p className="text-xs opacity-80 mt-1.5 line-clamp-2">{ins.blurb}</p>
            )}

            <div className="mt-2.5 flex items-center justify-between">
              {priceChip ? (
                <span className="text-[11px] font-semibold bg-white/15 backdrop-blur px-2.5 py-1 rounded-full">
                  {priceChip}
                </span>
              ) : (
                <span />
              )}
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
                {t('next.enquire')}
                <IconChevR size={15} />
              </span>
            </div>
          </div>
        </div>
      </button>

      {open && (
        <EnquirySheet ins={ins} agency={agency} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function formatMoneyShort(amount: number, currency = 'GBP'): string {
  // Whole-pound "from" price — no pence on promotional copy.
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return formatMoney(amount, currency);
  }
}

function EnquirySheet({
  ins,
  agency,
  onClose,
}: {
  ins: Inspiration;
  agency: Agency;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const subject = `Enquiry: ${ins.name}, ${ins.country}`;
  const body = `Hi ${agency.name},\n\nWe loved travelling with you and we're now thinking about ${ins.name} (${ins.country}). Could you put together some options and prices for us?\n\nThanks!`;
  const mailto = `mailto:${agency.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tel = `tel:${agency.phone.replace(/\s+/g, '')}`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        className="fixed inset-x-0 bottom-0 z-50 glass border-t border-line rounded-t-3xl p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
        role="dialog"
        aria-label={`Enquire about ${ins.name}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />

        <div className="flex items-start gap-3">
          <span
            className="w-11 h-11 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: ins.gradient }}
          >
            <IconSparkle size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
              {ins.country}
            </div>
            <div className="text-[16px] font-semibold text-ink leading-snug">{ins.name}</div>
            <div className="text-xs text-ink-2 mt-0.5">
              {t('next.noObligation', { agency: agency.name })}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href={mailto}
            className="w-full h-[48px] rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 bg-navy text-white dark:bg-teal dark:text-navy-dark"
          >
            <IconMail size={18} />
            <span>{t('next.emailAgency', { agency: agency.name })}</span>
          </a>
          <a
            href={tel}
            className="w-full h-[48px] rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 bg-surface text-ink border border-line"
          >
            <IconPhone size={18} />
            <span>{t('next.call', { phone: agency.phone })}</span>
          </a>
          <Link
            href="/luna"
            className="w-full h-[48px] rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 bg-surface text-ink border border-line"
            onClick={onClose}
          >
            <IconChat size={18} />
            <span>{t('next.askLuna')}</span>
          </Link>
          {agency.website && (
            <a
              href={`https://${agency.website.replace(/^https?:\/\//, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 rounded-xl text-[13px] font-medium inline-flex items-center justify-center gap-1.5 text-teal-dark dark:text-teal-light"
            >
              <span>{t('next.browseMore', { site: agency.website })}</span>
              <IconExternal size={14} />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
