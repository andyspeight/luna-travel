'use client';

import { useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import {
  IconDoc,
  IconChevR,
  IconDownload,
  IconShare,
  IconEye,
  IconShield2,
  IconTicket,
  IconBed,
  IconLounge,
  IconMail,
  IconCheck,
} from '@/components/icons';
import { fileSize, formatDate } from '@/lib/format';
import type { Document } from '@/types/booking';

const KIND_META: Record<
  Document['kind'],
  { gradient: string; icon: React.ReactNode; pill: string }
> = {
  'booking-pack': {
    gradient: 'linear-gradient(135deg, #DC2626, #991B1B)',
    icon: <IconDoc size={22} />,
    pill: 'Booking pack',
  },
  'e-ticket': {
    gradient: 'linear-gradient(135deg, #1B2B5B, #2A3F7A)',
    icon: <IconTicket size={22} />,
    pill: 'E-ticket',
  },
  voucher: {
    gradient: 'linear-gradient(135deg, #0EA5E9, #0369A1)',
    icon: <IconBed size={22} />,
    pill: 'Voucher',
  },
  'lounge-pass': {
    gradient: 'linear-gradient(135deg, #1B2B5B, #0096B7)',
    icon: <IconLounge size={22} />,
    pill: 'Lounge pass',
  },
  atol: {
    gradient: 'linear-gradient(135deg, #16A34A, #14532D)',
    icon: <IconShield2 size={22} />,
    pill: 'ATOL',
  },
  insurance: {
    gradient: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
    icon: <IconShield2 size={22} />,
    pill: 'Insurance',
  },
  other: {
    gradient: 'linear-gradient(135deg, #475569, #1E293B)',
    icon: <IconDoc size={22} />,
    pill: 'Document',
  },
};

export default function DocumentsPage() {
  const { booking } = useBooking();
  const [active, setActive] = useState<Document | null>(null);

  return (
    <PageEnter>
      <main className="px-5 pt-2 pb-6">
        <header className="py-3">
          <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
            Documents
          </h1>
          <p className="text-sm text-ink-2 mt-1.5">
            Available offline · {booking.documents.length} item
            {booking.documents.length === 1 ? '' : 's'}
          </p>
        </header>

        {/* Offline-ready badge */}
        <div className="mt-2 mb-4 inline-flex items-center gap-1.5 bg-success/10 text-success px-2.5 py-1 rounded-full text-[11px] font-semibold">
          <IconCheck size={12} />
          All saved on this device
        </div>

        <section className="space-y-2.5">
          {booking.documents.map((d) => {
            const meta = KIND_META[d.kind];
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActive(d)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light hover:shadow-sm transition-shadow tap text-left"
              >
                <span
                  className="w-12 h-15 rounded-lg text-white flex items-center justify-center flex-shrink-0 shadow-md"
                  style={{ background: meta.gradient, height: 60, width: 48 }}
                >
                  {meta.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{d.name}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">
                    PDF · {fileSize(d.sizeBytes)} · Updated{' '}
                    {formatDate(d.updatedAt, { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <IconChevR size={18} className="text-ink-3 flex-shrink-0" />
              </button>
            );
          })}
        </section>

        {/* Email all card */}
        <section className="mt-6 p-4 rounded-2xl bg-surface border border-line-light">
          <div className="flex items-start gap-3 mb-3">
            <span className="w-9 h-9 rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center flex-shrink-0">
              <IconMail size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">Email everything to yourself</div>
              <div className="text-xs text-ink-2 mt-0.5">
                We&rsquo;ll send the whole pack to {booking.leadEmail}.
              </div>
            </div>
          </div>
          <ActionButton variant="secondary" icon={<IconMail size={16} />}>
            Email all documents
          </ActionButton>
        </section>
      </main>

      {active && <DocSheet doc={active} onClose={() => setActive(null)} />}
    </PageEnter>
  );
}

/**
 * Bottom sheet for a single document — preview, share, download.
 * Click outside, Escape, or the X button to close.
 */
function DocSheet({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const meta = KIND_META[doc.kind];
  const [shareToast, setShareToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setShareToast(msg);
    window.setTimeout(() => setShareToast(null), 2500);
  };

  const openDoc = () => {
    if (!doc.url || doc.url === '#') {
      showToast('Document not available in this build');
      return;
    }
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const downloadDoc = () => {
    if (!doc.url || doc.url === '#') {
      showToast('Document not available in this build');
      return;
    }
    // Trigger a real download using a temporary anchor element.
    // The `download` attribute forces a save dialog rather than in-tab preview.
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-') + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareDoc = async () => {
    if (!doc.url || doc.url === '#') {
      showToast('Document not available in this build');
      return;
    }
    const absoluteUrl = new URL(doc.url, window.location.origin).toString();
    // Web Share API where available (iOS Safari, Android Chrome)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: doc.name,
          text: `${doc.name} — sent from Luna Travel`,
          url: absoluteUrl,
        });
        return;
      } catch (err) {
        // AbortError = user cancelled. Anything else, fall through to clipboard.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    // Fallback: copy the URL to the clipboard
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Sharing not supported on this device');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={doc.name}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3/40" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <span
            className="w-14 rounded-lg text-white flex items-center justify-center flex-shrink-0 shadow-md"
            style={{ background: meta.gradient, height: 70 }}
          >
            {meta.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {meta.pill}
            </div>
            <h2 className="text-base font-semibold text-ink leading-snug mt-0.5">
              {doc.name}
            </h2>
            <div className="text-[11px] text-ink-3 mt-0.5">
              PDF · {fileSize(doc.sizeBytes)}
            </div>
          </div>
        </div>

        {/* Tappable preview area */}
        <button
          type="button"
          onClick={openDoc}
          className="mb-4 w-full rounded-xl border border-line bg-surface-2 aspect-[3/4] flex items-center justify-center text-ink-3 hover:border-teal/40 hover:bg-teal/5 transition-colors tap"
          aria-label={`Open ${doc.name}`}
        >
          <div className="text-center px-6">
            <span
              className="inline-flex w-14 h-16 rounded-lg text-white items-center justify-center mb-3 shadow-md"
              style={{ background: meta.gradient }}
            >
              {meta.icon}
            </span>
            <div className="text-xs font-medium text-ink">Tap to open</div>
            <div className="text-[10px] mt-1 opacity-75">
              Opens the PDF in your browser
            </div>
          </div>
        </button>

        {/* Actions */}
        <div className="space-y-2">
          <ActionButton onClick={openDoc} icon={<IconEye size={18} />}>
            Open
          </ActionButton>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={shareDoc} variant="secondary" icon={<IconShare size={16} />}>
              Share
            </ActionButton>
            <ActionButton onClick={downloadDoc} variant="secondary" icon={<IconDownload size={16} />}>
              Download
            </ActionButton>
          </div>
        </div>

        {shareToast && (
          <div className="mt-2 text-center text-[11px] text-success font-medium">
            {shareToast}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 h-10 text-sm font-medium text-ink-2 hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}
